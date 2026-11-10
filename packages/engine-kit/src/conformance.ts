import type { AnyGameDefinition, Results, SetupArgs } from "./contract"
import { isEngineError, isSharedErrorCode } from "./errors"
import { viewLog } from "./log"
import { applyPreset, defaultOptions, normalizeOptions, type OptionValues } from "./options"
import { canPlayFor, playFor, waitingPlayers } from "./turns"

// The contract of an engine (`docs/engine/01-the-game/11-the-contract.md`) as a test any engine can run: `conformanceProblems(GAME, options)` plays the game the way the server does and says, in
// sentences, which rule of the contract it breaks. A binding calls it from one test (`template/src/conformance.test.ts`), which `pnpm new-game` copies into every game.

// ---------------------------------------------------------------------------------------------------------------------------------- helpers a test of an engine can use as well

/** Freezes a value and everything in it: a step that writes to its input throws. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/**
 * The way Postgres `jsonb` gives a value back: the keys of every object shortest first, then alphabetically, whatever order they were written in, and nothing that JSON cannot hold.
 * The state must mean the same after it.
 */
export function reorderKeys<T>(value: T): T {
  const sorted = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sorted)
    if (!v || typeof v !== "object") return v
    const keys = Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(keys.map((key) => [key, sorted((v as Record<string, unknown>)[key])]))
  }
  return sorted(JSON.parse(JSON.stringify(value))) as T
}

/** Whether two values are the same data: the arrays in the same order, the keys of an object in any, a field that is `undefined` as if it were absent (as JSON has it). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined)
  const kl = keys(left)
  return kl.length === keys(right).length && kl.every((k) => deepEqual(left[k], right[k]))
}

/** What in a value is not plain JSON, as `path is …` sentences: an `undefined`, a number that is not finite, a function, a `Map`, a `Set`, a `Date`, a class instance, a loop. Empty for plain data. */
export function jsonProblems(value: unknown, path = "value", above: object[] = []): string[] {
  if (value === null || typeof value === "string" || typeof value === "boolean") return []
  if (value === undefined) return [`${path} is undefined (it vanishes in jsonb)`]
  if (typeof value === "number") return Number.isFinite(value) ? [] : [`${path} is ${value}`]
  if (typeof value !== "object") return [`${path} is a ${typeof value}`]
  if (above.includes(value)) return [`${path} points back at itself`]
  if (Array.isArray(value)) return value.flatMap((v, i) => jsonProblems(v, `${path}[${i}]`, [...above, value]))
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return [`${path} is a ${value.constructor?.name ?? "class instance"}, not plain data`]
  return Object.entries(value).flatMap(([key, v]) => jsonProblems(v, `${path}.${key}`, [...above, value]))
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------- the suite

export type ConformanceOptions = {
  /** The `SetupData` the binding's `loadSetupData` would hand over (a game that takes none leaves it out) */
  data?: unknown
  /** The table sizes to play; by default the smallest, the largest and a few between */
  playerCounts?: readonly number[]
  /** Games played for each table size with the default options (default 8) */
  seeds?: number
  /** Games played for each variant of an option, at the smallest and the largest table (default 2) */
  variantSeeds?: number
  /** The most steps a game may take before it counts as one that never ends (default 3000) */
  maxSteps?: number
  /** The game's own error codes, `ERROR_CODES` of its binding: a refusal with any other code than these and the shared ones is a problem. Without it, any code is accepted */
  errorCodes?: readonly string[]
  /** What a viewer must never see: the ids and words, in the state, that `viewerId` (`null` for anybody outside the table) is not meant to know. A view whose JSON holds one of them is a leak */
  secretsFor?: (state: never, viewerId: string | null) => readonly string[]
  /** A game that still carries words in its options and score lines (the ones that move to its Sanity, `engineTextKeys`) sets it until it has moved them */
  allowTexts?: boolean
}

/** The problems of a rule that happens many times, said once with how many times and a couple of examples. */
class Findings {
  private readonly rules = new Map<string, { count: number; examples: string[] }>()

  flag(rule: string, where: string) {
    const entry = this.rules.get(rule) ?? { count: 0, examples: [] }
    entry.count++
    if (entry.examples.length < 2 && !entry.examples.includes(where)) entry.examples.push(where)
    this.rules.set(rule, entry)
  }

  lines(): string[] {
    return [...this.rules].map(([rule, { count, examples }]) => `${rule}${count > 1 ? ` (x${count})` : ""}${examples.length ? `, e.g. ${examples.join(" | ")}` : ""}`)
  }
}

// Ids of different lengths on purpose: `jsonb` gives the keys of an object back shortest first, so an order taken from the keys of a record is not the seat order
const IDS = ["long-id", "x1", "x0", "player-3", "b", "aa", "z9", "m", "q-10", "w"]
const table = (count: number) => Array.from({ length: count }, (_, i) => ({ id: IDS[i] ?? `seat-${i}-id`, nickname: `Nickname ${i + 1}` }))
const STRANGER = "stranger"

type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown }

type Run = { count: number; overrides: OptionValues; seed: number; label: string }

class Suite {
  readonly found = new Findings()
  readonly maxSteps: number

  constructor(
    readonly game: AnyGameDefinition,
    readonly options: ConformanceOptions,
  ) {
    this.maxSteps = options.maxSteps ?? 3000
  }

  /** Calls `f` the way the server does, once a seed is given: the engine may not ask the clock or the dice. */
  attempt<T>(where: string, f: () => T): Attempt<T> {
    const random = Math.random
    const now = Date.now
    let used: string | null = null
    Math.random = () => ((used ??= "Math.random"), random())
    Date.now = () => ((used ??= "Date.now"), now())
    try {
      return { ok: true, value: f() }
    } catch (error) {
      return { ok: false, error }
    } finally {
      Math.random = random
      Date.now = now
      if (used) this.found.flag(`the engine calls ${used}: a game is replayed from its seed, so it may not`, where)
    }
  }

  /** Says what a call that should have worked threw. */
  thrown(where: string, what: string, error: unknown) {
    if (error instanceof TypeError && /read.only|not extensible|Cannot delete/i.test(error.message)) {
      this.found.flag("a step writes to the state it was given instead of returning a new one", `${where}: ${what}`)
    } else if (isEngineError(error)) {
      this.known(where, error.code)
      this.found.flag(`${what} refuses where it must work`, `${where}: ${error.code}`)
    } else {
      this.found.flag(`${what} throws an error where it must work`, `${where}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** A refusal carries a code of the vocabulary: a shared one, or one the game lists. */
  known(where: string, code: string) {
    const own = this.options.errorCodes
    if (own && !isSharedErrorCode(code) && !own.includes(code)) this.found.flag("a refusal has a code that is neither shared nor in the game's ERROR_CODES", `${where}: ${code}`)
  }

  run() {
    try {
      this.checkDefinition()
      this.checkSetup()
      this.checkGames()
    } catch (error) {
      // A suite that stops on a broken engine tells nothing: whatever the engine does, the answer is a list of sentences
      this.found.flag("the suite could not go on", error instanceof Error ? error.message : String(error))
    }
    return this.found.lines()
  }

  private counts(): number[] {
    const { minPlayers, maxPlayers } = this.game
    if (this.options.playerCounts) return [...this.options.playerCounts]
    const mid = Math.floor((minPlayers + maxPlayers) / 2)
    return [...new Set([minPlayers, minPlayers + 1, mid, maxPlayers - 1, maxPlayers])].filter((n) => n >= minPlayers && n <= maxPlayers).sort((a, b) => a - b)
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------------------------- the definition

  private checkDefinition() {
    const { game, found } = this
    const allowTexts = this.options.allowTexts ?? false
    if (typeof game.id !== "string" || !game.id) found.flag("the definition has no id", "id")
    if (typeof game.name !== "string" || !game.name) found.flag("the definition has no name", "name")
    if (!Number.isInteger(game.minPlayers) || !Number.isInteger(game.maxPlayers) || game.minPlayers < 1 || game.minPlayers > game.maxPlayers) {
      found.flag("the bounds of a table are not whole numbers with 1 <= minPlayers <= maxPlayers", `${game.minPlayers} to ${game.maxPlayers}`)
    }
    if (!Array.isArray(game.clientActions) || game.clientActions.length === 0) found.flag("clientActions lists no action type", "clientActions")
    else if (new Set(game.clientActions).size !== game.clientActions.length) found.flag("clientActions lists a type twice", game.clientActions.join(", "))
    if (!canPlayFor(game)) found.flag("the server cannot play for an absent player: the definition needs waitingFor and autoPlayFor", "waitingFor, autoPlayFor")
    if (game.step && !game.autoPlayStep) found.flag("the definition has a step but no autoPlayStep: what is played for an absent player would leave nothing in the log", "autoPlayStep")
    if (game.autoPlayStep && !game.step) found.flag("the definition has an autoPlayStep but no step: the moves of the players would leave nothing in the log", "step")
    if (game.setupStep && !game.step) found.flag("the definition has a setupStep but no step: the log would open with the deal and say nothing after it", "step")

    for (const [key, def] of Object.entries(game.options ?? {})) {
      const where = `options.${key}`
      if (def.type === "number" && !(def.min <= def.defaultValue && def.defaultValue <= def.max)) found.flag("an option's default is outside its range", where)
      if (def.type === "choice" && !def.choices.some((c) => c.value === def.defaultValue)) found.flag("a choice option's default is not one of its choices", where)
      if (def.type === "choice" && new Set(def.choices.map((c) => c.value)).size !== def.choices.length) found.flag("a choice option lists a value twice", where)
      if (def.type === "boolean" && typeof def.defaultValue !== "boolean") found.flag("a boolean option's default is not a boolean", where)
      for (const other of [...(def.requires ?? []), ...(def.conflictsWith ?? [])]) if (!(other in game.options)) found.flag("an option names an option that does not exist", `${where} -> ${other}`)
      if (!allowTexts && (def.label !== undefined || def.help !== undefined || (def.type === "choice" && def.choices.some((c) => c.label !== undefined)))) {
        found.flag("an option carries words: they are the game's, in its Sanity (engineTextKeys)", where)
      }
    }
    const defaults = defaultOptions(game.options ?? {})
    if (!deepEqual(normalizeOptions(game.options ?? {}, {}), defaults)) found.flag("normalizeOptions({}) is not the defaults: a default is reset by the constraints", "options")

    const presetIds = (game.presets ?? []).map((p) => p.id)
    if (new Set(presetIds).size !== presetIds.length) found.flag("two presets have the same id", presetIds.join(", "))
    for (const preset of game.presets ?? []) {
      for (const key of Object.keys(preset.values)) if (!(key in (game.options ?? {}))) found.flag("a preset sets an option that does not exist", `preset ${preset.id} -> ${key}`)
      if (!allowTexts && (preset.label !== undefined || preset.help !== undefined)) found.flag("a preset carries words: they are the game's, in its Sanity (engineTextKeys)", `preset ${preset.id}`)
      const applied = this.attempt(`preset ${preset.id}`, () => applyPreset(game.options, preset))
      if (!applied.ok) this.thrown(`preset ${preset.id}`, "applyPreset", applied.error)
    }
    if (game.scoreLines && new Set(game.scoreLines).size !== game.scoreLines.length) found.flag("scoreLines lists a line twice", game.scoreLines.join(", "))
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------------------------------- setup

  private checkSetup() {
    const { game, found } = this
    const { data } = this.options
    const defaults = (count: number) => normalizeOptions(game.options ?? {}, {}, { playerCount: count })
    const refused = (what: string, players: { id: string; nickname: string }[]) => {
      const result = this.attempt(`setup (${what})`, () => game.setup({ players, options: defaults(players.length), seed: 1, data }))
      if (result.ok) found.flag("setup accepts a table it cannot play", what)
      else if (!isEngineError(result.error)) found.flag("setup throws a plain error for a table it cannot play: it must refuse with INVALID_PLAYERS", `${what}: ${result.error instanceof Error ? result.error.message : String(result.error)}`)
      else if (result.error.code !== "INVALID_PLAYERS") found.flag("setup refuses a table it cannot play with another code than INVALID_PLAYERS", `${what}: ${result.error.code}`)
    }
    refused("no player", [])
    if (game.minPlayers > 1) refused(`${game.minPlayers - 1} players`, table(game.minPlayers - 1))
    refused(`${game.maxPlayers + 1} players`, table(game.maxPlayers + 1))
    const seated = table(game.minPlayers)
    if (seated.length > 1) refused("the same id twice", [...seated.slice(0, -1), { ...seated[0]!, nickname: "Twin" }])
    refused("an empty id", [{ ...seated[0]!, id: "" }, ...seated.slice(1)])
  }

  // ----------------------------------------------------------------------------------------------------------------------------------------------------------- whole games

  /** The runs: every table size with the default options, then each option at the extremes of what it takes, at the smallest and the largest table. */
  private runs(): Run[] {
    const { game } = this
    const seeds = this.options.seeds ?? 8
    const variantSeeds = this.options.variantSeeds ?? 2
    const runs: Run[] = []
    for (const count of this.counts()) for (let i = 1; i <= seeds; i++) runs.push({ count, overrides: {}, seed: 31 * i, label: "default options" })
    const seen = new Set<string>()
    for (const [key, def] of Object.entries(game.options ?? {})) {
      const values = def.type === "number" ? [def.min, def.max] : def.type === "choice" ? def.choices.map((c) => c.value) : [true, false]
      for (const value of values) {
        for (const count of [...new Set([game.minPlayers, game.maxPlayers])]) {
          const normalized = JSON.stringify(normalizeOptions(game.options, { [key]: value }, { playerCount: count }))
          if (normalized === JSON.stringify(normalizeOptions(game.options, {}, { playerCount: count })) || seen.has(`${count}:${normalized}`)) continue
          seen.add(`${count}:${normalized}`)
          for (let i = 1; i <= variantSeeds; i++) runs.push({ count, overrides: { [key]: value }, seed: 17 * i, label: `${key} = ${String(value)}` })
        }
      }
    }
    return runs
  }

  private checkGames() {
    for (const run of this.runs()) this.play(run)
  }

  private play({ count, overrides, seed, label }: Run) {
    const { game, found } = this
    const { data } = this.options
    const where = `${count} players, ${label}, seed ${seed}`
    const players = table(count)
    const ids = players.map((p) => p.id)
    const values = normalizeOptions(game.options ?? {}, overrides, { playerCount: count })
    const made = this.attempt(where, () => game.setup({ players, options: values, seed, data }))
    if (!made.ok) return this.thrown(where, "setup", made.error)
    let state = made.value
    const twice = this.attempt(where, () => game.setup({ players, options: values, seed, data }))
    if (twice.ok && !deepEqual(twice.value, state)) found.flag("the same seed does not give the same game: setup is not deterministic", where)
    this.checkOpening({ players, options: values, seed, data }, state, ids, where)

    for (let step = 0; ; step++) {
      if (step >= this.maxSteps) return found.flag(`a game does not end within ${this.maxSteps} steps of autoPlayFor`, where)
      deepFreeze(state)
      const at = `${where}, step ${step}`
      this.checkState(state, ids, at)
      if (step === 0 || step === 7) this.checkJunk(state, ids, at)
      if (game.isOver(state)) return this.checkResults(state, ids, where)
      const waits = this.attempt(at, () => waitingPlayers(game, state))
      if (!waits.ok) return // checkState has said what waitingFor does
      const waiting = waits.value
      if (waiting.length === 0) return found.flag("the game is not over and waits for nobody", at)
      const pick = waiting[step % waiting.length]!
      const next = this.attempt(at, () => playFor(game, state, pick))
      if (!next.ok) return this.thrown(at, "autoPlayFor", next.error)
      const again = this.attempt(at, () => playFor(game, state, pick))
      if (again.ok && !deepEqual(again.value, next.value)) found.flag("autoPlayFor gives two different states for the same state: it is not deterministic", at)
      const stored = this.attempt(at, () => playFor(game, reorderKeys(state), pick))
      if (stored.ok && !deepEqual(stored.value, next.value)) found.flag("the game plays differently once jsonb has reordered the keys of its state: an order comes from the keys of an object", at)
      if (deepEqual(next.value, state)) return found.flag("autoPlayFor changes nothing: the game never moves on", at)
      this.checkLog(state, pick, next.value, ids, at)
      state = next.value
    }
  }

  /** What must hold of any state of a game, at any moment. */
  private checkState(state: unknown, ids: string[], at: string) {
    const { game, found } = this
    const problems = jsonProblems(state, "state")
    if (problems.length) found.flag("the state is not plain JSON: it does not come back from jsonb as it went in", `${at}: ${problems[0]}`)
    // Names are display data: the table keeps them, the board takes them with `nickname(id)`
    if (table(ids.length).some((p) => JSON.stringify(state).includes(p.nickname))) found.flag("the state holds a nickname: names are the table's, the state keeps the ids", at)

    const over = this.attempt(at, () => game.isOver(state))
    if (!over.ok) return this.thrown(at, "isOver", over.error)
    if (typeof over.value !== "boolean") found.flag("isOver does not return a boolean", at)

    if (game.waitingFor) {
      const raw = this.attempt(at, () => game.waitingFor!(state) as readonly unknown[])
      if (!raw.ok) this.thrown(at, "waitingFor", raw.error)
      else {
        const list = raw.value
        if (!Array.isArray(list) || list.some((id) => typeof id !== "string")) found.flag("waitingFor does not return a list of player ids", at)
        else {
          if (new Set(list).size !== list.length) found.flag("waitingFor lists a player twice", `${at}: ${list.join(", ")}`)
          if (list.some((id) => !ids.includes(id))) found.flag("waitingFor names somebody who is not at the table", `${at}: ${list.join(", ")}`)
          else if (JSON.stringify(list) !== JSON.stringify(ids.filter((id) => list.includes(id)))) found.flag("waitingFor is not in seat order", `${at}: ${list.join(", ")}`)
          if (over.value && list.length) found.flag("waitingFor names somebody once the game is over", at)
        }
      }
    }

    const stored = reorderKeys(state)
    const waits = this.attempt(at, () => waitingPlayers(game, state))
    const waitsStored = this.attempt(at, () => waitingPlayers(game, stored))
    if (!this.same(at, () => game.isOver(stored), over.value) || (waits.ok && waitsStored.ok && !deepEqual(waits.value, waitsStored.value))) {
      found.flag("who the game waits for changes once jsonb has reordered the keys of its state: an order comes from the keys of an object", at)
    }
    for (const viewer of [...ids, null, STRANGER]) this.checkView(state, stored, viewer, over.value, at)
    this.checkStandings(state, ids, at)
  }

  /**
   * What each player has so far, when the view says it (`standings`, for the list of the players that the HUD keeps in view): a view that has it for one viewer has it for all, it holds each player of the table once, in seat order,
   * with a finite score, and is the same for every viewer. A game with none says nothing here.
   */
  private checkStandings(state: unknown, ids: string[], at: string) {
    const { game, found } = this
    const seen: unknown[] = []
    for (const viewer of [...ids, null]) {
      const view = this.attempt(at, () => game.view(state, viewer) as { standings?: unknown } | null)
      if (view.ok && view.value?.standings !== undefined) seen.push(view.value.standings)
    }
    if (seen.length === 0) return
    if (seen.length !== ids.length + 1) found.flag("the view carries standings for some viewers and not for others", at)
    if (seen.some((standings) => !deepEqual(standings, seen[0]))) found.flag("the standings are not the same for every viewer", at)
    const rows = seen[0] as { playerId?: unknown; score?: unknown }[]
    if (!Array.isArray(rows) || rows.length !== ids.length || rows.some((row, i) => row?.playerId !== ids[i])) {
      found.flag("the standings do not hold each player of the table once, in seat order", at)
      return
    }
    if (rows.some((row) => typeof row.score !== "number" || !Number.isFinite(row.score))) found.flag("a standing has a score that is not a finite number", at)
  }

  private same(at: string, f: () => unknown, expected: unknown): boolean {
    const result = this.attempt(at, f)
    return result.ok && deepEqual(result.value, expected)
  }

  private checkView(state: unknown, stored: unknown, viewer: string | null, over: boolean, at: string) {
    const { game, found } = this
    const who = viewer === null ? "a spectator" : viewer === STRANGER ? "a stranger" : `seat ${viewer}`
    const result = this.attempt(at, () => game.view(state, viewer) as unknown)
    if (!result.ok) return this.thrown(at, `view for ${who}`, result.error)
    const problems = jsonProblems(result.value, "view")
    if (problems.length) found.flag("a view is not plain JSON: it cannot cross the network as it is", `${at}, ${who}: ${problems[0]}`)
    if (!this.same(at, () => game.view(stored, viewer), result.value)) found.flag("a view changes once jsonb has reordered the keys of the state: an order comes from the keys of an object", `${at}, ${who}`)
    if (table(Math.max(this.game.maxPlayers, 1)).some((p) => JSON.stringify(result.value).includes(p.nickname))) found.flag("a view holds a nickname: names are the table's, a view keeps the ids", `${at}, ${who}`)
    const results = (result.value as { results?: unknown } | null)?.results
    if (over && (results === null || results === undefined)) found.flag("the view of a finished game carries no results", `${at}, ${who}`)
    if (!over && results !== null && results !== undefined) found.flag("the view carries results before the game is over", `${at}, ${who}`)
    const secrets = this.options.secretsFor?.(state as never, viewer === STRANGER ? null : viewer) ?? []
    const json = JSON.stringify(result.value)
    const leaked = secrets.find((secret) => json.includes(JSON.stringify(secret)))
    if (leaked !== undefined) found.flag("a view shows what its viewer must not know", `${at}, ${who}: ${leaked}`)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------------------------------------- the log

  /**
   * The log of a game that says what happens: `autoPlayStep` plays like `autoPlayFor` and says the same each time, and what it says is held to the rules of an entry (`checkEntries`).
   */
  private checkLog(state: unknown, pick: string, next: unknown, ids: string[], at: string) {
    const { game, found } = this
    if (!game.autoPlayStep) return
    const played = this.attempt(at, () => game.autoPlayStep!(state, pick))
    if (!played.ok) return this.thrown(at, "autoPlayStep", played.error)
    const { state: after, events } = played.value
    if (!deepEqual(after, next)) found.flag("autoPlayStep gives another state than autoPlayFor: a move is one thing, whoever asks for it", at)
    const again = this.attempt(at, () => game.autoPlayStep!(state, pick))
    if (again.ok && !deepEqual(again.value.events, events)) found.flag("autoPlayStep gives two different logs for the same state: it is not deterministic", at)
    this.checkEntries(events, after, ids, at)
  }

  /** The opening of a game that says what its setup did: `setupStep` sets the game up like `setup` and says the same each time, and what it says is held to the rules of an entry (`checkEntries`). */
  private checkOpening(args: SetupArgs<unknown>, made: unknown, ids: string[], at: string) {
    const { game, found } = this
    if (!game.setupStep) return
    const opened = this.attempt(at, () => game.setupStep!(args))
    if (!opened.ok) return this.thrown(at, "setupStep", opened.error)
    const { state: after, events } = opened.value
    if (!deepEqual(after, made)) found.flag("setupStep gives another game than setup: a setup is one thing, whoever asks for it", at)
    const again = this.attempt(at, () => game.setupStep!(args))
    if (again.ok && !deepEqual(again.value.events, events)) found.flag("setupStep gives two different logs for the same seed: it is not deterministic", at)
    this.checkEntries(events, after, ids, `${at}, setup`)
  }

  /**
   * What the entries of a step must be: a list of plain data, each with an event, addressed to players of the table, with no nickname in it, and showing each viewer nothing they must not know (`secretsFor`, as of the state the
   * step leaves).
   */
  private checkEntries(events: unknown, after: unknown, ids: string[], at: string) {
    const { found } = this
    if (!Array.isArray(events)) return found.flag("the events of a step are not a list", at)
    const problems = jsonProblems(events, "events")
    if (problems.length) found.flag("the log of a step is not plain JSON: it does not come back from jsonb as it went in", `${at}: ${problems[0]}`)
    const names = table(ids.length).map((p) => p.nickname)
    for (const [i, entry] of events.entries()) {
      const here = `${at}, entry ${i}`
      if (!entry || typeof entry !== "object" || !entry.event || typeof entry.event !== "object") {
        found.flag("an entry of the log has no event: a LogEntry is { event, to?, masked? }", here)
        continue
      }
      if (entry.to !== undefined && (!Array.isArray(entry.to) || entry.to.some((id: string) => !ids.includes(id)))) found.flag("an entry of the log is addressed to somebody who is not at the table", here)
      if (entry.masked !== undefined && entry.to === undefined) found.flag("an entry of the log has a masked version but nobody it is addressed to: masked is what the others read of an event that only some may, so to must say who", here)
      if (names.some((name) => JSON.stringify(entry).includes(name))) found.flag("an entry of the log holds a nickname: names are the table's, the log keeps the ids", here)
    }
    for (const viewer of [...ids, null]) {
      const secrets = this.options.secretsFor?.(after as never, viewer) ?? []
      const json = JSON.stringify(viewLog(events, viewer))
      const leaked = secrets.find((secret) => json.includes(JSON.stringify(secret)))
      if (leaked !== undefined) found.flag("the log shows what its viewer must not know", `${at}, ${viewer === null ? "a spectator" : `seat ${viewer}`}: ${leaked}`)
    }
  }

  // --------------------------------------------------------------------------------------------------------------------------------------------------------- junk actions

  /** Whatever a client sends is refused with a code, or else is a move: it never throws a plain error and never writes to the state. */
  private checkJunk(state: unknown, ids: string[], at: string) {
    const { game, found } = this
    const junk = ["value", -1, 99, "nope", {}, null]
    const actions: Record<string, unknown>[] = [{}, { type: undefined }]
    for (const playerId of [ids[0]!, ids[ids.length - 1]!, STRANGER, undefined]) {
      actions.push({ type: "__nonsense__", playerId })
      for (const type of game.clientActions) {
        actions.push({ type, playerId })
        actions.push({ type, playerId, cardId: junk[3], card: junk[1], amount: junk[1], position: junk[2], target: junk[3], targetId: junk[3], value: junk[0], choice: junk[0], cards: junk[4] })
        actions.push({ type, playerId, cardId: junk[5], card: junk[5], amount: junk[0], position: junk[5], target: junk[5], value: junk[5] })
      }
    }
    for (const action of actions) {
      const what = `apply(${JSON.stringify(action)})`
      const result = this.attempt(at, () => game.apply(state, action as never))
      if (result.ok) {
        const problems = jsonProblems(result.value, "state")
        if (problems.length) found.flag("a malformed action gives a state that is not plain JSON", `${at}, ${what}: ${problems[0]}`)
        if (action.type === "__nonsense__" || action.type === undefined) found.flag("apply accepts an action that is not one of the game's", `${at}, ${what}`)
      } else if (isEngineError(result.error)) this.known(at, result.error.code)
      else if (result.error instanceof TypeError && /read.only|not extensible|Cannot delete/i.test(result.error.message)) found.flag("a step writes to the state it was given instead of returning a new one", `${at}, ${what}`)
      else found.flag("apply throws a plain error on a malformed action: it must refuse with an EngineError", `${at}, ${what}: ${result.error instanceof Error ? result.error.message : String(result.error)}`)
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------ results

  private checkResults(state: unknown, ids: string[], where: string) {
    const { game, found } = this
    const allowTexts = this.options.allowTexts ?? false
    const seen: Results[] = []
    for (const viewer of [...ids, null]) {
      const view = this.attempt(where, () => game.view(state, viewer) as { results?: Results | null })
      if (view.ok && view.value?.results) seen.push(view.value.results)
    }
    const results = seen[0]
    if (!results) return
    if (seen.some((r) => !deepEqual(r, results))) found.flag("the results are not the same for every viewer", where)
    const rows = results.players ?? []
    if (!Array.isArray(rows) || rows.length !== ids.length || !ids.every((id) => rows.filter((r) => r.playerId === id).length === 1)) {
      found.flag("the results do not hold each player of the table exactly once", where)
      return
    }
    for (const row of rows) {
      const at = `${where}, ${row.playerId}`
      if (typeof row.total !== "number" || !Number.isFinite(row.total)) found.flag("a result has a total that is not a finite number", at)
      if (!Number.isInteger(row.rank) || row.rank < 1) found.flag("a rank is not a whole number from 1", at)
      else if (row.rank !== 1 + rows.filter((r) => r.rank < row.rank).length) found.flag("the ranks do not follow the competition ranking of the kit (1, 2, 2, 4): a tie shares a rank and the next one is skipped", at)
      if (!Array.isArray(row.detail)) found.flag("a result has no detail list", at)
      else
        for (const line of row.detail) {
          if (typeof line.key !== "string" || !line.key) found.flag("a line of the score has no key", at)
          if (typeof line.points !== "number" || !Number.isFinite(line.points)) found.flag("a line of the score has points that are not a finite number", `${at}, ${line.key}`)
          if (game.scoreLines && !game.scoreLines.includes(line.key)) found.flag("a line of the score is not in the definition's scoreLines", `${at}, ${line.key}`)
          if (!allowTexts && line.label !== undefined) found.flag("a line of the score carries words: they are the game's, in its Sanity (scoreLabelKey)", `${at}, ${line.key}`)
        }
    }
    if (!Array.isArray(results.winners)) found.flag("the winners are not a list of player ids", where)
    else if (results.coop !== undefined) this.checkTogether(results, ids, where)
    else if (results.winners.length === 0) found.flag("a finished game names no winner", where)
    else {
      if (new Set(results.winners).size !== results.winners.length) found.flag("a winner is named twice", where)
      for (const id of results.winners) {
        const row = rows.find((r) => r.playerId === id)
        if (!row) found.flag("a winner is not at the table", `${where}, ${id}`)
        else if (row.rank !== 1) found.flag("a winner does not have rank 1", `${where}, ${id}`)
      }
      for (const row of rows) if (row.rank === 1 && !results.winners.includes(row.playerId)) found.flag("a player of rank 1 is not among the winners", `${where}, ${row.playerId}`)
    }
  }

  /** A game the whole table plays on one side: it wins or loses together, with one score, and `winners` is everybody or nobody. */
  private checkTogether(results: Results, ids: string[], where: string) {
    const { found } = this
    if (results.coop !== "won" && results.coop !== "lost") return found.flag('coop is neither "won" nor "lost"', where)
    for (const row of results.players) {
      if (row.rank !== 1) found.flag("in a game the table plays together every player has rank 1: it wins or loses as one", `${where}, ${row.playerId}`)
      if (row.total !== results.players[0]!.total) found.flag("in a game the table plays together every player has the table's score as total", `${where}, ${row.playerId}`)
    }
    const expected = results.coop === "won" ? ids : []
    if (results.winners.length !== expected.length || !expected.every((id) => results.winners.includes(id))) {
      found.flag(results.coop === "won" ? "a table that won together must name every player among the winners" : "a table that lost together must name no winner", where)
    }
  }
}

/**
 * Plays an engine the way the server does and checks the contract on every step. The sentences it returns are the rules the engine breaks; an engine that keeps the contract gets `[]`.
 *
 * - The definition: its bounds, its actions, its options and presets, that the server can play for an absent player, and that it carries no words.
 * - `setup`: a table it cannot play (no player, too few, too many, the same id twice, an empty id) is refused with `INVALID_PLAYERS`; a seed gives the same game.
 * - Whole games, for several table sizes, seeds and variants of each option, played with `autoPlayFor` until they end: at every step the state is plain JSON, `isOver` and `waitingFor`
 *   are sound (a list of the seated players, in seat order, nobody once the game is over), every view works for each seat, a spectator and a stranger, shows no result before the end and
 *   all of them at the end, and leaks none of the `secretsFor`; when a view carries `standings` they hold each player once, in seat order, with a finite score, the same for every viewer; the step does not write to the state it was given, gives the same state twice, plays the same once `jsonb` has reordered the keys,
 *   moves the game on, and never asks `Math.random` or `Date.now`; the results hold each player once, with ranks, winners and lines of score in order (a table that plays together, `coop`,
 *   wins or loses as one: every player at rank 1 with the table's score, and everybody among the winners or nobody).
 * - The log, for a game that says what happens (`step`, `autoPlayStep`, and `setupStep` for its opening): the first two come together, `autoPlayStep` plays like `autoPlayFor` and `setupStep` sets up like `setup`, each says the same
 *   every time, and the entries they give are plain data, are addressed to players of the table, hold no nickname, and leak none of the `secretsFor` to a viewer who may only read their `masked` version.
 * - Junk actions: whatever a client could send is refused with an `EngineError` whose code is in the vocabulary, or else is a move; it never throws a plain error and never writes to the state.
 */
export function conformanceProblems(game: AnyGameDefinition, options: ConformanceOptions = {}): string[] {
  return new Suite(game, options).run()
}

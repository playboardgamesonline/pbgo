import { inspect, isDeepStrictEqual } from "node:util"
import { type Rng, createRng, isEngineError, playFor, playOn, viewLog, waitingPlayers } from "@pbgo/engine-kit"
import { beforeAll, describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { ORIGINAL_RULES } from "./rules"
import { deepFreeze, kittensInPlay, living, newState, oneOf, playRandomly, problems, randomAction, reorderKeys, seedOf, typesOf, viewOf } from "./test-utils"
import { type Action, CLIENT_ACTIONS, EK_ERROR_CODES, type EkEvent, type EkLogEntry, type Face, type Phase, type PlayerView, type State, type Step } from "./types"

/**
 * Whole games of the Original Edition, played at random and checked after every move.
 *
 * `playRandomly` (test-utils) plays 200 tables to the end: 2 to 5 players, every option the edition has (five different cards, the
 * faster game, the classic deal), thousands of moves and refusals included. After each accepted move this file checks what must
 * hold whatever the cards are: that no card is lost, that the turn goes to the right player, that a Kitten is defused or explodes
 * as the hand says, that the Nope window follows its chain, that every card moves where its event says, that a stored copy of the
 * state replays the move, that no viewer is shown what is not theirs, that the log tells each viewer what they may know, and that
 * the stats and the ranking add up. The rules are not written a second time as a model: each check is a consequence the rules
 * promise, read from the states and the events of one move.
 *
 * Three more passes follow. Eighty more games are played with players who are away three times in ten, so that the takeover plays
 * for them in every phase. The states met on the way are kept, and each is given junk: thousands of actions that no player would
 * send, which must be refused, or else hold up under every check above. And the takeover is asked, for each kept state, to play
 * for each player the game waits for and for nobody else.
 *
 * A check that fails does not stop the pass. It is noted under its group with a few examples, and the tests below each report one
 * group, so a single run shows everything that is wrong.
 */

// --- What the pass found wrong

type Bucket = { count: number; examples: string[] }
const found = new Map<string, Bucket>()

function flag(group: string, name: string, detail: string): void {
  const key = `${group} · ${name}`
  const bucket = found.get(key) ?? { count: 0, examples: [] }
  bucket.count++
  if (bucket.examples.length < 3) bucket.examples.push(detail)
  found.set(key, bucket)
}

/** Notes `name` under `group` when `ok` is false. `detail` is only built then. */
function check(group: string, name: string, ok: boolean, detail: () => string): void {
  if (!ok) flag(group, name, detail())
}

/** What failed under `group`, one line each: the check, how many times, and a few places. */
function reportOf(group: string): string[] {
  return [...found].filter(([key]) => key.startsWith(`${group} · `)).map(([key, { count, examples }]) => `${key} ×${count}: ${examples.join(" | ")}`)
}

// --- One accepted move

type Moved = {
  /** Which game and which move, for the report. */
  at: string
  before: State
  /** `null` when the engine played for the player who was waited for. */
  action: Action | null
  after: State
  entries: EkLogEntry[]
  events: EkEvent[]
}

/** `ok(name, condition, more?)`: notes `name` under `group`, with the move, when the condition is false. */
function checker(group: string, move: Moved): (name: string, condition: boolean, more?: () => string) => void {
  return (name, condition, more) => {
    if (condition) return
    flag(group, name, `${move.at} ${move.action === null ? "(played for)" : JSON.stringify(move.action)}${more ? ` — ${more()}` : ""}`)
  }
}

function eventsOf<K extends EkEvent["kind"]>(events: readonly EkEvent[], kind: K): Extract<EkEvent, { kind: K }>[] {
  return events.filter((event): event is Extract<EkEvent, { kind: K }> => event.kind === kind)
}

// --- Reading a state

const books = new WeakMap<State, Map<number, string>>()

/** What the card that holds `id` is in `state`, built once per state. */
function titleIn(state: State, id: number): string | undefined {
  let book = books.get(state)
  if (book === undefined) {
    const types = typesOf(state)
    book = new Map(state.ids.map((card, index) => [card, types[index]!]))
    books.set(state, book)
  }
  return book.get(id)
}

const t = (state: State, id: number): string => titleIn(state, id) ?? "?"

const handIn = (state: State, playerId: string): number[] => state.hands[state.seats.indexOf(playerId)] ?? []

/** The Exploding Kitten held out for its owner during `defuse`: public, like the discard. */
const inTheAir = (state: State): number[] => (state.phase.kind === "defuse" ? [state.phase.kitten] : [])

/** The seat after `from`, clockwise, among the players still in: written again here, not read from the engine. */
function nextAlive(state: State, from: number): number {
  const n = state.seats.length
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n
    if (!state.out.includes(state.seats[seat]!)) return seat
  }
  return -1
}

/** The titles of every card that is in play (hands, piles, the Kitten in the air), sorted: the same all game long. */
function census(state: State): string {
  const placed = [...state.hands.flat(), ...state.deck, ...state.discard, ...inTheAir(state)]
  return placed.map((id) => t(state, id)).sort().join()
}

/** Who the phase waits for, worked out from the phase alone. */
function waitingExpected(state: State): string[] {
  const { phase } = state
  if (phase.kind === "over") return []
  if (phase.kind === "give") return [phase.from]
  if (phase.kind === "reaction") {
    const last = phase.nopes.at(-1)?.by ?? phase.pending.by
    return state.seats.filter((id) => !state.out.includes(id) && id !== last)
  }
  return [state.seats[state.turn]!]
}

// --- What the games went through

const tally = {
  games: 0,
  moves: 0,
  fallbacks: 0,
  kinds: new Set<string>(),
  phases: new Set<string>(),
  combos: new Set<number>(),
  named: { hit: 0, miss: 0 },
  codes: new Set<string>(),
  maxChain: 0,
  maxOwed: 0,
}

/** What the counted games went through, state by state: the start of each and the state after each move. */
function note(state: State): void {
  tally.maxOwed = Math.max(tally.maxOwed, state.owed)
  tally.phases.add(state.phase.kind)
  if (state.phase.kind === "reaction") tally.maxChain = Math.max(tally.maxChain, state.phase.nopes.length)
}

const SAMPLES_PER_PHASE = 12
const samples = new Map<string, State[]>()
const offered = new Map<string, number>()
const sampler = createRng(seedOf(7))

/** Keeps a few states of each phase, drawn evenly from everything offered (reservoir sampling), for the tests that start from one. */
function offer(state: State): void {
  const kind = state.phase.kind
  const count = (offered.get(kind) ?? 0) + 1
  offered.set(kind, count)
  const kept = samples.get(kind) ?? []
  samples.set(kind, kept)
  if (kept.length < SAMPLES_PER_PHASE) kept.push(structuredClone(state))
  else {
    const slot = Math.floor(sampler() * count)
    if (slot < SAMPLES_PER_PHASE) kept[slot] = structuredClone(state)
  }
}

const everySample = (): State[] => [...samples.values()].flat()

// --- The state, whatever happened

const JSON_LIMIT = 3000
const ID_SPACE = 2 ** 32

function checkState(at: string, state: State, expectedCensus: string): void {
  for (const problem of problems(state)) flag("state", problem, at)
  const json = JSON.stringify(state)
  check("state", "the state does not come back from JSON as it went in", isDeepStrictEqual(JSON.parse(json), state), () => at)
  check("state", `the state is longer than ${JSON_LIMIT} characters`, json.length < JSON_LIMIT, () => `${at}: ${json.length}`)
  check("state", "cards were lost or made up", census(state) === expectedCensus, () => at)
  const alive = living(state)
  check("state", "the Kittens in play are not the players left minus one", kittensInPlay(state) === alive.length - 1, () => `${at}: ${kittensInPlay(state)} Kittens for ${alive.length} players`)

  const over = state.phase.kind === "over"
  check("state", "isOver is not the over phase", GAME.isOver(state) === over, () => at)
  check("state", "the game is over without one player left, or the other way round", over === (alive.length === 1), () => at)
  const waiting = waitingExpected(state)
  check("state", "waitingFor is not who the phase waits for", isDeepStrictEqual(GAME.waitingFor!(state), waiting), () => `${at}: ${GAME.waitingFor!(state).join()} instead of ${waiting.join()}`)
  check("state", "waitingPlayers is not who the phase waits for", isDeepStrictEqual(waitingPlayers(GAME, state), waiting), () => at)
}

// --- A lean state

const STATE_KEYS = ["attacked", "deck", "discard", "hands", "ids", "idsRng", "known", "options", "out", "owed", "phase", "rng", "seats", "stats", "turn"]
/** The only places of a state where a string may be: the players, and the kinds of the phases. Everything else is a number. */
const STRING_PATHS = /^(seats\.\d+|out\.\d+|phase\.kind|phase\.pending\.(kind|by|target|named)|phase\.nopes\.\d+\.by|phase\.from|phase\.to)$/
/** Display data has no place in a state: these names would mean a log, a face or a text was stored in it. */
const FORBIDDEN_KEYS = new Set(["log", "events", "event", "faces", "face", "titles", "title", "names", "name", "types", "type", "nicknames", "nickname", "text", "label"])

function walk(value: unknown, path: string, onLeaf: (path: string, leaf: unknown) => void, onKey: (path: string, key: string) => void): void {
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, path === "" ? `${index}` : `${path}.${index}`, onLeaf, onKey))
  else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      onKey(path, key)
      walk(item, path === "" ? key : `${path}.${key}`, onLeaf, onKey)
    }
  } else onLeaf(path, value)
}

function checkLean(at: string, state: State): void {
  check("lean", "the state has other keys than the ones of the design", isDeepStrictEqual(Object.keys(state).sort(), STATE_KEYS), () => `${at}: ${Object.keys(state).join()}`)
  check("lean", "known holds somebody who is not at the table", Object.keys(state.known).every((id) => state.seats.includes(id)), () => at)
  if (state.phase.kind === "reaction") {
    const { passed } = state.phase
    check("lean", "the passes hold somebody who is not at the table", Object.keys(passed).every((id) => state.seats.includes(id)), () => at)
  }
  walk(
    state,
    "",
    (path, leaf) => {
      if (path.startsWith("options.")) check("lean", "an option that is not a flag", typeof leaf === "boolean", () => `${at}: ${path}`)
      else if (typeof leaf === "string") check("lean", "a string where the state holds ids and numbers", STRING_PATHS.test(path), () => `${at}: ${path}`)
      else if (typeof leaf === "number") check("lean", "a number that is not a whole number below 2^32", Number.isInteger(leaf) && leaf >= 0 && leaf < ID_SPACE, () => `${at}: ${path} = ${leaf}`)
      else if (typeof leaf === "boolean") check("lean", "a flag outside attacked and the passes", path === "attacked" || /^phase\.passed\./.test(path), () => `${at}: ${path}`)
      else check("lean", "a null outside the open passes", leaf === null && /^phase\.passed\./.test(path), () => `${at}: ${path} = ${String(leaf)}`)
    },
    (path, key) => check("lean", `a key named like display data`, !FORBIDDEN_KEYS.has(key), () => `${at}: ${path}.${key}`),
  )
}

// --- What each viewer is shown

const VIEW_KEYS = ["attacked", "deck", "discard", "me", "options", "out", "owed", "phase", "players", "results", "turn"]

/** A view without what belongs to the viewer: the same for everybody. */
function publicPart(view: PlayerView): unknown {
  const phase: Record<string, unknown> = { ...view.phase }
  delete phase.passed
  return { ...view, me: null, phase }
}

/** Every face and every number in a value. */
function collect(value: unknown, faces: Face[], numbers: number[]): void {
  if (typeof value === "number") numbers.push(value)
  else if (Array.isArray(value)) for (const item of value) collect(item, faces, numbers)
  else if (typeof value === "object" && value !== null) {
    const { id, type } = value as { id?: unknown; type?: unknown }
    if (typeof id === "number" && typeof type === "string") faces.push(value as Face)
    for (const item of Object.values(value)) collect(item, faces, numbers)
  }
}

function checkViews(at: string, state: State): void {
  const alive = living(state)
  const over = state.phase.kind === "over"
  const spectator = viewOf(state, null)
  const table = publicPart(spectator)

  // The table, as the state says it is
  const shown = {
    options: spectator.options,
    players: spectator.players,
    deck: spectator.deck,
    discard: spectator.discard,
    turn: spectator.turn,
    owed: spectator.owed,
    attacked: spectator.attacked,
    out: spectator.out,
  }
  const real = {
    options: state.options,
    players: state.seats.map((id, seat) => ({ id, cards: state.hands[seat]!.length, alive: alive.includes(id) })),
    deck: state.deck.length,
    discard: state.discard.map((id) => ({ id, type: t(state, id) })),
    turn: over ? null : state.seats[state.turn],
    owed: state.owed,
    attacked: state.attacked,
    out: state.out,
  }
  check("view", "the table shown is not the table", isDeepStrictEqual(shown, real), () => at)
  check("view", "the results are shown while the game is on, or not when it is over", (spectator.results === null) === !over, () => at)
  check("view", "a spectator has a hand", spectator.me === null, () => at)
  check("view", "a view has other keys than the ones of the design", isDeepStrictEqual(Object.keys(spectator).sort(), VIEW_KEYS), () => `${at}: ${Object.keys(spectator).join()}`)
  check("view", "a view does not come back from JSON as it went in", isDeepStrictEqual(JSON.parse(JSON.stringify(spectator)), spectator), () => at)

  // Nothing of what is hidden is in the table: every face is a card on the discard (or the Kitten in the air) and is what it says,
  // and no number of the table is the id of a card that nobody may see
  const allowed = new Set([...state.discard, ...inTheAir(state)])
  const faces: Face[] = []
  const numbers: number[] = []
  collect(spectator, faces, numbers)
  for (const face of faces) {
    check("hidden", "the table shows a card that is hidden", allowed.has(face.id), () => `${at}: ${JSON.stringify(face)}`)
    check("hidden", "the table names a card as something else", t(state, face.id) === face.type, () => `${at}: ${JSON.stringify(face)} is ${t(state, face.id)}`)
  }
  for (const number of numbers) {
    check("hidden", "the table holds the id of a card nobody may see", number < 100 || allowed.has(number), () => `${at}: ${number}`)
  }

  // Each viewer: the same table, plus what is theirs
  for (const viewer of [...state.seats, "zoe"]) {
    const view = viewOf(state, viewer)
    const { phase } = state
    check("hidden", `the table depends on who looks (${viewer})`, isDeepStrictEqual(publicPart(view), table), () => at)
    check("view", "a view has other keys than the ones of the design", isDeepStrictEqual(Object.keys(view).sort(), VIEW_KEYS), () => `${at}: ${Object.keys(view).join()}`)
    if (phase.kind === "reaction" && Object.hasOwn(phase.passed, viewer)) {
      check("view", "a responder is not told whether they passed", view.phase.kind === "reaction" && view.phase.passed === (phase.passed[viewer] === true), () => `${at} ${viewer}`)
    } else {
      check("hidden", "somebody who is not answering a window is told about passes", !("passed" in view.phase), () => `${at} ${viewer}`)
    }
    if (!alive.includes(viewer)) {
      check("view", "a player who is out, or a stranger, has a hand", view.me === null, () => `${at} ${viewer}`)
      continue
    }
    const hand = handIn(state, viewer)
    const top = state.deck.slice(0, state.known[viewer] ?? 0)
    const face = (id: number): Face => ({ id, type: t(state, id) })
    check(
      "view",
      "the hand or the known top of the pile of a player is wrong",
      view.me !== null &&
        isDeepStrictEqual(Object.keys(view.me).sort(), ["hand", "id", "top"]) &&
        view.me.id === viewer &&
        isDeepStrictEqual(view.me.hand, hand.map(face)) &&
        isDeepStrictEqual(view.me.top, top.map(face)),
      () => `${at} ${viewer}`,
    )
  }
}

// --- The log, for each viewer

const SECRET_KEYS = ["card", "cards", "position"]

/** Who may see the full event, from its kind alone: `undefined` when everybody does. */
function audienceOf(event: EkEvent): string[] | undefined {
  switch (event.kind) {
    case "draw":
    case "reinserted":
    case "see":
      return [event.by]
    case "give":
      return [event.from, event.to]
    case "steal":
      return [event.by, event.from]
    case "named":
      return event.hit ? [event.by, event.from] : undefined
    default:
      return undefined
  }
}

function checkLog(move: Moved): void {
  const { before, after, entries } = move
  const ok = checker("log", move)
  const allowed = new Set([...after.discard, ...inTheAir(after)])

  for (const entry of entries) {
    const { event } = entry
    const audience = audienceOf(event)
    ok(`a ${event.kind} goes to the wrong players`, isDeepStrictEqual(entry.to === undefined ? undefined : [...entry.to].sort(), audience?.sort()))
    ok(`a ${event.kind} has the wrong masked version`, entry.to === undefined ? entry.masked === undefined : entry.masked !== undefined && entry.masked.kind === event.kind && SECRET_KEYS.every((key) => !(key in entry.masked!)))
    if (entry.to !== undefined) continue
    // What everybody sees is on the table: on the discard, or in the air. The card of a pick has just left the discard: it is the
    // one thing a public event shows that is hidden again (under a new id) as soon as the step ends
    const faces: Face[] = []
    collect(event, faces, [])
    for (const face of faces) {
      if (event.kind === "pick") {
        ok("a public pick shows the card under the id it still holds", !after.ids.includes(face.id) && face.type === t(before, face.id))
      } else {
        ok(`a public ${event.kind} shows a card nobody may see`, allowed.has(face.id) && face.type === t(after, face.id), () => JSON.stringify(face))
      }
    }
  }

  // What each viewer is given: the full event for the players it is meant for, the masked one for everybody else, nothing lost
  for (const viewer of [...after.seats, null, "zoe"]) {
    const given = viewLog(entries, viewer)
    ok("a viewer is given fewer events than happened", given.length === entries.length, () => `${viewer}`)
    given.forEach((event, index) => {
      const entry = entries[index]!
      const entitled = entry.to === undefined || (viewer !== null && entry.to.includes(viewer))
      ok(`a viewer is given the wrong version of a ${entry.event.kind}`, event === (entitled ? entry.event : entry.masked), () => `${viewer}`)
    })
  }
}

// --- One move of the game

const lower = (known: Record<string, number>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(known)
      .filter(([, n]) => n > 1)
      .map(([id, n]) => [id, n - 1]),
  )

/** Turns, owed turns and who plays next. */
function checkFlow(move: Moved): void {
  const { before, after, events } = move
  const ok = checker("flow", move)
  const over = after.phase.kind === "over"

  ok("the seats or the options changed", isDeepStrictEqual(after.seats, before.seats) && isDeepStrictEqual(after.options, before.options))
  ok("the number of cards changed", after.ids.length === before.ids.length)

  const exploded = eventsOf(events, "exploded")
  const left = after.out.length - before.out.length
  ok("the players out are not kept in the order they left", isDeepStrictEqual(after.out.slice(0, before.out.length), before.out))
  ok("a player left without an exploded event, or the other way round", left === exploded.length && left <= 1)

  const turns = eventsOf(events, "turn")
  const changed = after.turn !== before.turn || after.owed !== before.owed || after.attacked !== before.attacked
  ok("more than one turn event in a step", turns.length <= 1)
  ok("the turn changed without a turn event, or the other way round", changed === (turns.length === 1))
  ok("a turn event in the step that ends the game", !over || turns.length === 0)
  const turn = turns[0]
  if (turn !== undefined) ok("the turn event does not say who plays now and for how long", turn.player === after.seats[after.turn] && turn.owed === after.owed)

  const attacks = eventsOf(events, "attack")
  ok("more than one Attack in a step", attacks.length <= 1)
  const attack = attacks[0]
  if (attack !== undefined) {
    const next = before.seats[nextAlive(before, before.turn)]
    ok("an Attack from somebody who does not play", attack.by === before.seats[before.turn])
    ok("an Attack does not owe two turns more than there were", attack.owed === (before.attacked ? before.owed + 2 : 2))
    ok("after an Attack the state does not owe what the event says", after.owed === attack.owed && after.attacked)
    ok("an Attack does not go to the next player left", attack.next === next && after.seats[after.turn] === next)
  } else if (changed && !over) {
    if (after.turn === before.turn) {
      ok("a player's turn went down by other than one", before.owed > 1 && after.owed === before.owed - 1 && after.attacked === before.attacked)
    } else {
      ok("the turn went to the wrong player", after.turn === nextAlive(after, before.turn))
      ok("a turn that is passed on does not start single", after.owed === 1 && !after.attacked)
    }
  }

  const drawn = eventsOf(events, "draw").length + eventsOf(events, "kitten").length
  ok("the draw pile did not change by what was drawn and put back", after.deck.length - before.deck.length === -drawn + eventsOf(events, "reinserted").length)
}

/** The Exploding Kitten, the Defuse and the elimination. */
function checkKitten(move: Moved): void {
  const { before, after, events } = move
  const ok = checker("kitten", move)
  const kittens = eventsOf(events, "kitten")
  const defused = eventsOf(events, "defused")
  const exploded = eventsOf(events, "exploded")
  ok("more than one card drawn in a step", eventsOf(events, "draw").length + kittens.length <= 1)

  const kitten = kittens[0]
  if (kitten === undefined) {
    ok("a Defuse or an explosion without a Kitten", defused.length === 0 && exploded.length === 0)
    return
  }
  const seat = before.turn
  const drawer = before.seats[seat]!
  const hand = before.hands[seat]!
  ok("the Kitten is not the top card of the pile", kitten.card.id === before.deck[0] && kitten.card.type === "exploding-kitten")
  ok("the Kitten is drawn by somebody who does not play", kitten.by === drawer)

  if (hand.some((id) => t(before, id) === "defuse")) {
    ok("a player who held a Defuse did not defuse just once", defused.length === 1 && exploded.length === 0)
    const d = defused[0]
    if (d === undefined) return
    ok("the Defuse was not the drawer's", d.by === drawer && hand.includes(d.card.id) && d.card.type === "defuse")
    ok("the Defuse is not on top of the discard", after.discard[0] === d.card.id)
    ok("the hand lost something else than the Defuse", isDeepStrictEqual(after.hands[seat], hand.filter((id) => id !== d.card.id)))
    ok(
      "the Kitten is not held out for its owner",
      after.phase.kind === "defuse" && after.phase.kitten === kitten.card.id && !after.deck.includes(kitten.card.id) && !after.discard.includes(kitten.card.id),
    )
  } else {
    ok("a player without a Defuse did not explode just once", exploded.length === 1 && defused.length === 0)
    const e = exploded[0]
    if (e === undefined) return
    const ids = e.cards.map((card) => card.id)
    ok("the explosion is not the drawer's", e.by === drawer && after.out.at(-1) === drawer)
    ok("the Kitten is not the last card of the explosion", ids.at(-1) === kitten.card.id)
    ok("the exploded cards are not the hand of the player and the Kitten", isDeepStrictEqual(ids.slice(0, -1).sort(), [...hand].sort()))
    ok("the exploded cards are not on the discard, the last one on top", isDeepStrictEqual(after.discard.slice(0, ids.length), [...ids].reverse()))
    ok("the exploded cards are not what the event says", e.cards.every((card) => card.type === t(before, card.id)))
    ok("the player who exploded still holds cards", after.hands[seat]!.length === 0)
  }
}

/** The Nope window: how it opens, how the chain grows, how it closes. */
function checkWindow(move: Moved): void {
  const { before, after, events, action } = move
  const ok = checker("window", move)
  const nopes = eventsOf(events, "nope")
  const resolved = eventsOf(events, "resolved")
  const cancelled = eventsOf(events, "cancelled")
  const played = eventsOf(events, "play").length + eventsOf(events, "combo").length
  const was = before.phase
  const is = after.phase
  ok("more than one card played in a step", played <= 1)

  if (was.kind !== "reaction") {
    ok("a Nope, or a window closing, without a window", nopes.length === 0 && resolved.length === 0 && cancelled.length === 0)
    if (is.kind === "reaction") {
      ok("a window opens without a card played", played === 1)
      ok("a window opens with Nopes or passes already in it", is.nopes.length === 0 && Object.values(is.passed).every((passed) => passed === null))
      ok("a window opens on somebody who does not play", is.pending.by === before.seats[before.turn])
      const cards = is.pending.kind === "card" ? [is.pending.card] : is.pending.cards
      ok("the cards of the window are not on top of the discard", isDeepStrictEqual(after.discard.slice(0, cards.length).sort(), [...cards].sort()))
    } else {
      ok("a card is played without a window", played === 0)
    }
    return
  }

  ok("a card is played while a window is open", played === 0)
  if (is.kind === "reaction") {
    ok("the action behind the window changed", isDeepStrictEqual(is.pending, was.pending))
    const trues = (passed: Record<string, true | null>): number => Object.values(passed).filter((value) => value === true).length
    if (nopes.length > 0) {
      const last = is.nopes.at(-1)
      ok("a step played more than one Nope", nopes.length === 1)
      ok("the chain did not grow by that one Nope", is.nopes.length === was.nopes.length + 1 && last?.card === nopes[0]!.card.id && last.by === nopes[0]!.by)
      ok("a Nope is not on top of the discard", after.discard[0] === nopes[0]!.card.id)
      ok("a Nope leaves passes behind", trues(is.passed) === 0)
      if (action !== null) ok("the Nope is not by the player who sent it", nopes[0]!.by === action.playerId)
    } else {
      ok("a pass changed the chain", is.nopes.length === was.nopes.length)
      ok("a pass did not add exactly one pass", trues(is.passed) === trues(was.passed) + 1)
      if (action !== null) ok("the player who passed is not marked", is.passed[action.playerId] === true)
    }
    return
  }

  // The window closed, and never on a Nope: it waits for a responder who is not the author of the last Nope
  ok("a window closed on a Nope", nopes.length === 0)
  const odd = was.nopes.length % 2 === 1
  ok("the window did not close the way its chain says", odd ? cancelled.length === 1 && resolved.length === 0 : resolved.length === 1 && cancelled.length === 0, () => `${was.nopes.length} Nopes`)
  ok("the window closed for somebody who did not play the card", (odd ? cancelled : resolved)[0]?.by === was.pending.by)
}

/** Each card does what its event says: it moves from where it was to where it goes, and no other. */
function checkCards(move: Moved): void {
  const { before, after, events } = move
  const ok = checker("cards", move)
  const was = before.phase

  // What the players know of the top of the pile, step by step
  let known: Record<string, number> = { ...before.known }

  for (const event of events) {
    switch (event.kind) {
      case "draw": {
        const id = event.card?.id
        ok("a draw does not show the card of the top of the pile", id !== undefined && id === before.deck[0] && event.card?.type === t(after, id))
        ok("the card drawn is not in the hand of the player", id !== undefined && handIn(after, event.by).includes(id))
        known = lower(known)
        break
      }
      case "kitten":
        known = lower(known)
        break
      case "exploded":
        delete known[event.by]
        break
      case "steal": {
        const card = event.card
        ok(
          "a steal is not by the author of a pair, against the target of the pair",
          was.kind === "reaction" && was.pending.kind === "combo" && was.pending.cards.length === 2 && was.pending.by === event.by && was.pending.target === event.from,
        )
        if (card === undefined) {
          ok("a steal without its card", false)
          break
        }
        ok("the stolen card was not in the hand of the victim", handIn(before, event.from).includes(card.id) && card.type === t(before, card.id))
        ok("the stolen card did not move, with its id, to the thief", handIn(after, event.by).includes(card.id) && !handIn(after, event.from).includes(card.id))
        ok(
          "a steal moved other than one card",
          handIn(after, event.from).length === handIn(before, event.from).length - 1 && handIn(after, event.by).length === handIn(before, event.by).length + 1,
        )
        break
      }
      case "named": {
        ok(
          "a named is not by the author of a triple, against its target and its title",
          was.kind === "reaction" &&
            was.pending.kind === "combo" &&
            was.pending.cards.length === 3 &&
            was.pending.by === event.by &&
            was.pending.target === event.from &&
            was.pending.named === event.title,
        )
        if (!event.hit) {
          ok("a miss while the victim held the card", !handIn(before, event.from).some((id) => t(before, id) === event.title))
          ok("a miss moved cards, or shows one", isDeepStrictEqual(after.hands, before.hands) && event.card === undefined)
          break
        }
        const card = event.card
        if (card === undefined) {
          ok("a hit without its card", false)
          break
        }
        ok("the card of a hit is not the title asked for, from the victim", card.type === event.title && handIn(before, event.from).includes(card.id) && t(before, card.id) === event.title)
        ok("the card of a hit did not move, with its id, to the thief", handIn(after, event.by).includes(card.id) && !handIn(after, event.from).includes(card.id))
        ok(
          "a hit moved other than one card",
          handIn(after, event.from).length === handIn(before, event.from).length - 1 && handIn(after, event.by).length === handIn(before, event.by).length + 1,
        )
        break
      }
      case "give": {
        const card = event.card
        ok("a give outside a Favor, or between other players", was.kind === "give" && was.from === event.from && was.to === event.to)
        if (card === undefined) {
          ok("a give without its card", false)
          break
        }
        ok("the card given was not in the hand of the giver", handIn(before, event.from).includes(card.id) && card.type === t(before, card.id))
        ok("the card given did not move, with its id, to the other player", handIn(after, event.to).includes(card.id) && !handIn(after, event.from).includes(card.id))
        ok("a give moved other than one card", handIn(after, event.from).length === handIn(before, event.from).length - 1 && handIn(after, event.to).length === handIn(before, event.to).length + 1)
        break
      }
      case "pick": {
        const seat = before.seats.indexOf(event.by)
        const was = before.phase
        ok("a pick outside the phase, or by somebody who does not play", before.phase.kind === "pick" && event.by === before.seats[before.turn])
        ok("the card picked was not on the discard", before.discard.includes(event.card.id) && event.card.type === t(before, event.card.id))
        ok("the card picked is still on the discard", !after.discard.includes(event.card.id))
        ok("the card picked is not hidden under a new id", !after.ids.includes(event.card.id))
        ok("the card picked is one of the five just played, or a Kitten", was.kind === "pick" && !was.played.includes(event.card.id) && event.card.type !== "exploding-kitten")
        const gained = (after.hands[seat] ?? []).filter((id) => !(before.hands[seat] ?? []).includes(id))
        ok("the picker does not hold exactly one new card", gained.length === 1 && (after.hands[seat] ?? []).length === (before.hands[seat] ?? []).length + 1)
        ok("the new card is not what was picked", gained.length === 1 && t(after, gained[0]!) === event.card.type)
        ok("the discard lost other than one card", after.discard.length === before.discard.length - 1)
        break
      }
      case "see": {
        const count = Math.min(3, before.deck.length)
        ok("a see counts other than the top three cards", event.count === count)
        ok(
          "a see does not show the top cards of the pile",
          isDeepStrictEqual(event.cards?.map((card) => card.id), after.deck.slice(0, count)) && (event.cards ?? []).every((card) => card.type === t(after, card.id)),
        )
        if (event.count > 0) known[event.by] = event.count
        else delete known[event.by]
        break
      }
      case "shuffle": {
        const old = new Set(before.deck)
        ok("a shuffle kept the ids of the cards", after.deck.length === before.deck.length && after.deck.every((id) => !old.has(id)))
        ok("a shuffle changed the cards of the pile", isDeepStrictEqual(before.deck.map((id) => t(before, id)).sort(), after.deck.map((id) => t(after, id)).sort()))
        known = {}
        break
      }
      case "reinserted": {
        const position = event.position
        ok("a Kitten goes back outside the defuse phase", was.kind === "defuse")
        ok("a Kitten goes back at a place the pile does not have", position !== undefined && Number.isInteger(position) && position >= 0 && position <= before.deck.length)
        if (position !== undefined && was.kind === "defuse") {
          ok("the Kitten is not at the position of the event", t(after, after.deck[position]!) === "exploding-kitten")
          ok("another card moved when the Kitten went back", isDeepStrictEqual(after.deck.filter((_, index) => index !== position), before.deck))
          ok("the Kitten kept its id", !after.ids.includes(was.kitten) && after.deck[position] !== was.kitten)
          const n = Math.min(before.known[event.by] ?? 0, position)
          known = n > 0 ? { [event.by]: n } : {}
        }
        break
      }
    }
  }
  ok("what the players know of the top of the pile is not what the cards say", isDeepStrictEqual(known, after.known), () => `${JSON.stringify(after.known)} instead of ${JSON.stringify(known)}`)
}

/** A stored copy of the state, with its keys in another order and frozen, plays the move to the same state. */
function checkReplay(move: Moved): void {
  const ok = checker("replay", move)
  try {
    const stored = deepFreeze(reorderKeys(JSON.parse(JSON.stringify(move.before)) as State))
    const next =
      move.action === null
        ? playFor(GAME, stored, waitingPlayers(GAME, stored)[0]!)
        : GAME.apply(stored, JSON.parse(JSON.stringify(move.action)) as Action)
    ok("a stored copy of the state does not replay the move to the same state", isDeepStrictEqual(next, move.after))
  } catch (error) {
    ok("a stored copy of the state does not replay the move", false, () => String(error))
  }
}

// --- A whole game

function checkGame(label: string, end: State, events: EkEvent[]): void {
  const ok = (name: string, condition: boolean, more?: () => string): void => {
    if (!condition) flag("game", name, `${label}${more ? ` — ${more()}` : ""}`)
  }
  const n = end.seats.length
  const survivors = living(end)
  ok("the game does not end with one player left", end.phase.kind === "over" && survivors.length === 1)
  const overs = eventsOf(events, "over")
  ok("there is not exactly one over event, at the end", overs.length === 1 && events.at(-1)?.kind === "over")
  ok("the winner is not the player who is left", overs[0]?.winner === survivors[0])

  const exploded = eventsOf(events, "exploded")
  ok("the players who exploded are not the players out, in order", isDeepStrictEqual(exploded.map((event) => event.by), end.out))
  ok("not every player but one exploded", exploded.length === n - 1)
  const defused = eventsOf(events, "defused").length
  ok("the Kittens drawn are not the Kittens defused plus the explosions", eventsOf(events, "kitten").length === defused + exploded.length)
  ok("the Kittens put back are not the Kittens defused", eventsOf(events, "reinserted").length === defused)
  ok(
    "the cards played are not the windows closed",
    eventsOf(events, "play").length + eventsOf(events, "combo").length === eventsOf(events, "resolved").length + eventsOf(events, "cancelled").length,
  )

  // The stats of the end screen count what the log says happened
  end.seats.forEach((id, seat) => {
    const stats = end.stats[seat]!
    const count = (kind: "reinserted" | "nope" | "draw" | "skip" | "attack"): number => eventsOf(events, kind).filter((event) => event.by === id).length
    ok(`defused of ${id}`, stats.defused === count("reinserted"))
    ok(`nopes of ${id}`, stats.nopes === count("nope"))
    // A turn ends with a card drawn, a Kitten put back, a Skip or an Attack; the turn in which a player explodes is not counted
    ok(`turns of ${id}`, stats.turns === count("draw") + count("reinserted") + count("skip") + count("attack"), () => `${stats.turns}`)
  })

  const results = viewOf(end, null).results
  ok("a finished game has no results", results !== null)
  if (results === null) return
  const survivor = survivors[0]!
  ok("the winners are not the player who is left", isDeepStrictEqual(results.winners, [survivor]))
  ok("the ranking is not the winner, then the players out from the last", isDeepStrictEqual(results.players.map((player) => player.playerId), [survivor, ...[...end.out].reverse()]))
  ok("the ranks are not 1 to n", isDeepStrictEqual(results.players.map((player) => player.rank), Array.from({ length: n }, (_, index) => index + 1)))
  ok("the totals do not add up to the opponents outlasted", results.players.reduce((sum, player) => sum + player.total, 0) === (n * (n - 1)) / 2)
  for (const player of results.players) {
    const stats = end.stats[end.seats.indexOf(player.playerId)]!
    ok(
      `the detail of ${player.playerId}`,
      isDeepStrictEqual(
        player.detail.map(({ key, points }) => [key, points]),
        [["outlasted", player.total], ["turnsSurvived", stats.turns], ["kittensDefused", stats.defused], ["nopesPlayed", stats.nopes]],
      ),
    )
  }
}

// --- Junk: what a client could send that no player would

/** Names that are not players, and keys an object already has. */
const NAMES = ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf", "", "zoe"]
/** What goes where an id, a player or a number is expected, and should not. */
const ODD: readonly unknown[] = [NaN, Infinity, -Infinity, -0, 0, 1, -1, 1.5, 2 ** 32, 2 ** 53, "12", true, false, null, undefined, [], {}, [1, 2], { id: 1, type: "nope" }, ...NAMES]
/** What comes instead of an action. */
const NOT_AN_ACTION: readonly unknown[] = [null, undefined, 0, 7, "play", true, [], [{ type: "draw" }], {}]
const FIELDS = ["card", "cards", "target", "named", "chain", "position"] as const
const TITLES = [...Object.keys(ORIGINAL_RULES.cards), "xyz"]

/** What a phase invites. It only steers the junk towards actions that may be accepted: the engine alone judges them. */
const INVITED: Record<Phase["kind"], readonly string[]> = {
  turn: ["draw", "play", "combo"],
  reaction: ["nope", "pass"],
  defuse: ["defuse"],
  give: ["give"],
  pick: ["pick"],
  over: CLIENT_ACTIONS,
}

/** The cards a junk action may name, by where they are: in the hand of whoever the game waits for, in any hand, on top of the deck, in the discard. */
type Table = { state: State; waiting: string[]; pools: number[][] }

function tableAt(state: State): Table {
  const waiting = waitingPlayers(GAME, state)
  const own = waiting.flatMap((id) => state.hands[state.seats.indexOf(id)] ?? [])
  return { state, waiting, pools: [own, state.hands.flat(), state.deck.slice(0, 4), state.discard].filter((pool) => pool.length > 0) }
}

/** A card of a pool chosen first, so that a hand is named as often as the discard, however many cards each holds. */
function cardFrom({ pools }: Table, rng: Rng): number {
  return pools.length > 0 ? oneOf(oneOf(pools, rng), rng) : 0
}

/** A value for a field of an action: mostly what the field holds in a real action, now and then something else. */
function valueFor(field: (typeof FIELDS)[number], table: Table, rng: Rng): unknown {
  const { state } = table
  if (rng() < 0.2) return oneOf(ODD, rng)
  switch (field) {
    case "card":
      return cardFrom(table, rng)
    case "cards":
      return Array.from({ length: Math.floor(rng() * 7) }, () => (rng() < 0.9 ? cardFrom(table, rng) : oneOf(ODD, rng)))
    case "target":
      return oneOf(state.seats, rng)
    case "named":
      return oneOf(TITLES, rng)
    case "chain":
      return (state.phase.kind === "reaction" ? state.phase.nopes.length : 0) + oneOf([-1, 0, 0, 0, 1], rng)
    case "position":
      return Math.floor(rng() * (state.deck.length + 3)) - 1
  }
}

/** A real action with one field gone, or replaced by something no client should send. */
function corrupt(action: unknown, rng: Rng): unknown {
  if (typeof action !== "object" || action === null || Array.isArray(action)) return action
  const fields = Object.keys(action)
  if (fields.length === 0) return action
  const copy: Record<string, unknown> = { ...action }
  const field = oneOf(fields, rng)
  if (rng() < 0.25) delete copy[field]
  else copy[field] = oneOf(ODD, rng)
  return copy
}

/** Mostly a real action spoilt in one place; the rest made of whatever fits the fields, or of nothing at all. */
function junkAction(table: Table, rng: Rng): unknown {
  const { state, waiting } = table
  const roll = rng()
  if (roll < 0.05) return oneOf(NOT_AN_ACTION, rng)
  if (roll < 0.45) return corrupt(randomAction(state, rng), rng)
  const kinds = rng() < 0.5 ? INVITED[state.phase.kind] : CLIENT_ACTIONS
  const action: Record<string, unknown> = {
    type: rng() < 0.85 ? oneOf(kinds, rng) : oneOf(ODD, rng),
    playerId: rng() < 0.6 && waiting.length > 0 ? oneOf(waiting, rng) : rng() < 0.85 ? oneOf([...state.seats, "zoe"], rng) : oneOf(ODD, rng),
  }
  const kind = actionKind(action)
  for (const field of FIELDS) {
    const read = kind !== null && READS[kind].includes(field)
    if (rng() < (read ? 0.8 : 0.3)) action[field] = valueFor(field, table, rng)
  }
  if (rng() >= 0.4) return action
  // `__proto__` and `constructor` among the keys of the action, the way JSON reads them: own keys, not the prototype of the object
  const body = JSON.stringify(action)
  const extra = '"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}'
  return JSON.parse(body === "{}" ? `{${extra}}` : `${body.slice(0, -1)},${extra}}`)
}

/** What came of a try: the new state, the code of the refusal, or a crash (anything the engine did not refuse on purpose). */
type Outcome = { code: string } | { crash: string } | { state: State }

function attempt(run: () => State): Outcome {
  try {
    return { state: run() }
  } catch (error) {
    return isEngineError(error) ? { code: error.code } : { crash: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }
}

const outcomeOf = (state: State, action: unknown): Outcome => attempt(() => GAME.apply(state, action as Action))

function stepOf(state: State, action: unknown): Step | null {
  try {
    return step(ORIGINAL_RULES, state, action as Action)
  } catch {
    return null
  }
}

/** The kind of a client action, `null` for anything else. */
function actionKind(action: unknown): Action["type"] | null {
  if (typeof action !== "object" || action === null || Array.isArray(action)) return null
  const { type } = action as { type?: unknown }
  return typeof type === "string" && (CLIENT_ACTIONS as readonly string[]).includes(type) ? (type as Action["type"]) : null
}

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value)

/** The fields each kind of action reads. The engine ignores the others: an action must be answered the same with or without them. */
const READS: Record<Action["type"], readonly string[]> = {
  play: ["card", "target"],
  combo: ["cards", "target", "named"],
  nope: ["card", "chain"],
  pass: ["chain"],
  draw: [],
  defuse: ["position"],
  give: ["card"],
  pick: ["card"],
}

/** The action with the fields the engine reads and no others: the kind, the player, and the fields of the kind. */
function canonical(action: unknown): unknown {
  const kind = actionKind(action)
  if (kind === null) return action
  const raw = action as Record<string, unknown>
  const out: Record<string, unknown> = { type: kind, playerId: raw.playerId }
  for (const field of READS[kind]) if (raw[field] !== undefined) out[field] = raw[field]
  return out
}

/**
 * What an accepted action must at least look like, as necessary conditions only: a player the game waits for, whole numbers where
 * there are cards, a title the edition has for three of a kind. The rules are not written a second time.
 */
function wellFormed(action: unknown, { waiting }: Table): boolean {
  const kind = actionKind(action)
  if (kind === null) return false
  const raw = action as Record<string, unknown>
  if (typeof raw.playerId !== "string" || !waiting.includes(raw.playerId)) return false
  switch (kind) {
    case "draw":
      return true
    case "pass":
      return isInt(raw.chain)
    case "nope":
      return isInt(raw.card) && isInt(raw.chain)
    case "play":
    case "give":
    case "pick":
      return isInt(raw.card)
    case "defuse":
      return isInt(raw.position)
    case "combo": {
      const { cards, named } = raw
      if (!Array.isArray(cards) || !cards.every(isInt) || ![2, 3, 5].includes(cards.length)) return false
      return cards.length !== 3 || (typeof named === "string" && Object.hasOwn(ORIGINAL_RULES.cards, named))
    }
  }
}

/** A copy of the action with fields that its kind does not read, and one that nothing reads at all. */
function decorate(action: unknown, table: Table, rng: Rng): unknown {
  const kind = actionKind(action)
  if (kind === null) return action
  const copy: Record<string, unknown> = { ...(action as Record<string, unknown>) }
  for (const field of FIELDS) if (!READS[kind].includes(field) && rng() < 0.7) copy[field] = valueFor(field, table, rng)
  copy.note = "nothing reads this"
  return copy
}

const show = (value: unknown): string => inspect(value, { depth: 3, breakLength: Infinity }).slice(0, 200)

const junk = { actions: 0, accepted: new Map<string, number>(), refused: new Set<string>() }
const takeover = { played: new Map<string, number>(), refused: 0 }

const JUNK_PER_SAMPLE = 400
const ERROR_CODES: readonly string[] = EK_ERROR_CODES

/**
 * Gives every kept state junk. The state and the action are frozen, so a write is a crash. Whatever the engine answers must be the
 * same twice, must be a refusal with a code of the list, and must leave the prototypes alone. An action that is accepted must be one
 * a client could have sent, must change the state, must hold up under every check of the pass, and must be answered the same
 * without the fields the engine does not read. Real actions given such fields must be answered as before.
 */
function fuzz(): void {
  const rng = createRng(seedOf(11))
  everySample().forEach((sample, number) => {
    deepFreeze(sample)
    const kind = sample.phase.kind
    const table = tableAt(sample)
    const expectedCensus = census(sample)
    for (let i = 0; i < JUNK_PER_SAMPLE; i++) {
      const at = `junk ${kind}#${number}.${i}`

      if (kind !== "over") {
        const real = randomAction(sample, rng)
        const noisy = decorate(real, table, rng)
        deepFreeze(real)
        deepFreeze(noisy)
        const plain = outcomeOf(sample, real)
        const loud = outcomeOf(sample, noisy)
        if ("crash" in plain || "crash" in loud || !isDeepStrictEqual(plain, loud)) {
          flag("junk", "an answer changes with fields that nothing reads", `${at} ${show(noisy)} — ${show(plain)} then ${show(loud)}`)
        }
      }

      const action = deepFreeze(junkAction(table, rng))
      const here = (name: string, more = ""): void => flag("junk", name, `${at} ${show(action)}${more}`)
      junk.actions++
      const first = outcomeOf(sample, action)
      if (({} as Record<string, unknown>).polluted !== undefined) {
        here("the action polluted Object.prototype")
        delete (Object.prototype as Record<string, unknown>).polluted
      }
      if (!isDeepStrictEqual(first, outcomeOf(sample, action))) here("the same action gets two answers")
      if ("crash" in first) {
        here("the engine crashes instead of refusing", ` — ${first.crash}`)
        continue
      }
      if (kind === "over") {
        if (!("code" in first && first.code === "GAME_OVER")) here("a finished game answers something other than GAME_OVER", ` — ${show(first)}`)
        continue
      }

      const canon = canonical(action)
      if (actionKind(action) !== null && !isDeepStrictEqual(outcomeOf(sample, canon), first)) here("an answer changes with fields that nothing reads")
      if ("code" in first) {
        junk.refused.add(first.code)
        if (!ERROR_CODES.includes(first.code)) here("a refusal has a code that is not in the list", ` — ${first.code}`)
        continue
      }

      junk.accepted.set(kind, (junk.accepted.get(kind) ?? 0) + 1)
      if (!wellFormed(action, table)) here("an action that no client would send was accepted")
      if (isDeepStrictEqual(first.state, sample)) here("an accepted action changed nothing")
      const played = stepOf(sample, action)
      if (played === null) {
        here("step refuses what apply accepted")
        continue
      }
      if (!isDeepStrictEqual(played.state, first.state)) here("apply and step do not agree")
      const move: Moved = { at, before: sample, action: canon as Action, after: played.state, entries: played.events, events: played.events.map(({ event }) => event) }
      checkState(at, move.after, expectedCensus)
      checkLean(at, move.after)
      checkFlow(move)
      checkKitten(move)
      checkWindow(move)
      checkCards(move)
      checkReplay(move)
      checkLog(move)
      checkViews(at, move.after)
    }
  })
}

// --- The takeover, in every kept state

/** Asks the takeover to play for each player the game waits for, and for nobody else: not the other seats, not a stranger. */
function takeovers(): void {
  const strangers = ["zoe", "__proto__", "constructor", ""]
  everySample().forEach((sample, number) => {
    const at = `${sample.phase.kind}#${number}`
    const waiting = waitingPlayers(GAME, sample)
    const expectedCensus = census(sample)

    for (const id of waiting) {
      const outcome = attempt(() => playFor(GAME, sample, id))
      if (!("state" in outcome)) {
        flag("takeover", "the takeover cannot play for a player the game waits for", `${at} for ${id}: ${show(outcome)}`)
        continue
      }
      takeover.played.set(sample.phase.kind, (takeover.played.get(sample.phase.kind) ?? 0) + 1)
      const { state } = outcome
      for (const problem of problems(state)) flag("takeover", problem, `${at} for ${id}`)
      check("takeover", "cards were lost or made up", census(state) === expectedCensus, () => `${at} for ${id}`)
      check("takeover", "the takeover changed nothing", !isDeepStrictEqual(state, sample), () => `${at} for ${id}`)
      check("takeover", "the Nope window is still open after the takeover", sample.phase.kind !== "reaction" || state.phase.kind !== "reaction", () => `${at} for ${id}`)
      check("takeover", "autoPlayFor is not what playFor does", isDeepStrictEqual(attempt(() => GAME.autoPlayFor!(sample, id)), outcome), () => `${at} for ${id}`)
    }

    for (const id of [...sample.seats.filter((seat) => !waiting.includes(seat)), ...strangers]) {
      takeover.refused++
      for (const [name, run] of [
        ["playFor", () => playFor(GAME, sample, id)],
        ["autoPlayFor", () => GAME.autoPlayFor!(sample, id)],
      ] as const) {
        const outcome = attempt(run)
        check("takeover", `${name} does not refuse a player the game does not wait for with NOT_WAITING`, "code" in outcome && outcome.code === "NOT_WAITING", () => `${at} for "${id}": ${show(outcome)}`)
      }
    }
  })
}

// --- The pass: 200 games

const GAMES_PER_SIZE = 50
const SIZES = [2, 3, 4, 5]
const OPTION_SETS: readonly Record<string, boolean>[] = [{}, { fiveDifferent: false }, { classicDeal: true }, { fasterGame: true }, { classicDeal: true, fiveDifferent: false }]

/** The table of this game: the same for the pass and for the tests that play it again. */
function tableOf(size: number, index: number): { label: string; options: Record<string, boolean>; start: State } {
  const options = OPTION_SETS[index % OPTION_SETS.length]!
  return { label: `${size}p#${index} ${JSON.stringify(options)}`, options, start: newState(size, seedOf(size * 100 + index), options) }
}

/** Games with players who are away: their tables come after the others, and their seeds are not the seeds of the others. */
const AWAY_FROM = 1000
const AWAY_PER_SIZE = 20
const ABSENT = 0.3

/**
 * Plays one table to the end and checks every move. A player who is `absent` of the time leaves the move to the takeover; those
 * games are checked like the others and give states to the junk and the takeover, but the tally only counts the others.
 */
function playGame(size: number, index: number, absent = 0): void {
  const counted = absent === 0
  const table = tableOf(size, index)
  const label = counted ? table.label : `${table.label} away`
  const { start } = table
  const expectedCensus = census(start)
  checkState(`${label} start`, start, expectedCensus)
  checkLean(`${label} start`, start)
  checkViews(`${label} start`, start)
  if (counted) note(start)

  const events: EkEvent[] = []
  let moves = 0
  const result = playRandomly(
    start,
    seedOf(size * 1000 + index + (counted ? 0 : 50_000)),
    (played) => {
      moves++
      const entries = played.events
      const move: Moved = { at: `${label} #${moves}`, before: played.before, action: played.action, after: played.state, entries, events: entries.map(({ event }) => event) }
      events.push(...move.events)
      offer(played.before)
      if (counted) {
        note(played.state)
        if (played.action === null) tally.fallbacks++
        for (const event of move.events) {
          tally.kinds.add(event.kind)
          if (event.kind === "combo") tally.combos.add(event.cards.length)
          if (event.kind === "named") tally.named[event.hit ? "hit" : "miss"]++
        }
      }
      checkState(move.at, move.after, expectedCensus)
      checkLean(move.at, move.after)
      checkFlow(move)
      checkKitten(move)
      checkWindow(move)
      checkCards(move)
      checkReplay(move)
      checkLog(move)
      checkViews(move.at, move.after)
    },
    3000,
    absent,
  )
  offer(result.state)
  if (counted) {
    for (const code of Object.keys(result.refused)) tally.codes.add(code)
    tally.games++
    tally.moves += result.moves
  }
  checkGame(label, result.state, events)
}

const EVENT_KINDS = Object.keys({
  turn: 0, play: 0, combo: 0, nope: 0, resolved: 0, cancelled: 0, fizzled: 0, draw: 0, kitten: 0, defused: 0, reinserted: 0,
  exploded: 0, attack: 0, skip: 0, shuffle: 0, see: 0, ask: 0, give: 0, steal: 0, named: 0, pick: 0, over: 0,
} satisfies Record<EkEvent["kind"], 0>).sort()
const PHASE_KINDS = Object.keys({ turn: 0, reaction: 0, defuse: 0, give: 0, pick: 0, over: 0 } satisfies Record<Phase["kind"], 0>).sort()
/** Refusals that a game in progress cannot meet: the table is never too small, never over, and a Kitten is always in the pile. */
const NEVER_IN_A_RUNNING_GAME: readonly string[] = ["INVALID_PLAYERS", "GAME_OVER", "EMPTY_DECK"]

describe("whole games, played at random", () => {
  beforeAll(() => {
    for (const size of SIZES) for (let index = 0; index < GAMES_PER_SIZE; index++) playGame(size, index)
    for (const size of SIZES) for (let index = AWAY_FROM; index < AWAY_FROM + AWAY_PER_SIZE; index++) playGame(size, index, ABSENT)
    fuzz()
    takeovers()
  }, 120_000)

  it("plays every table to the end", () => {
    expect(tally.games).toBe(SIZES.length * GAMES_PER_SIZE)
    expect(tally.moves).toBeGreaterThan(0)
  })

  it("goes through every event, every phase, every combo and every refusal a running game has", () => {
    expect([...tally.kinds].sort()).toEqual(EVENT_KINDS)
    expect([...tally.phases].sort()).toEqual(PHASE_KINDS)
    expect([...tally.combos].sort()).toEqual([2, 3, 5])
    expect(tally.named.hit).toBeGreaterThan(0)
    expect(tally.named.miss).toBeGreaterThan(0)
    expect([...tally.codes].sort()).toEqual(EK_ERROR_CODES.filter((code) => !NEVER_IN_A_RUNNING_GAME.includes(code)).sort())
    expect(tally.maxChain).toBeGreaterThanOrEqual(3)
    expect(tally.maxOwed).toBeGreaterThanOrEqual(4)
    expect(tally.moves).toBeGreaterThan(10_000)
    expect(tally.fallbacks).toBeLessThan(tally.moves / 100)
  })

  it("keeps every state whole: cards, players, turns and who the game waits for", () => {
    expect(reportOf("state")).toEqual([])
  })

  it("keeps the state lean: ids and numbers, nothing to display", () => {
    expect(reportOf("lean")).toEqual([])
  })

  it("passes the turn to the right player, with the right number of turns owed", () => {
    expect(reportOf("flow")).toEqual([])
  })

  it("defuses or explodes a drawn Kitten as the hand says", () => {
    expect(reportOf("kitten")).toEqual([])
  })

  it("runs the Nope window by its chain", () => {
    expect(reportOf("window")).toEqual([])
  })

  it("moves every card where its event says, and tracks what is known of the top of the pile", () => {
    expect(reportOf("cards")).toEqual([])
  })

  it("replays every move from a stored copy of the state", () => {
    expect(reportOf("replay")).toEqual([])
  })

  it("shows each viewer the table, and their own hand and nothing else", () => {
    expect(reportOf("view")).toEqual([])
    expect(reportOf("hidden")).toEqual([])
  })

  it("tells each viewer of the log only what they may know", () => {
    expect(reportOf("log")).toEqual([])
  })

  it("adds up a whole game: events, stats, winner and ranking", () => {
    expect(reportOf("game")).toEqual([])
  })

  it("meets junk with a refusal, or with an action that holds up under every check", () => {
    expect(reportOf("junk")).toEqual([])
    expect(junk.actions).toBeGreaterThan(10_000)
    // Junk that is accepted in each phase is what proves the checks above ran on it
    for (const phase of PHASE_KINDS.filter((kind) => kind !== "over")) expect(junk.accepted.get(phase) ?? 0, `junk accepted in ${phase}`).toBeGreaterThan(0)
    expect(junk.refused.size).toBeGreaterThanOrEqual(10)
  })

  it("leaves Object.prototype alone", () => {
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.keys(Object.prototype)).toEqual([])
  })

  it("plays for each player the game waits for, and for nobody else", () => {
    expect(reportOf("takeover")).toEqual([])
    // Every kept state of a running game waits for somebody, so each is played for at least once; nobody is waited for once it is over
    for (const phase of PHASE_KINDS.filter((kind) => kind !== "over")) expect(takeover.played.get(phase) ?? 0, `played for in ${phase}`).toBeGreaterThanOrEqual(SAMPLES_PER_PHASE)
    expect(takeover.played.get("over") ?? 0).toBe(0)
    expect(takeover.refused).toBeGreaterThan(300)
  })

  it("plays a whole game with the takeover alone, from every start", () => {
    for (const size of SIZES) {
      for (let index = 0; index < GAMES_PER_SIZE; index++) {
        const { label, start } = tableOf(size, index)
        const end = playOn(GAME, start)
        expect(GAME.isOver(end), `${label} is not over`).toBe(true)
        expect(problems(end), label).toEqual([])
        expect(census(end), label).toBe(census(start))
        const survivors = living(end)
        expect(survivors, label).toHaveLength(1)
        expect(viewOf(end, null).results?.players.map((player) => player.playerId), label).toEqual([...survivors, ...[...end.out].reverse()])
      }
    }
  })

  it("plays the same game from the same seeds, and from a copy of the start", () => {
    for (const [size, index] of [[2, 0], [3, 7], [4, 12], [5, 31]] as const) {
      const { start } = tableOf(size, index)
      expect(newState(size, seedOf(size * 100 + index), tableOf(size, index).options), "the same seed deals the same table").toEqual(start)
      const seed = seedOf(size * 1000 + index)
      const first = playRandomly(start, seed)
      const second = playRandomly(structuredClone(start), seed)
      expect(second.state, `${size}p#${index}`).toEqual(first.state)
      expect(second.moves).toBe(first.moves)
      expect(second.refused).toEqual(first.refused)
    }
  })
})

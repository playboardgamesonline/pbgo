import { isDeepStrictEqual } from "node:util"
import { type Rng, createRng, isEngineError, playFor, waitingPlayers } from "@pbgo/engine-kit"
import { beforeAll, describe, expect, it } from "vitest"
import { step } from "./actions"
import { autoPlay } from "./autoplay"
import { CATALOGUE } from "./catalogue"
import { GAME } from "./game"
import { close, open } from "./machine"
import { newState, deepFreeze, problems, randomAction, reorderKeys, seedOf, viewOf } from "./test-utils"
import { type Action, CLIENT_ACTIONS, FLIP7_ERROR_CODES, type Flip7Event, type State } from "./types"

/**
 * Whole games, played at random and checked after every move.
 *
 * Tables of 3 to 8 players play to the end with every option the game has. Some players stay at the first chance, some almost never
 * (so that busts, Flip 7s and long Flip Three chains happen), and some are away a third of the time, so that the takeover plays for them
 * in every step. After each accepted move this file checks what must hold whatever the cards are: that no card is lost, that the turn
 * goes to the right player, that nobody changes after leaving the round, that a Second Chance is the only card that leaves a line, that
 * the scores of a round are the ones the booklet gives (written again here, from the face names, not read from the engine), that a
 * stored copy of the state replays the move, and that no view shows a card of the draw pile.
 *
 * Three more passes follow on the states met on the way: junk actions that no player would send, which must be refused (or hold up under
 * every check), and the takeover, asked to play for each player the game waits for and for nobody else.
 *
 * A failed check does not stop the pass: it is noted with a few examples, and the tests at the end report them all at once.
 */

// --- What the pass found wrong

const found = new Map<string, { count: number; examples: string[] }>()

function flag(name: string, detail: string): void {
  const bucket = found.get(name) ?? { count: 0, examples: [] }
  bucket.count++
  if (bucket.examples.length < 3) bucket.examples.push(detail)
  found.set(name, bucket)
}

const report = (): string[] => [...found].map(([name, { count, examples }]) => `${name} ×${count}: ${examples.join(" | ")}`)

// --- The booklet's scoring, written again from the names of the faces

const numberOf = (face: string): number | null => (/^number-\d+$/.test(face) ? Number(face.slice("number-".length)) : null)

function bookletScore(faces: readonly string[], busted: boolean): number {
  if (busted) return 0
  const numbers = faces.flatMap((face) => numberOf(face) ?? [])
  const sum = numbers.reduce((total, value) => total + value, 0)
  const doubled = faces.includes("times-2") ? sum * 2 : sum
  const bonus = faces.filter((face) => face.startsWith("plus-")).reduce((total, face) => total + Number(face.slice("plus-".length)), 0)
  return doubled + bonus + (new Set(numbers).size >= 7 ? 15 : 0)
}

const facesOf = (state: State, ids: readonly number[]): string[] => ids.map((id) => CATALOGUE[state.ids.indexOf(id)]!)

/** The seat that plays after `seat`: the next one clockwise still in, `seat` itself last. */
function nextIn(status: readonly string[], seat: number): number | null {
  for (let i = 1; i <= status.length; i++) if (status[(seat + i) % status.length] === "active") return (seat + i) % status.length
  return null
}

// --- One accepted move

type Move = { at: string; before: State; action: Action | null; after: State; events: Flip7Event[] }

const eventsOf = <K extends Flip7Event["kind"]>(events: readonly Flip7Event[], kind: K): Extract<Flip7Event, { kind: K }>[] =>
  events.filter((event): event is Extract<Flip7Event, { kind: K }> => event.kind === kind)

const tally = { games: 0, moves: 0, fallbacks: 0, kinds: new Map<string, number>(), hows: new Set<string>(), phases: new Set<string>(), played: new Set<string>(), maxHeld: 0, players: new Set<number>() }

function checkMove(move: Move): void {
  const { at, before, action, after, events } = move
  const ok = (name: string, condition: boolean, more?: () => string) => {
    if (!condition) flag(name, `${at} ${action === null ? "(played for)" : JSON.stringify(action)}${more ? ` — ${more()}` : ""}`)
  }
  const n = before.seats.length
  const kinds = events.map((event) => event.kind)
  for (const kind of kinds) tally.kinds.set(kind, (tally.kinds.get(kind) ?? 0) + 1)
  const newRound = kinds.includes("round")
  const ended = kinds.includes("end")

  for (const problem of problems(after)) flag(`state · ${problem}`, at)
  ok("ids changed", isDeepStrictEqual(before.ids, after.ids))
  ok("the options changed", isDeepStrictEqual(before.options, after.options))
  ok("the seats changed", isDeepStrictEqual(before.seats, after.seats))

  // who the game waits for
  const top = after.stack.at(-1)
  const expectedWaiting = GAME.isOver(after) ? [] : top === undefined ? [after.seats[after.dealer]!] : top.kind === "turn" || top.kind === "target" ? [after.seats[top.seat]!] : ["?"]
  ok("waitingPlayers is not who the stack waits for", isDeepStrictEqual(waitingPlayers(GAME, after), expectedWaiting), () => JSON.stringify(waitingPlayers(GAME, after)))
  ok("the game waits for one player at a time", waitingPlayers(GAME, after).length === (GAME.isOver(after) ? 0 : 1))
  tally.phases.add(GAME.isOver(after) ? "over" : top === undefined ? "between" : top.kind)

  // statuses only go out of the round, never back, except when a round starts
  if (!newRound) {
    before.status.forEach((status, seat) => {
      const now = after.status[seat]!
      ok("a status went back", status === "active" || now === status, () => `${before.seats[seat]}: ${status} → ${now}`)
    })
  }

  // lines: nothing leaves a line but a Second Chance that was spent, and nothing is added to a player who is out
  if (!newRound) {
    before.lines.forEach((line, seat) => {
      const who = before.seats[seat]!
      const now = after.lines[seat]!
      const removed = line.filter((id) => !now.includes(id))
      for (const id of removed) {
        const face = facesOf(before, [id])[0]
        // a spent Second Chance goes to the discard, which a later flip of the same step may shuffle into a new pile
        const spent = eventsOf(events, "saved").some((saved) => saved.secondChance.id === id)
        ok("a card left a line that was not a spent Second Chance", face === "second-chance" && spent && (kinds.includes("reshuffle") || after.discard.includes(id)), () => `${who}: ${face}`)
      }
      ok("a line lost its order", isDeepStrictEqual(now.filter((id) => line.includes(id)), line.filter((id) => now.includes(id))), () => who)
      if (before.status[seat] !== "active" && !ended) ok("the line of a player who is out changed", isDeepStrictEqual(now, line), () => who)
    })
  }

  // the cards drawn leave the pile (a reshuffle moves the discard under it, which the count does not follow)
  const draws = eventsOf(events, "draw")
  if (!kinds.includes("reshuffle")) ok("the cards drawn are not the cards that left the pile", before.deck.length - after.deck.length === draws.length, () => `${before.deck.length} → ${after.deck.length}, ${draws.length} drawn`)
  for (const draw of draws) tally.hows.add(draw.how)
  for (const event of eventsOf(events, "play")) tally.played.add(event.card.type)

  // busts, saves and Flip 7s
  for (const bust of eventsOf(events, "bust")) {
    const seat = after.seats.indexOf(bust.by)
    ok("a bust without a duplicate", after.status[seat] === "busted")
  }
  ok("the busts are not counted", after.stats.reduce((sum, stats) => sum + stats.busts, 0) - before.stats.reduce((sum, stats) => sum + stats.busts, 0) === eventsOf(events, "bust").length)
  ok("the Flip 7s are not counted", after.stats.reduce((sum, stats) => sum + stats.flip7, 0) - before.stats.reduce((sum, stats) => sum + stats.flip7, 0) === eventsOf(events, "flip7").length)
  for (const saved of eventsOf(events, "saved")) {
    // the Second Chance and the duplicate go to the discard, unless a later flip of the same step shuffled the discard into a new pile
    const discarded = after.discard.includes(saved.secondChance.id) && after.discard.includes(saved.card.id)
    ok("a Second Chance that cancelled nothing", saved.secondChance.type === "second-chance" && numberOf(saved.card.type) !== null && (kinds.includes("reshuffle") || discarded))
  }
  for (const flip7 of eventsOf(events, "flip7")) {
    ok("a Flip 7 that does not end the round", ended && kinds.indexOf("flip7") < kinds.indexOf("end"))
    ok("a Flip 7 without seven numbers", new Set(facesOf(after, after.lines[after.seats.indexOf(flip7.by)]!).flatMap((face) => numberOf(face) ?? [])).size >= 7)
  }

  // the end of a round: the booklet's scores, the dealer passed on, the totals kept
  ok("the rounds changed without a round ending", ended === (after.rounds.length === before.rounds.length + 1))
  if (ended) {
    const scores = after.rounds.at(-1)!
    ok("the end event does not carry the scores", isDeepStrictEqual(eventsOf(events, "end")[0]!.scores, scores))
    after.seats.forEach((who, seat) => {
      const expected = bookletScore(facesOf(after, after.lines[seat]!), after.status[seat] === "busted")
      ok("a score is not the booklet's", scores[seat] === expected, () => `${who}: ${scores[seat]} for ${facesOf(after, after.lines[seat]!).join(" ")} (${after.status[seat]}), expected ${expected}`)
    })
    ok("the dealer did not pass to the left", after.dealer === (before.dealer + 1) % n)
    ok("a round ended with somebody in", !after.status.includes("active"))
    ok("the round did not end for a reason of the booklet", kinds.includes("flip7") || before.status.includes("active"))
  } else {
    ok("the dealer moved without a round ending", after.dealer === before.dealer)
  }
  if (kinds.includes("over")) {
    ok("over without the game being over", GAME.isOver(after) && isDeepStrictEqual(eventsOf(events, "over")[0]!.winners, viewOf(after, null).results?.winners))
  } else ok("the game is over without saying so", !GAME.isOver(after) || GAME.isOver(before))

  // a stay says what it banks
  for (const stay of eventsOf(events, "stay")) {
    const seat = before.seats.indexOf(stay.by)
    ok("a stay with the wrong points", stay.points === bookletScore(facesOf(before, before.lines[seat]!), false))
  }

  // the turn goes to the next player in
  if (action !== null && (action.type === "hit" || action.type === "stay") && after.stack.length === 1 && top?.kind === "turn") {
    const next = nextIn(after.status, before.seats.indexOf(action.playerId))
    ok("the turn does not go to the next player in", top.seat === next, () => `${after.seats[top.seat]} instead of ${next === null ? "nobody" : after.seats[next]}`)
  }

  // a new round: the player on the dealer's left is dealt first, and the cards of the last one were swept up
  if (newRound) {
    const first = draws[0]
    ok("the deal does not start on the dealer's left", first === undefined || first.by === before.seats[(before.dealer + 1) % n])
    const inTheAir = after.stack.flatMap((frame) => (frame.kind === "target" ? [frame.card] : frame.kind === "flip" ? frame.held : []))
    ok("the last round's cards did not go to the discard", before.lines.flat().every((id) => after.discard.includes(id) || after.deck.includes(id) || after.lines.flat().includes(id) || inTheAir.includes(id)))
  }
}

// --- Views of a move

/** Every viewer sees the same table but for `me`, and nothing of the draw pile. */
function checkViews(at: string, state: State): void {
  const reference = viewOf(state, null)
  for (const viewer of [null, "stranger", ...state.seats.slice(0, 3)]) {
    const view = viewOf(state, viewer)
    // an id of the draw pile must not appear anywhere in the view, whatever the field it sits in
    const text = JSON.stringify(view)
    for (const id of state.deck) if (new RegExp(`(^|[^0-9])${id}([^0-9]|$)`).test(text)) flag("a view shows the id of a card of the draw pile", `${at} to ${String(viewer)}`)
    if (!isDeepStrictEqual({ ...view, me: null }, reference)) flag("views differ by more than `me`", `${at} to ${String(viewer)}`)
    if (view.deck.size !== state.deck.length) flag("the view gives the wrong size of the draw pile", at)
  }
}

// --- Whole games

type Plan = { players: number; seed: number; stay: number; absent: number; options?: Record<string, unknown> }

const states: Record<string, State[]> = {}
const offered: Record<string, number> = {}
const sampler = createRng(seedOf(7))
const PER_PHASE = 14

/** Keeps a few states of each phase, drawn evenly from everything offered (reservoir sampling), for the passes that start from one. */
function offer(state: State): void {
  const kind = GAME.isOver(state) ? "over" : (state.stack.at(-1)?.kind ?? "between")
  const count = (offered[kind] ?? 0) + 1
  offered[kind] = count
  const kept = (states[kind] ??= [])
  if (kept.length < PER_PHASE) kept.push(structuredClone(state))
  else {
    const slot = Math.floor(sampler() * count)
    if (slot < PER_PHASE) kept[slot] = structuredClone(state)
  }
}

/** A table that stays with probability `stay` when it may, and where a player is away `absent` of the time. */
function play(plan: Plan): State {
  const rng: Rng = createRng(plan.seed)
  const decide = (state: State): Action => {
    const action = randomAction(state, rng)
    // `randomAction` stays 40% of the time: here the table's own appetite decides
    if (action.type !== "hit" && action.type !== "stay") return action
    const seat = state.seats.indexOf(action.playerId)
    return state.lines[seat]!.length > 0 && rng() < plan.stay ? { type: "stay", playerId: action.playerId } : { type: "hit", playerId: action.playerId }
  }
  let state = deepFreeze(newState(plan.players, plan.seed, plan.options))
  offer(state)
  tally.games++
  tally.players.add(plan.players)
  for (let i = 0; i < 6000 && !GAME.isOver(state); i++) {
    const at = `game ${plan.seed} (${plan.players} players) move ${i}`
    const [who] = waitingPlayers(GAME, state)
    const absent = who !== undefined && rng() < plan.absent
    const action = absent ? null : decide(state)
    let result
    try {
      if (absent) {
        // the takeover plays one step for the player: what `GAME.autoPlayFor` does, with the events it would have said
        const ctx = open(state)
        autoPlay(ctx, who)
        result = close(ctx)
      } else result = step(state, action!)
    } catch (error) {
      flag("a legal move was refused", `${at}: ${String(error)}`)
      return state
    }
    if (absent) {
      // the takeover is `playFor`: it must give the same state as `autoPlayFor`
      if (!isDeepStrictEqual(playFor(GAME, state, who), result.state)) flag("playFor differs from autoPlayFor", at)
      tally.fallbacks++
    }
    const events = result.events.map(({ event }) => event)
    tally.moves++
    // purity: the move gives the same result twice, and from a copy that Postgres gave back in another key order
    if (!absent) {
      if (!isDeepStrictEqual(step(state, action!).state, result.state)) flag("a move is not deterministic", at)
      if (!isDeepStrictEqual(step(reorderKeys(state), action!).state, result.state)) flag("a move depends on the order of the keys of the state", at)
    }
    checkMove({ at, before: state, action, after: result.state, events })
    if (tally.moves % 9 === 0) checkViews(at, result.state)
    state = deepFreeze(result.state)
    offer(state)
  }
  if (!GAME.isOver(state)) flag("a game did not end", `game ${plan.seed}`)
  return state
}

/**
 * The tables: 3 to 8 players, careful and greedy, with and without absent players, and the two ends of the target option. The size
 * runs fastest and the kind of table once per round of sizes, so every size meets every kind of table (three times each).
 */
const SIZES = 6
const KINDS = 4
const PLANS: Plan[] = Array.from({ length: SIZES * KINDS * 3 }, (_, i) => ({
  players: 3 + (i % SIZES),
  seed: seedOf(300 + i),
  stay: [0.5, 0.15, 0.03, 1][Math.floor(i / SIZES) % KINDS]!,
  absent: [0, 0, 0.35, 0][Math.floor(i / SIZES) % KINDS]!,
  options: i % 5 === 0 ? { targetScore: 50 } : i % 5 === 1 ? { targetScore: 500 } : undefined,
}))

const finished: State[] = []

beforeAll(() => {
  for (const plan of PLANS) finished.push(play(plan))
}, 120_000)

// --- Junk

/** An action that no player would send: wrong types, other players, missing fields. */
function junk(state: State, rng: Rng): unknown {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!
  const players = [...state.seats, "stranger", "", "__proto__", "constructor"]
  const types = [...CLIENT_ACTIONS, "fold", "", "toString", "__proto__", 7, null, undefined]
  const targets = [...state.seats, "stranger", "", 3, null, undefined, {}, ["ana"]]
  const action: Record<string, unknown> = {}
  if (rng() < 0.9) action.type = pick(types)
  if (rng() < 0.9) action.playerId = pick([...players, 3, null, undefined])
  if (rng() < 0.6) action.target = pick(targets)
  if (rng() < 0.2) action.card = pick([1, "freeze", null])
  return rng() < 0.05 ? pick([null, undefined, "hit", 7, [], () => 1]) : action
}

const everySample = (): State[] => Object.values(states).flat()

describe("whole games, checked move by move", () => {
  it("played the tables: 3 to 8 players, careful and greedy, with absent players", () => {
    expect(tally.games).toBe(PLANS.length)
    expect([...tally.players].sort((a, b) => a - b)).toEqual(Array.from({ length: SIZES }, (_, i) => i + 3))
    expect(tally.moves).toBeGreaterThan(5000)
    expect(tally.fallbacks).toBeGreaterThan(200)
    expect(finished.every((state) => GAME.isOver(state))).toBe(true)
  })

  it("went through everything the game has: every step, every kind of event, every action card", () => {
    expect([...tally.phases].sort()).toEqual(["between", "over", "target", "turn"])
    for (const kind of ["round", "draw", "stay", "bust", "saved", "play", "reshuffle", "flip7", "end", "over"]) expect(tally.kinds.get(kind) ?? 0, `${kind} events`).toBeGreaterThan(0)
    expect([...tally.hows].sort()).toEqual(["deal", "flip", "hit"])
    expect([...tally.played].sort()).toEqual(["flip-three", "freeze", "second-chance"])
  })

  it("keeps the rules of the booklet on every move", () => {
    expect(report().filter((line) => !line.startsWith("takeover") && !line.startsWith("junk"))).toEqual([])
  })
})

describe("junk actions", () => {
  it("are refused with a code of the game, or else leave a sound state; the state is never touched", () => {
    const rng = createRng(seedOf(8))
    let refused = 0
    let accepted = 0
    const samples = everySample()
    expect(samples.length).toBeGreaterThan(30)
    for (const sample of samples) {
      const frozen = deepFreeze(structuredClone(sample))
      for (let i = 0; i < 150; i++) {
        const action = junk(frozen, rng)
        try {
          const next = step(frozen, action as never).state
          accepted++
          for (const problem of problems(next)) flag(`junk · a junk action left a bad state: ${problem}`, JSON.stringify(action))
        } catch (error) {
          refused++
          if (!isEngineError(error)) flag("junk · a junk action threw something that is not an EngineError", `${JSON.stringify(action)} → ${String(error)}`)
          else if (!(FLIP7_ERROR_CODES as readonly string[]).includes(error.code)) flag("junk · a junk action was refused with a code the game does not list", `${JSON.stringify(action)} → ${error.code}`)
        }
      }
      if (!isDeepStrictEqual(frozen, sample)) flag("junk · a junk action changed the state it was given", "")
    }
    expect(refused).toBeGreaterThan(3000)
    expect(report().filter((line) => line.startsWith("junk"))).toEqual([])
    expect(accepted).toBeGreaterThanOrEqual(0)
  })
})

describe("the takeover", () => {
  it("plays for each player the game waits for, and for nobody else", () => {
    let played = 0
    let refused = 0
    for (const sample of everySample()) {
      const waiting = waitingPlayers(GAME, sample)
      for (const id of waiting) {
        let next: State
        try {
          next = playFor(GAME, sample, id)
        } catch (error) {
          flag("takeover · the takeover cannot play for a player the game waits for", `${id}: ${String(error)}`)
          continue
        }
        played++
        for (const problem of problems(next)) flag(`takeover · ${problem}`, id)
        if (isDeepStrictEqual(next, sample)) flag("takeover · the takeover changed nothing", id)
        if (!isDeepStrictEqual(GAME.autoPlayFor!(sample, id), next)) flag("takeover · autoPlayFor is not what playFor does", id)
        if (waitingPlayers(GAME, next).includes(id) && GAME.isOver(sample)) flag("takeover · played for a player after the game was over", id)
      }
      for (const id of [...sample.seats.filter((seat) => !waiting.includes(seat)), "stranger", "", "__proto__"]) {
        refused++
        for (const [name, attempt] of [
          ["playFor", () => playFor(GAME, sample, id)],
          ["autoPlayFor", () => GAME.autoPlayFor!(sample, id)],
        ] as const) {
          try {
            attempt()
            flag(`takeover · ${name} played for somebody the game does not wait for`, id)
          } catch (error) {
            if (!isEngineError(error) || error.code !== "NOT_WAITING") flag(`takeover · ${name} does not refuse a player the game does not wait for with NOT_WAITING`, `${id}: ${String(error)}`)
          }
        }
      }
    }
    expect(played).toBeGreaterThan(30)
    expect(refused).toBeGreaterThan(300)
    expect(report().filter((line) => line.startsWith("takeover"))).toEqual([])
  })
})

import { isDeepStrictEqual } from "node:util"
import { createRng, isEngineError, playFor, waitingPlayers } from "@pbgo/engine-kit"
import { deepFreeze, reorderKeys } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { CATALOGUE } from "./catalogue"
import { GAME } from "./game"
import { newState, problems, randomAction, seedOf, viewOf } from "./test-utils"
import { type Action, CLIENT_ACTIONS, SKYJO_ERROR_CODES, type SkyjoEvent, type State } from "./types"

/**
 * Whole games, played at random and checked after every move.
 *
 * Tables of 2 to 8 players play to the end. Some players are away a third of the time, so that the takeover plays for them in every step.
 * After each accepted move this file checks what must hold whatever the cards are: that no card is lost, that the turn goes to the right
 * player, that cards only leave a grid by being placed over or thrown away in a column, that the count of a round is the one the rulebook
 * gives (written again here, from the names of the faces, not read from the engine), that a stored copy of the state replays the move, and
 * that no view shows a hidden card.
 */

const found = new Map<string, { count: number; examples: string[] }>()
function flag(name: string, detail: string): void {
  const bucket = found.get(name) ?? { count: 0, examples: [] }
  bucket.count++
  if (bucket.examples.length < 3) bucket.examples.push(detail)
  found.set(name, bucket)
}
const report = (): string[] => [...found].map(([name, { count, examples }]) => `${name} ×${count}: ${examples.join(" | ")}`)

// --- The rulebook's count, written again from the names of the faces

const valueOfFace = (face: string): number => Number(face.replace("card-minus-", "-").replace("card-", ""))
const faceOfId = (state: State, id: number): string => CATALOGUE[state.ids.indexOf(id)]!

/** What a grid is worth when every card is face up, columns of three equal cards thrown away. */
function bookletCount(state: State, seat: number): number {
  let total = 0
  for (let column = 0; column < 4; column++) {
    const cells = state.grids[seat]!.slice(column * 3, column * 3 + 3)
    const faces = cells.flatMap((cell) => (cell ? [valueOfFace(faceOfId(state, cell.card))] : []))
    if (faces.length === 3 && new Set(faces).size === 1) continue
    total += faces.reduce((a, b) => a + b, 0)
  }
  return total
}

const tally = { games: 0, moves: 0, rounds: 0, columns: 0, doubled: 0, reshuffles: 0, ends: 0, sizes: new Set<number>(), stages: new Set<string>() }

type Move = { at: string; before: State; action: Action | null; after: State; events: SkyjoEvent[] }

function checkMove({ at, before, action, after, events }: Move): void {
  const ok = (name: string, condition: boolean, more?: () => string) => {
    if (!condition) flag(name, `${at} ${action === null ? "(played for)" : JSON.stringify(action)}${more ? ` — ${more()}` : ""}`)
  }
  const kinds = events.map((event) => event.kind)
  const newRound = kinds.includes("round")
  const counted = kinds.includes("end")
  tally.moves++
  tally.stages.add(after.stage.kind)
  if (kinds.includes("reshuffle")) tally.reshuffles++
  tally.columns += kinds.filter((kind) => kind === "column").length

  for (const problem of problems(after)) flag(`state · ${problem}`, at)
  ok("ids changed", isDeepStrictEqual(before.ids, after.ids))
  ok("the seats changed", isDeepStrictEqual(before.seats, after.seats))

  // who the game waits for
  const waits = waitingPlayers(GAME, after)
  const expected = GAME.isOver(after)
    ? []
    : after.stage.kind === "reveal"
      ? after.seats.filter((_, seat) => after.grids[seat]!.filter((cell) => cell?.up).length < 2)
      : after.stage.kind === "between"
        ? [after.seats[after.dealer]!]
        : [after.seats[after.stage.seat]!]
  ok("waitingPlayers is not who the stage waits for", isDeepStrictEqual(waits, expected), () => JSON.stringify(waits))

  if (!newRound && !counted) {
    // a card face up never goes back face down, and a card face down only turns up or stays
    before.grids.forEach((grid, seat) => {
      grid.forEach((cell, position) => {
        const now = after.grids[seat]![position]
        if (cell?.up && now && now.card === cell.card) ok("a card went face down", now.up, () => `${before.seats[seat]}/${position}`)
        if (cell === null) ok("a hole came back", now === null, () => `${before.seats[seat]}/${position}`)
        if (cell && !cell.up && now && now.card === cell.card) ok("a face-down card stayed in place and changed", now.up === false || kinds.includes("reveal"))
      })
    })
    // only the player who plays changes their grid
    const mover = before.stage.kind === "reveal" ? null : (before.stage as { seat?: number }).seat
    before.grids.forEach((grid, seat) => {
      if (mover !== null && seat !== mover) ok("a grid changed while another player played", isDeepStrictEqual(grid, after.grids[seat]), () => before.seats[seat]!)
    })
    // the discard only grows by the card played, by a thrown column, or shrinks by the card taken
    ok("the discard gained a face-down card", after.discard.every((id) => before.discard.includes(id) || events.length > 0))
    // the turn went where the rules say
    const stage = before.stage
    if (stage.kind === "choose" && after.stage.kind === "choose") ok("a turn passed to the wrong seat", after.stage.seat === (stage.seat + 1) % before.seats.length, () => `${stage.seat} → ${after.stage.kind === "choose" ? after.stage.seat : "?"}`)
  }

  if (counted) {
    tally.ends++
    const entry = events.find((event): event is Extract<SkyjoEvent, { kind: "end" }> => event.kind === "end")!
    const seatOfEnder = before.seats.indexOf(entry.ender)
    const sums = after.seats.map((_, seat) => bookletCount(after, seat))
    const ender = sums[seatOfEnder]!
    const strictlyLowest = sums.every((value, seat) => seat === seatOfEnder || ender < value)
    const doubled = ender > 0 && !strictlyLowest
    if (doubled) tally.doubled++
    const expectedScores = sums.map((value, seat) => (seat === seatOfEnder && doubled ? value * 2 : value))
    ok("the count of the round is not the rulebook's", isDeepStrictEqual(after.rounds.at(-1), expectedScores), () => `${JSON.stringify(after.rounds.at(-1))} against ${JSON.stringify(expectedScores)}`)
    ok("the end event does not say the count", isDeepStrictEqual(entry.scores, expectedScores))
    ok("the doubling is not the rulebook's", entry.doubled === doubled)
    ok("the ender did not have every card turned over", before.grids[seatOfEnder]!.length === 12)
    ok("the dealer did not move on", after.dealer === (before.dealer + 1) % before.seats.length)
    // everybody played their last turn: the ender is the only one who ended it, and the turn came back to them
    ok("the round ended before the turn came back to the ender", before.stage.kind === "choose" || before.stage.kind === "flip" || before.stage.kind === "place")
  }
  if (newRound) {
    ok("a new round did not keep its first cards face down", after.grids.every((grid) => grid.every((cell) => cell !== null && !cell.up)))
    ok("a new round has the 150 cards", after.deck.length + after.discard.length + after.grids.flat().length === 150)
  }

  // the views keep their secrets
  const hidden = new Set<number>([...after.deck, ...after.grids.flat().flatMap((cell) => (cell && !cell.up ? [cell.card] : []))])
  const held = after.stage.kind === "place" && after.stage.from === "deck" ? after.stage.card : null
  for (const viewer of [...after.seats, null]) {
    const json = JSON.stringify(viewOf(after, viewer))
    for (const id of hidden) if (json.includes(`"id":${id},`) || json.includes(`"id":${id}}`)) flag("a view shows a hidden id", `${at} ${viewer}`)
    if (held !== null && viewer !== after.seats[(after.stage as { seat: number }).seat] && (json.includes(`"id":${held},`) || json.includes(`"id":${held}}`))) flag("a view shows the drawn card", `${at} ${viewer}`)
  }

  // a stored copy of the state replays the move
  if (action !== null) {
    const stored = reorderKeys(before)
    ok("a stored state does not replay the move", isDeepStrictEqual(step(stored, action).state, after))
  }
}

function play(n: number, seed: number, away: number): void {
  const rng = createRng(seed)
  let state = newState(n, seed)
  tally.games++
  tally.sizes.add(n)
  for (let i = 0; i < 30_000 && !GAME.isOver(state); i++) {
    const waits = waitingPlayers(GAME, state)
    const at = `${n}p seed ${seed} move ${i}`
    if (rng() < away) {
      const who = waits[Math.floor(rng() * waits.length)]!
      const after = playFor(GAME, state, who)
      const events = GAME.autoPlayStep!(state, who).events.map((entry) => entry.event)
      checkMove({ at, before: state, action: null, after, events })
      state = after
      continue
    }
    const action = randomAction(state, rng)
    const stepped = GAME.step!(deepFreeze(structuredClone(state)), action)
    checkMove({ at, before: state, action, after: stepped.state, events: stepped.events.map((entry) => entry.event) })
    state = stepped.state
  }
  if (!GAME.isOver(state)) flag("a game did not end", `${n}p seed ${seed}`)
  else {
    const results = GAME.view(state, null).results
    if (results === null) flag("a finished game has no results", `${n}p seed ${seed}`)
    else {
      const totals = state.seats.map((_, seat) => state.rounds.reduce((total, scores) => total + scores[seat]!, 0))
      const winners = state.seats.filter((_, seat) => totals[seat] === Math.min(...totals))
      if (!isDeepStrictEqual(results.winners, winners)) flag("the winners are not the lowest totals", `${n}p seed ${seed}`)
      if (!totals.some((total) => total >= 100)) flag("the game ended with nobody at 100", `${n}p seed ${seed}`)
      const before = state.rounds.slice(0, -1).map((_, round) => state.rounds.slice(0, round + 1).reduce((t, scores) => t.map((v, s) => v + scores[s]!), state.seats.map(() => 0)))
      if (before.some((running) => running.some((total) => total >= 100))) flag("the game went on after somebody reached 100", `${n}p seed ${seed}`)
    }
  }
}

describe("random games, checked after every move", () => {
  for (let n = 2; n <= 8; n++) {
    it(`plays ${n} players to the end, twice, with players away a third of the time`, () => {
      play(n, seedOf(100 + n), 0)
      play(n, seedOf(200 + n), 0.33)
      expect(report().filter((line) => line.includes(`${n}p`) || !line.includes("p seed"))).toEqual([])
    }, 60_000)
  }

  it("meets everything the rules can do, over those games", () => {
    expect(report()).toEqual([])
    expect([...tally.sizes].sort()).toEqual([2, 3, 4, 5, 6, 7, 8])
    expect(tally.ends).toBeGreaterThanOrEqual(14)
    expect(tally.columns).toBeGreaterThan(0)
    expect(tally.doubled).toBeGreaterThan(0)
    for (const stage of ["reveal", "choose", "place", "flip", "between"]) expect(tally.stages, stage).toContain(stage)
  })
})

describe("junk actions", () => {
  it("are refused with a code of the game's list, and never change the state", () => {
    const codes = new Set<string>([...SKYJO_ERROR_CODES, "INVALID_PLAYERS"])
    const rng = createRng(seedOf(11))
    let state = newState(4, seedOf(11))
    const junk = (): unknown[] => {
      const [who] = waitingPlayers(GAME, state)
      const types = [...CLIENT_ACTIONS, "fly", 7, null]
      return [
        null, undefined, 3, "draw", [], {},
        { type: types[Math.floor(rng() * types.length)], playerId: who },
        { type: types[Math.floor(rng() * types.length)], playerId: "zed" },
        { type: "place", playerId: who, position: Math.floor(rng() * 30) - 10 },
        { type: "place", playerId: who, position: "3" },
        { type: "flip", playerId: who, position: 0.5 },
        { type: "reveal", playerId: who, position: NaN },
        { type: "deal", playerId: who },
      ]
    }
    for (let i = 0; i < 400 && !GAME.isOver(state); i++) {
      const snapshot = structuredClone(state)
      for (const action of junk()) {
        try {
          step(deepFreeze(structuredClone(state)), action as Action)
        } catch (error) {
          expect(isEngineError(error), JSON.stringify(action)).toBe(true)
          expect(codes.has((error as { code: string }).code), `${(error as { code: string }).code} for ${JSON.stringify(action)}`).toBe(true)
        }
      }
      expect(state).toEqual(snapshot)
      state = step(state, randomAction(state, rng)).state
    }
  })
})

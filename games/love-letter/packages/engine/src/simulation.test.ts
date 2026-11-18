import { isDeepStrictEqual } from "node:util"
import { createRng, isEngineError, playFor, waitingPlayers } from "@pbgo/engine-kit"
import { deepFreeze, reorderKeys } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { enough, names, newState, problems, randomAction, seedOf, tokens, viewOf } from "./test-utils"
import { type Action, CLIENT_ACTIONS, LOVE_LETTER_ERROR_CODES, type LoveLetterEvent, type State } from "./types"

/**
 * Whole games, played at random and checked after every move.
 *
 * Tables of 2 to 6 players play to the end. Some players are away a third of the time, so that the takeover plays for them in every step. After each accepted
 * move this file checks what must hold whatever the cards are: that no card is lost, that the turn goes to the right player, that only the player who plays
 * changes their cards, that the count of a round and the Spy's token are the ones the booklet gives (written again here, from the names of the cards, not read
 * from the engine), that the game ends when somebody holds the tokens that win and not before, that a stored copy of the state replays the move, and that no view
 * shows a hidden card.
 */

const found = new Map<string, { count: number; examples: string[] }>()
function flag(name: string, detail: string): void {
  const bucket = found.get(name) ?? { count: 0, examples: [] }
  bucket.count++
  if (bucket.examples.length < 3) bucket.examples.push(detail)
  found.set(name, bucket)
}
const report = (): string[] => [...found].map(([name, { count, examples }]) => `${name} ×${count}: ${examples.join(" | ")}`)

// --- The booklet's count, written again from the names of the cards

const VALUE: Record<string, number> = { spy: 0, guard: 1, priest: 2, baron: 3, handmaid: 4, prince: 5, chancellor: 6, king: 7, countess: 8, princess: 9 }
const TOKENS_TO_WIN: Record<number, number> = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3 }

/** Who wins a round and who earns the Spy's token (pp. 6, 13), from the cards the state holds once the round is over. */
function bookletRound(state: State): { how: "deck" | "last"; winners: number[]; spy: number | null } {
  const inRound = state.seats.flatMap((_, seat) => (state.out[seat] ? [] : [seat]))
  const held = (seat: number) => VALUE[names(state, state.hands[seat]!)[0]!]!
  const how = inRound.length === 1 ? "last" : "deck"
  const best = Math.max(...inRound.map(held))
  const winners = how === "last" ? inRound : inRound.filter((seat) => held(seat) === best)
  const withSpy = inRound.filter((seat) => names(state, state.areas[seat]!).includes("spy"))
  return { how, winners, spy: withSpy.length === 1 ? withSpy[0]! : null }
}

const tally = { games: 0, moves: 0, rounds: 0, ties: 0, spyTokens: 0, overs: 0, sizes: new Set<number>(), stages: new Set<string>() }

type Move = { at: string; before: State; action: Action | null; after: State; events: LoveLetterEvent[] }

function checkMove({ at, before, action, after, events }: Move): void {
  const ok = (name: string, condition: boolean, more?: () => string) => {
    if (!condition) flag(name, `${at} ${action === null ? "(played for)" : JSON.stringify(action)}${more ? ` — ${more()}` : ""}`)
  }
  const kinds = events.map((event) => event.kind)
  const n = before.seats.length
  tally.moves++
  tally.stages.add(after.stage.kind)

  for (const problem of problems(after)) flag(`state · ${problem}`, at)
  ok("ids changed", isDeepStrictEqual(before.ids, after.ids))
  ok("the seats changed", isDeepStrictEqual(before.seats, after.seats))

  // who the game waits for
  const waits = waitingPlayers(GAME, after)
  ok("waitingPlayers is not the player of the turn", isDeepStrictEqual(waits, GAME.isOver(after) ? [] : [after.seats[after.turn]]), () => JSON.stringify(waits))

  // the game ends when somebody holds the tokens that win, and not before (p. 7)
  ok("the game is over and nobody holds the tokens that win", GAME.isOver(after) === tokens(after).some((count) => count >= TOKENS_TO_WIN[n]!))
  ok("isOver and the tokens of the test do not agree", GAME.isOver(after) === enough(after))
  if (GAME.isOver(before)) flag("a move was played in a game that was over", at)

  if (before.stage.kind === "play") {
    const mover = before.turn
    const card = (action as { card?: number } | null)?.card ?? undefined
    ok("a player played a card that was not theirs", card === undefined || before.hands[mover]!.includes(card))
    const played = after.areas[mover]!.at(-1)
    ok("the card played is not the last of the play area", card === undefined || played === card)
    ok("a play area lost a card", after.areas.every((area, seat) => area.length >= before.areas[seat]!.length))
    ok("the card played is not the first thing the log says", kinds[0] === "play")
    // only the player who plays and the one who draws change their cards
    const ended = kinds.includes("end")
    const next = ended ? -1 : (mover + 1) % n
    before.hands.forEach((hand, seat) => {
      if (seat !== mover && seat !== next) ok("a hand changed while another player played", isDeepStrictEqual(hand, after.hands[seat]), () => before.seats[seat]!)
    })
    ok("the player who played does not hold one card", after.hands[mover]!.length === 1)
    if (!ended) {
      ok("the turn passed to the wrong seat", after.turn === next, () => `${mover} → ${after.turn}`)
      ok("the next player did not draw the top card of the deck", isDeepStrictEqual(after.hands[next], [...before.hands[next]!, before.deck[0]]))
      ok("the deck did not lose its top card", isDeepStrictEqual(after.deck, before.deck.slice(1)))
      ok("the draw is not in the log, for the player who drew it", kinds.at(-1) === "draw")
    }
  }

  if (kinds.includes("end")) {
    tally.rounds++
    const end = events.find((event): event is Extract<LoveLetterEvent, { kind: "end" }> => event.kind === "end")!
    const expected = bookletRound(after)
    if (expected.winners.length > 1) tally.ties++
    if (expected.spy !== null) tally.spyTokens++
    ok("the round did not end the way the booklet says", end.how === expected.how)
    ok("the winners of the round are not the booklet's", isDeepStrictEqual(after.stage.kind === "between" ? after.stage.winners : null, expected.winners), () => JSON.stringify(expected.winners))
    ok("the Spy's token is not the booklet's", (after.stage.kind === "between" ? after.stage.spy : "x") === expected.spy, () => String(expected.spy))
    ok("the end event does not say the winners", isDeepStrictEqual(end.winners, expected.winners.map((seat) => after.seats[seat])))
    ok("the end event does not say the Spy's token", end.spy === (expected.spy === null ? null : after.seats[expected.spy]))
    after.seats.forEach((_, seat) => {
      ok("a winner did not gain a token", after.won[seat]! - before.won[seat]! === (expected.winners.includes(seat) ? 1 : 0), () => `seat ${seat}`)
      ok("the Spy's token was not gained as the booklet says", after.spies[seat]! - before.spies[seat]! === (expected.spy === seat ? 1 : 0), () => `seat ${seat}`)
    })
    ok("a round that ended on a comparison held the deck back", end.how === "last" || after.deck.length === 0)
    ok("a round ended on the deck without laying the hands face up", end.how === "last" || kinds.includes("reveal"))
    ok("the first turn of the next round is not a winner's", expected.winners.includes(after.turn))
    ok("the hands were not laid face up", after.stage.kind === "between" && after.stage.revealed === (end.how === "deck"))
    if (GAME.isOver(after)) {
      tally.overs++
      ok("the game ended without telling who won", kinds.at(-1) === "over")
    }
  }

  if (before.stage.kind === "between") {
    // the next round is dealt (p. 7): only the favor tokens carry over
    ok("a new round was not numbered", after.round === before.round + 1)
    ok("the favor tokens changed between two rounds", isDeepStrictEqual([before.won, before.spies], [after.won, after.spies]))
    ok("the player who takes the first turn changed", after.turn === before.turn)
    ok("a new round has the 21 cards", after.deck.length + 1 + after.faceUp.length + after.hands.flat().length + after.areas.flat().length === 21)
    ok("a new round kept somebody out", after.out.every((out) => !out) && after.shielded.every((shielded) => !shielded))
    ok("a new round kept cards in front of the players", after.areas.every((area) => area.length === 0))
    ok("a new round did not open with its round and the draw", isDeepStrictEqual(kinds, ["round", "draw"]))
  }

  // the views keep their secrets
  for (const viewer of [...after.seats, "stranger", null]) {
    const shown = after.stage.kind === "between" && after.stage.revealed
    const hidden = new Set<number>([...after.deck, ...(after.aside === null ? [] : [after.aside]), ...(shown ? [] : after.hands.filter((_, seat) => after.seats[seat] !== viewer).flat())])
    const json = JSON.stringify(viewOf(after, viewer))
    for (const id of hidden) if (json.includes(`"id":${id},`) || json.includes(`"id":${id}}`) || json.includes(`[${id},`) || json.includes(`,${id},`) || json.includes(`,${id}]`)) flag("a view shows a hidden id", `${at} ${viewer}`)
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
      const total = tokens(state)
      const winners = state.seats.filter((_, seat) => total[seat]! >= TOKENS_TO_WIN[n]!)
      if (!isDeepStrictEqual([...results.winners].sort(), [...winners].sort())) flag("the winners are not the players who hold the tokens that win", `${n}p seed ${seed}`)
      for (const row of results.players) {
        const won = winners.includes(row.playerId)
        if (row.rank !== (won ? 1 : 1 + winners.length)) flag("a rank is not the booklet's: winners first, no places", `${n}p seed ${seed} ${row.playerId}`)
        if (row.total !== total[state.seats.indexOf(row.playerId)]) flag("a total is not the player's tokens", `${n}p seed ${seed} ${row.playerId}`)
      }
    }
  }
}

describe("random games, checked after every move", () => {
  for (let n = 2; n <= 6; n++) {
    it(`plays ${n} players to the end, twice, with players away a third of the time`, () => {
      play(n, seedOf(100 + n), 0)
      play(n, seedOf(200 + n), 0.33)
      expect(report().filter((line) => line.includes(`${n}p`) || !line.includes("p seed"))).toEqual([])
    }, 60_000)
  }

  it("meets everything the rules of the skeleton can do, over those games", () => {
    expect(report()).toEqual([])
    expect([...tally.sizes].sort()).toEqual([2, 3, 4, 5, 6])
    expect(tally.rounds).toBeGreaterThanOrEqual(20)
    expect(tally.overs).toBe(tally.games)
    expect(tally.ties).toBeGreaterThan(0)
    expect(tally.spyTokens).toBeGreaterThan(0)
    for (const stage of ["play", "between"]) expect(tally.stages, stage).toContain(stage)
  })
})

describe("junk actions", () => {
  it("are refused with a code of the game's list, and never change the state", () => {
    const codes = new Set<string>([...LOVE_LETTER_ERROR_CODES, "INVALID_PLAYERS"])
    const rng = createRng(seedOf(11))
    let state = newState(4, seedOf(11))
    const junk = (): unknown[] => {
      const [who] = waitingPlayers(GAME, state)
      const types = [...CLIENT_ACTIONS, "fly", 7, null]
      return [
        null, undefined, 3, "play", [], {},
        { type: types[Math.floor(rng() * types.length)], playerId: who },
        { type: types[Math.floor(rng() * types.length)], playerId: "zed" },
        { type: "play", playerId: who, card: Math.floor(rng() * 40) - 10 },
        { type: "play", playerId: who, card: "3" },
        { type: "play", playerId: who, card: 0.5 },
        { type: "play", playerId: who, card: Number.NaN },
        { type: "play", playerId: who, card: state.deck[0] },
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

import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { deal, discard, draw, flip, gridUp, gridValues, kinds, layout, place, problems, refusal, take, up, values, viewOf, waiting } from "./test-utils"
import type { State } from "./types"

// Rulebook, pages 2 to 4: the column of three equal cards, the end of a round, its count, and the end of the game.

describe("three equal cards in a column (page 2)", () => {
  /** ana shows 6 and 6 in the first column and holds the way to a third; the discard shows `top`. */
  const withPair = (top: number) => layout({ players: 3, deck: [6, 3], discard: [top, 9], grids: { ana: [up(6), up(6), 11, up(2), 5, 5] } })

  it("throws the column away when a card taken from the discard completes it: the three go on the discard after the card that was replaced", () => {
    let state = withPair(6)
    const hidden = values(state, [state.grids[0]![2]!.card])[0]!
    state = take(state, "ana")
    const result = step(state, { type: "place", playerId: "ana", position: 2 })
    state = result.state
    expect(gridValues(state, "ana").slice(0, 3)).toEqual([null, null, null])
    expect(gridUp(state, "ana").slice(0, 3)).toEqual([null, null, null])
    // 6, 6, 6 on top, over the card that was in the cell, over the 9 that was under the 6
    expect(values(state, state.discard)).toEqual([6, 6, 6, hidden, 9])
    expect(kinds(result)).toEqual(["place", "column"])
    expect(result.events[1]!.event).toMatchObject({ kind: "column", by: "ana", column: 0, value: 6, cards: [{ type: "card-6" }, { type: "card-6" }, { type: "card-6" }] })
    expect(problems(state)).toEqual([])
    expect(state.stats[0]!.columns).toBe(1)
  })

  it("throws it away when a card drawn from the pile completes it", () => {
    const state = place(draw(withPair(2), "ana"), "ana", 2)
    expect(gridValues(state, "ana").slice(0, 3)).toEqual([null, null, null])
    expect(values(state, state.discard).slice(0, 3)).toEqual([6, 6, 6])
  })

  it("throws it away when the card that completes it is one turned over (after throwing the drawn card away)", () => {
    // the third cell of the column is face down and worth 6: turning it over makes three 6s
    let state = layout({ players: 3, deck: [12], discard: [3], grids: { ana: [up(6), up(6), 6, up(2)] } })
    state = flip(discard(draw(state, "ana"), "ana"), "ana", 2)
    expect(gridValues(state, "ana").slice(0, 3)).toEqual([null, null, null])
    expect(values(state, state.discard).slice(0, 4)).toEqual([6, 6, 6, 12])
    expect(problems(state)).toEqual([])
  })

  it("works with negative cards and with zeros", () => {
    for (const value of [-2, -1, 0, 12]) {
      let state = layout({ players: 2, deck: [value], grids: { ana: [up(value), up(value), 7] } })
      state = place(draw(state, "ana"), "ana", 2)
      expect(gridValues(state, "ana").slice(0, 3), `${value}`).toEqual([null, null, null])
    }
  })

  it("does not throw away a column that is equal but not all face up", () => {
    // the third 6 lies face down: nothing happens until it is turned over
    const state = layout({ players: 2, grids: { ana: [up(6), up(6), 6] } })
    expect(gridValues(state, "ana").slice(0, 3)).toEqual([6, 6, 6])
    expect(gridUp(state, "ana").slice(0, 3)).toEqual([true, true, false])
  })

  it("does not throw away a column of two equal cards and one different", () => {
    const state = place(draw(layout({ players: 2, deck: [4], grids: { ana: [up(6), up(6), 5] } }), "ana"), "ana", 2)
    expect(gridValues(state, "ana").slice(0, 3)).toEqual([6, 6, 4])
  })

  it("leaves the other columns where they are, and the hole stays in the grid for good", () => {
    let state = place(draw(withPair(2), "ana"), "ana", 2)
    expect(gridValues(state, "ana")[3]).toBe(2)
    expect(gridUp(state, "ana")[3]).toBe(true)
    // the next time ana plays, the hole is not a cell: she can neither place on it nor see anything there
    state = discard(draw(state, "bob"), "bob")
    state = flip(state, "bob", 0)
    state = discard(draw(state, "cleo"), "cleo")
    state = flip(state, "cleo", 0)
    expect(waiting(state)).toEqual(["ana"])
    state = draw(state, "ana")
    for (const position of [0, 1, 2]) expect(refusal(() => place(state, "ana", position))).toBe("INVALID_POSITION")
    expect(viewOf(state, "bob").players[0]!.cells.slice(0, 3)).toEqual([null, null, null])
  })

  it("can be done by an opponent's turn as well as one's own: every player gets the rule", () => {
    let state = layout({ players: 3, deck: [5], discard: [8], grids: { bob: [up(5), up(5), 1] }, stage: { kind: "choose", player: "bob" } })
    state = place(draw(state, "bob"), "bob", 2)
    expect(gridValues(state, "bob").slice(0, 3)).toEqual([null, null, null])
  })

  it("can empty a whole grid: the player then has no card face down, and ends the round", () => {
    let state = layout({
      players: 2,
      deck: [4],
      grids: { ana: [null, null, null, null, null, null, null, null, null, up(4), up(4), 9] },
      stage: { kind: "choose", player: "ana" },
    })
    state = place(draw(state, "ana"), "ana", 11)
    expect(gridValues(state, "ana")).toEqual(Array.from({ length: 12 }, () => null))
    expect(state.ender).toBe(0)
    expect(state.stats[0]!.columns).toBe(1)
    expect(waiting(state)).toEqual(["bob"])
  })
})

describe("the end of a round (page 3)", () => {
  /** ana has 11 cards face up and one down; she turns it over to end the round. */
  const nearEnd = () => {
    const faceUp = [up(1), up(2), up(3), up(4), up(5), up(6), up(7), up(8), up(9), up(10), up(11), 12]
    return layout({
      players: 3,
      deck: [7, 7, 7, 7, 7, 7],
      discard: [1],
      grids: { ana: faceUp, bob: [up(0), up(0), 5, up(3), 4, 4, 5, 5, 5, 6, 6, 6], cleo: [up(2), up(2), 5, up(3), 4, 4, 5, 5, 5, 6, 6, 6] },
      stage: { kind: "choose", player: "ana" },
    })
  }
  const endByFlip = (state: State) => flip(discard(draw(state, "ana"), "ana"), "ana", 11)

  it("goes on after a player has turned all their cards over: the others each play one more turn, in order, then the round is counted", () => {
    let state = endByFlip(nearEnd())
    expect(state.ender).toBe(0)
    expect(state.stage).toMatchObject({ kind: "choose", seat: 1 })
    expect(viewOf(state, "bob").players.map((seat) => seat.lastTurn)).toEqual(["ender", "pending", "pending"])
    expect(viewOf(state, "bob").ender).toBe("ana")
    state = flip(discard(draw(state, "bob"), "bob"), "bob", 2)
    expect(viewOf(state, "bob").players.map((seat) => seat.lastTurn)).toEqual(["ender", "done", "pending"])
    expect(waiting(state)).toEqual(["cleo"])
    expect(state.rounds).toHaveLength(0)
    state = flip(discard(draw(state, "cleo"), "cleo"), "cleo", 2)
    expect(state.stage.kind).toBe("between")
    expect(state.rounds).toHaveLength(1)
  })

  it("lets the last turns be played like any other: take or draw, place or throw away", () => {
    let state = endByFlip(nearEnd())
    state = place(take(state, "bob"), "bob", 2)
    // the discard shows the 7 that ana threw away
    expect(gridValues(state, "bob")[2]).toBe(7)
    expect(waiting(state)).toEqual(["cleo"])
  })

  it("does not let a player who finishes later be the one who ends it: the first to turn all cards over keeps that role", () => {
    let state = endByFlip(layout({
      players: 3,
      deck: [7, 7],
      discard: [1],
      grids: { ana: [up(1), up(2), up(3), up(4), up(5), up(6), up(7), up(8), up(9), up(10), up(11), 12], bob: [up(0), up(0), up(3), up(3), 4, 4, 5, 5, 5, 6, 6, 6] },
      stage: { kind: "choose", player: "ana" },
    }))
    // bob turns his last cards over during his last turn: he is not the ender
    expect(state.ender).toBe(0)
    state = flip(discard(draw(state, "bob"), "bob"), "bob", 4)
    expect(state.ender).toBe(0)
  })

  it("counts the cards still face down: they are turned over, face up, in the grid left on the table", () => {
    let state = endByFlip(nearEnd())
    state = flip(discard(draw(state, "bob"), "bob"), "bob", 2)
    state = flip(discard(draw(state, "cleo"), "cleo"), "cleo", 2)
    for (const id of state.seats) expect(gridUp(state, id).every((u) => u === true || u === null), id).toBe(true)
    expect(problems(state)).toEqual([])
  })

  it("scores the sum of every card, the negative ones taking points off", () => {
    let state = layout({
      players: 2,
      deck: [0, 0],
      discard: [3],
      grids: { ana: [up(-2), up(-1), up(0), up(1), up(2), up(3), up(4), up(5), up(6), up(7), up(8), 9], bob: [up(12), up(11), up(10), 9, 8, 7, 6, 5, 4, 3, 2, 1] },
      stage: { kind: "choose", player: "ana" },
    })
    state = flip(discard(draw(state, "ana"), "ana"), "ana", 11)
    state = flip(discard(draw(state, "bob"), "bob"), "bob", 3)
    // ana: -2 -1 0 +1+2+3+4+5+6+7+8+9 = 42; bob: 12+11+10+(9+8+...) the rest of the cards, one turned (9 replaced? turned, not replaced)
    expect(state.rounds[0]![0]).toBe(42)
    expect(state.rounds[0]![1]).toBe(12 + 11 + 10 + 9 + 8 + 7 + 6 + 5 + 4 + 3 + 2 + 1)
  })

  it("writes the count in the log with who ended the round and whether the points were doubled", () => {
    const grid = [5, 6, 7, 8, 9, 10, 11, 12, 4, 3, 2, 1]
    let state = layout({ players: 2, deck: [0, 0], discard: [1], grids: { ana: grid.map((v, i) => (i === 11 ? v : up(v))), bob: [up(0), up(0), up(1), up(1), up(2), up(2), up(3), up(3), up(4), up(4), up(5), 5] }, stage: { kind: "choose", player: "ana" } })
    state = flip(discard(draw(state, "ana"), "ana"), "ana", 11)
    const last = step(discard(draw(state, "bob"), "bob"), { type: "flip", playerId: "bob", position: 11 })
    // ana has 78 against bob's 30: her points are doubled, which takes her past 100 and ends the game
    expect(kinds(last)).toEqual(["reveal", "end", "over"])
    expect(last.events[1]!.event).toMatchObject({ kind: "end", scores: [156, 30], ender: "ana", doubled: true })
    expect(last.events[2]!.event).toEqual({ kind: "over", winners: ["bob"] })
  })
})

describe("a round's score, played from the state (page 3)", () => {
  /** Every player has the cell `hidden` face down and the others face up; the first player turns theirs over and ends the round, the others each play one last turn. */
  function played(rows: Record<string, number[]>, hidden = 11): State {
    const names = Object.keys(rows)
    const grids = Object.fromEntries(names.map((id) => [id, rows[id]!.map((v, i) => (i === hidden ? v : up(v)))]))
    let state = layout({ players: names, deck: names.map(() => 12), discard: [12], grids, stage: { kind: "choose", player: names[0]! } })
    for (const id of names) state = flip(discard(draw(state, id), id), id, hidden)
    return state
  }
  const total = (cards: number[]) => cards.reduce((a, b) => a + b, 0)
  // grids of the box (no column of three equal cards, no more copies of a value than the box has) worth 10, 24, 24, 0 and -2
  const TEN_A = [-2, -1, 0, 6, 0, -1, 0, 5, 0, 4, 0, -1]
  const TEN_B = [-1, -1, 0, 5, 0, -1, 0, 5, 0, 4, 0, -1]
  const TWENTY_FOUR_A = [3, 2, 2, 3, 2, 2, 3, 2, 2, 2, 1, 0]
  const TWENTY_FOUR_B = [4, 3, 1, 4, 3, 1, 4, 3, 1, 1, 0, -1]
  const ZERO = [1, 0, -1, 2, 0, -2, 0, 1, -1, 0, 1, -1]
  const MINUS = [-2, -1, 1, 0, 0, -1, 1, 0, 0, 0, -1, 1]

  it("has the grids it says: 10, 24, 24, 0 and below zero", () => {
    expect([total(TEN_A), total(TEN_B), total(TWENTY_FOUR_A), total(TWENTY_FOUR_B), total(ZERO)]).toEqual([10, 10, 24, 24, 0])
    expect(total(MINUS)).toBeLessThan(0)
  })

  it("keeps the ender's sum when it is strictly the lowest", () => {
    const state = played({ ana: TEN_A, bob: TWENTY_FOUR_A, cleo: TWENTY_FOUR_B })
    expect(state.rounds[0]).toEqual([10, 24, 24])
    expect(state.stats[0]).toMatchObject({ ended: 1, doubled: 0 })
  })

  it("doubles it when somebody else scored less", () => {
    const state = played({ ana: TWENTY_FOUR_B, bob: TEN_A, cleo: TWENTY_FOUR_A })
    expect(state.rounds[0]).toEqual([48, 10, 24])
    expect(state.stats[0]).toMatchObject({ ended: 1, doubled: 1 })
  })

  it("doubles it on a tie for the lowest: the rulebook's example, 10 against 24 and 10 makes 20", () => {
    const state = played({ ana: TEN_A, bob: TWENTY_FOUR_A, cleo: TEN_B })
    expect(state.rounds[0]).toEqual([20, 24, 10])
  })

  it("does not double a count that is not positive: zero, tied or not, and below zero", () => {
    expect(played({ ana: ZERO, bob: TEN_A, cleo: ZERO }).rounds[0]).toEqual([0, 10, 0])
    expect(played({ ana: MINUS, bob: MINUS.map((_, i) => MINUS[(i + 3) % 12]!), cleo: TEN_A }).rounds[0]).toEqual([total(MINUS), total(MINUS), 10])
  })

  it("scores the other players as they are, whoever ended the round", () => {
    const state = played({ ana: TWENTY_FOUR_A, bob: TEN_A, cleo: TWENTY_FOUR_B })
    expect(state.rounds[0]![1]).toBe(10)
    expect(state.rounds[0]![2]).toBe(24)
  })

  it("throws away, when counting, the columns that the last cards turned over make: they add nothing", () => {
    // bob's last card turns over a third 4 in a column of two 4s: the column goes, and bob scores the rest
    const bob = [4, 4, 4, 1, 1, 0, 0, 1, 1, 0, 2, 1]
    const state = played({ ana: [12, 12, 11, 11, 11, 10, 12, 12, 10, 9, 9, 9].map((v, i) => (i === 2 ? 3 : v)), bob }, 2)
    expect(state.stats[1]!.columns).toBe(1)
    expect(state.rounds[0]![1]).toBe(bob.reduce((a, b) => a + b) - 12)
  })

  it("adds up over the rounds", () => {
    const state = played({ ana: TEN_A, bob: TWENTY_FOUR_A })
    expect(GAME.view(state, "ana").standings).toEqual([{ playerId: "ana", score: 10 }, { playerId: "bob", score: 24 }])
  })
})

describe("between two rounds, and the end of the game (page 4)", () => {
  const TEN = [-2, -1, 0, 6, 0, -1, 0, 5, 0, 4, 0, -1]
  const TWENTY_FOUR = [3, 2, 2, 3, 2, 2, 3, 2, 2, 2, 1, 0]
  function between(rounds: number[][], ender: number[] = TEN, others = TWENTY_FOUR): State {
    const names = ["ana", "bob"]
    const rows: Record<string, number[]> = { ana: ender, bob: others }
    const grids = Object.fromEntries(names.map((id) => [id, rows[id]!.map((v, i) => (i === 11 ? v : up(v)))]))
    let state = layout({ players: names, deck: [12, 12], discard: [12], grids, rounds, stage: { kind: "choose", player: "ana" }, dealer: "bob" })
    for (const id of names) state = flip(discard(draw(state, id), id), id, 11)
    return state
  }

  it("waits for the dealer to deal the next round, and the deal passes one seat on", () => {
    const state = between([])
    expect(state.stage.kind).toBe("between")
    // bob dealt this round: ana deals the next
    expect(waiting(state)).toEqual(["ana"])
    expect(viewOf(state, "bob").phase).toEqual({ kind: "between", dealer: "ana" })
    expect(refusal(() => deal(state, "bob"))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => step(state, { type: "draw", playerId: "ana" }))).toBe("INVALID_PHASE")
    expect(refusal(() => step(state, { type: "reveal", playerId: "ana", position: 0 }))).toBe("INVALID_PHASE")
  })

  it("deals the next round from all 150 cards, shuffled again, and the players open it again", () => {
    const state = between([])
    const next = deal(state, "ana")
    expect(next.stage).toEqual({ kind: "reveal" })
    expect(next.deck).toHaveLength(150 - 24 - 1)
    expect(next.discard).toHaveLength(1)
    expect(next.ender).toBeNull()
    expect(next.last).toEqual([])
    expect(next.rounds).toEqual(state.rounds)
    expect(next.grids.every((grid) => grid.length === 12 && grid.every((cell) => cell !== null && !cell.up))).toBe(true)
    expect(problems(next)).toEqual([])
    expect(next.grids).not.toEqual(state.grids)
    expect(waiting(next)).toEqual(["ana", "bob"])
    expect(viewOf(next, "ana").round).toBe(2)
  })

  it("keeps going while nobody has 100: the lowest does not win yet", () => {
    const state = between([[40, 60]])
    expect(GAME.isOver(state)).toBe(false)
    expect(viewOf(state, "ana").results).toBeNull()
    expect(waiting(state)).toEqual(["ana"])
  })

  it("ends the game as soon as a player reaches 100 exactly, and the lowest total wins", () => {
    const state = between([[20, 76]]) // bob: 76 + 24 = 100, ana: 20 + 10 = 30
    expect(GAME.isOver(state)).toBe(true)
    expect(waiting(state)).toEqual([])
    const results = viewOf(state, "ana").results!
    expect(results.winners).toEqual(["ana"])
    expect(results.players.map((player) => [player.playerId, player.total, player.rank])).toEqual([["ana", 30, 1], ["bob", 100, 2]])
    expect(viewOf(state, null).phase).toEqual({ kind: "over" })
    expect(refusal(() => deal(state, "ana"))).toBe("GAME_OVER")
  })

  it("ends the game above 100 too", () => {
    expect(GAME.isOver(between([[10, 90]]))).toBe(true)
  })

  it("is not over at 99", () => {
    expect(GAME.isOver(between([[10, 75]]))).toBe(false)
  })

  it("is won by the lowest even when the player who reached 100 ended the round with fewer points than another round's: ana ends at 100 and bob is lower", () => {
    const state = between([[90, 20]], [3, 2, 2, 3, 2, 2, 3, 2, 2, 2, 1, 0], TEN) // ana ends with 24 and is doubled to 48, bob scores 10
    expect(state.rounds.at(-1)).toEqual([48, 10])
    expect(viewOf(state, "ana").results!.winners).toEqual(["bob"])
  })

  it("shares the win when the lowest total is tied (the rulebook is silent: to validate)", () => {
    const tied = layout({ players: 3, rounds: [[100, 100, 100]], stage: { kind: "between" } })
    expect(GAME.isOver(tied)).toBe(true)
    expect(viewOf(tied, null).results!.winners).toEqual(["ana", "bob", "cleo"])
    expect(viewOf(tied, null).results!.players.map((player) => player.rank)).toEqual([1, 1, 1])
  })

  it("lets a total go below zero: the negative points are subtracted", () => {
    const state = between([[-8, 50]], [-2, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], TWENTY_FOUR)
    expect(state.rounds.at(-1)![0]).toBe(-3)
    expect(GAME.view(state, "ana").standings[0]!.score).toBe(-11)
  })

  it("scores in the final results: rounds played, best round, columns, rounds ended, rounds doubled", () => {
    const state = between([[20, 76]])
    const ana = viewOf(state, "ana").results!.players.find((player) => player.playerId === "ana")!
    expect(ana.detail).toEqual([
      { key: "rounds", points: 2 },
      { key: "bestRound", points: 10 },
      { key: "columns", points: 0 },
      { key: "ended", points: 1 },
      { key: "doubled", points: 0 },
    ])
  })
})

describe("the draw pile running out", () => {
  it("shuffles the discard into a new pile, keeping its top card in view, and goes on drawing", () => {
    // 4 cards left on the table in the discard, the draw pile is empty
    const state = layout({ players: 2, deck: [], discard: [3, 4, 5, 6, 7], rest: "away" })
    // the layout left every other card in nobody's hands: give the rest to the discard so that all 150 are somewhere
    const full: State = { ...state, discard: [...state.discard, ...state.ids.filter((id) => ![...state.discard, ...state.grids.flat().map((cell) => cell!.card)].includes(id))] }
    expect(problems(full)).toEqual([])
    const result = step(full, { type: "draw", playerId: "ana" })
    expect(kinds(result)).toEqual(["reshuffle", "draw"])
    expect(result.state.discard).toEqual([full.discard[0]])
    expect(result.state.deck.length + 1 /* the card held */).toBe(full.discard.length - 1)
    expect(problems(result.state)).toEqual([])
  })

  it("is the same shuffle for the same state", () => {
    const state = layout({ players: 2, deck: [], rest: "away", discard: [3, 4, 5] })
    const full: State = { ...state, discard: [...state.discard, ...state.ids.filter((id) => ![...state.discard, ...state.grids.flat().map((cell) => cell!.card)].includes(id))] }
    expect(step(full, { type: "draw", playerId: "ana" }).state).toEqual(step(full, { type: "draw", playerId: "ana" }).state)
  })

  it("refuses a draw when no card is left anywhere but the top of the discard (it cannot happen with 8 players)", () => {
    const state = layout({ players: 2, deck: [], rest: "away", discard: [3] })
    const stripped: State = { ...state, deck: [] }
    expect(refusal(() => step(stripped, { type: "draw", playerId: "ana" }))).toBe("INVALID_PHASE")
  })
})

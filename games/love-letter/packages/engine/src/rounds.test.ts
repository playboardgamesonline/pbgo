import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { CATALOGUE } from "./catalogue"
import { GAME } from "./game"
import { tokensToWin } from "./options"
import { type Layout, areaNames, cardIn, deal, handNames, kinds, layout, names, newState, problems, refusal, seatIn, seedOf, tokens, viewOf, waiting } from "./test-utils"

// Rulebook, pp. 6-7 and 13: the end of a round, the favor tokens, the Spy's token, the next round and the end of the game.
//
// A round that ends is rigged to end on the next move: the deck is empty, and the player of the turn (`ana` unless the test says) holds a Countess and the card
// they keep. They play the Countess, which does nothing (p. 9), and the round is counted (p. 6: after any turn, if the deck is empty).

/** A table at its last turn: the deck is empty, the player of the turn plays their Countess and keeps their other card. */
function lastTurn(spec: Layout = {}) {
  const who = spec.turn ?? "ana"
  const state = layout({ deck: [], rest: "away", ...spec, turn: who, hands: { [who]: ["countess", "guard"], ...spec.hands } })
  return GAME.step!(state, { type: "play", playerId: who, card: cardIn(state, who, "countess") })
}

describe("the end of a round on the deck (p. 6)", () => {
  it("is counted after the turn that leaves the deck empty: the players still in lay their hands face up and the highest value wins", () => {
    const { state, events } = lastTurn({ hands: { bob: ["priest"], cleo: ["baron"] } })
    expect(state.stage).toMatchObject({ kind: "between", revealed: true, winners: [2], spy: null })
    expect(tokens(state)).toEqual([0, 0, 1])
    expect(kinds({ events })).toEqual(["play", "reveal", "end"])
    expect(events[1]!.event).toEqual({ kind: "reveal", hands: [{ player: "ana", card: expect.objectContaining({ type: "guard" }) as unknown }, { player: "bob", card: expect.objectContaining({ type: "priest" }) as unknown }, { player: "cleo", card: expect.objectContaining({ type: "baron" }) as unknown }] })
    expect(events[2]!.event).toEqual({ kind: "end", how: "deck", winners: ["cleo"], spy: null })
  })

  it("gives every tied player the win, each a token (p. 6)", () => {
    const { state } = lastTurn({ hands: { bob: ["baron"], cleo: ["baron"] } })
    expect(state.stage).toMatchObject({ kind: "between", winners: [1, 2] })
    expect(tokens(state)).toEqual([0, 1, 1])
  })

  it("lets the lowest card lose, the Spy at 0 being the lowest (pp. 2, 6)", () => {
    const { state } = lastTurn({ hands: { ana: ["countess", "spy"], bob: ["guard"], cleo: ["spy"] } })
    expect(state.stage).toMatchObject({ winners: [1] })
    expect(tokens(state)).toEqual([0, 1, 0])
  })

  it("does not end while the deck holds a card: the next player draws it (p. 6)", () => {
    const state = layout({ turn: "ana", hands: { ana: ["countess", "guard"] }, deck: ["spy"], rest: "away" })
    const after = step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "countess") }).state
    expect(after.stage).toEqual({ kind: "play" })
    expect(waiting(after)).toEqual(["bob"])
    expect(after.deck).toEqual([])
  })

  it("ends after the turn of the player who draws the last card, and not before (p. 6)", () => {
    const state = layout({ turn: "ana", hands: { ana: ["countess", "guard"], bob: ["priest"], cleo: ["baron"] }, deck: ["spy"], rest: "away" })
    const bobs = step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "countess") }).state
    expect(bobs.stage).toEqual({ kind: "play" })
    const after = step(bobs, { type: "play", playerId: "bob", card: cardIn(bobs, "bob", "spy") }).state
    expect(after.stage).toMatchObject({ kind: "between", revealed: true })
  })
})

describe("the end of a round with one player left (p. 6)", () => {
  it("ends at once, with the deck still full: the player left wins and nothing is revealed", () => {
    const state = layout({ turn: "ana", hands: { ana: ["countess", "guard"] }, out: ["bob", "cleo"] })
    expect(state.deck.length).toBeGreaterThan(0)
    const { state: after, events } = GAME.step!(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "countess") })
    expect(after.stage).toMatchObject({ kind: "between", revealed: false, winners: [0] })
    expect(tokens(after)).toEqual([1, 0, 0])
    expect(kinds({ events })).toEqual(["play", "end"])
    expect(events[1]!.event).toEqual({ kind: "end", how: "last", winners: ["ana"], spy: null })
  })

  it("does not lay the hand of the player left face up (p. 6 asks for no reveal)", () => {
    const state = layout({ turn: "ana", hands: { ana: ["countess", "guard"] }, out: ["bob", "cleo"] })
    const after = step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "countess") }).state
    for (const viewer of ["ana", "bob", null]) expect(viewOf(after, viewer).players[0]!.hand).toBeNull()
  })
})

describe("the Spy's token (p. 13)", () => {
  it("goes to the only player still in the round who played or discarded a Spy, besides the win, which it is not (p. 13)", () => {
    const { state } = lastTurn({ hands: { bob: ["priest"], cleo: ["baron"] }, areas: { ana: ["spy"] } })
    expect(tokens(state)).toEqual([1, 0, 1])
    expect(state.spies).toEqual([1, 0, 0])
    expect(state.won).toEqual([0, 0, 1])
    expect(state.stage).toMatchObject({ spy: 0 })
  })

  it("is gained besides the token of the round when it is the same player who wins (p. 13)", () => {
    const { state, events } = lastTurn({ hands: { ana: ["countess", "princess"], bob: ["priest"], cleo: ["baron"] }, areas: { ana: ["spy"] } })
    expect(state.won).toEqual([1, 0, 0])
    expect(state.spies).toEqual([1, 0, 0])
    expect(events.at(-1)!.event).toEqual({ kind: "end", how: "deck", winners: ["ana"], spy: "ana" })
  })

  it("is earned by nobody when two players played or discarded a Spy (p. 13)", () => {
    const { state } = lastTurn({ hands: { bob: ["priest"], cleo: ["baron"] }, areas: { ana: ["spy"], bob: ["spy"] } })
    expect(state.spies).toEqual([0, 0, 0])
    expect(state.stage).toMatchObject({ spy: null })
  })

  it("is gained once, whatever the number of Spies a player played or discarded (p. 13)", () => {
    const { state } = lastTurn({ hands: { bob: ["priest"], cleo: ["baron"] }, areas: { ana: ["spy", "spy"] } })
    expect(state.spies).toEqual([1, 0, 0])
  })

  it("is not earned by a Spy that is still in a hand, revealed or not (p. 13)", () => {
    const { state } = lastTurn({ hands: { ana: ["countess", "spy"], bob: ["priest"], cleo: ["baron"] } })
    expect(state.spies).toEqual([0, 0, 0])
  })

  it("is earned although a player who is out played a Spy: their Spy counts for nothing, for them and for the others (the reading validated for p. 13)", () => {
    const { state } = lastTurn({ hands: { cleo: ["baron"] }, areas: { ana: ["spy"], bob: ["spy"] }, out: ["bob"] })
    expect(state.spies).toEqual([1, 0, 0])
    expect(state.won).toEqual([0, 0, 1])
  })

  it("is earned by the player left in the round when the round ends at once (p. 13)", () => {
    const state = layout({ turn: "ana", hands: { ana: ["countess", "guard"] }, areas: { ana: ["spy"] }, out: ["bob", "cleo"] })
    const after = step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "countess") }).state
    expect(after.won).toEqual([1, 0, 0])
    expect(after.spies).toEqual([1, 0, 0])
  })
})

describe("the next round (p. 7)", () => {
  const ended = () => lastTurn({ hands: { bob: ["priest"], cleo: ["baron"] }, won: { ana: 1 }, spies: { bob: 1 }, shielded: ["bob"], areas: { bob: ["handmaid"] } }).state

  it("is dealt by the player who won the last one, who takes the first turn, and nobody else is waited for", () => {
    const state = ended()
    expect(state.turn).toBe(2)
    expect(waiting(state)).toEqual(["cleo"])
    expect(viewOf(state, "ana").phase).toEqual({ kind: "between", next: "cleo", winners: ["cleo"], spy: null, revealed: true })
  })

  it("refuses a deal by anybody else (NOT_YOUR_TURN), and a play before the deal (INVALID_PHASE)", () => {
    const state = ended()
    expect(refusal(() => deal(state, "ana"))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => step(state, { type: "play", playerId: "cleo", card: state.hands[2]![0]! }))).toBe("INVALID_PHASE")
  })

  it("starts with steps 2 to 4 of the setup again: all 21 cards shuffled, one aside, one card each, and the first player draws (p. 7)", () => {
    const after = deal(ended(), "cleo")
    expect(after.stage).toEqual({ kind: "play" })
    expect(after.round).toBe(2)
    expect(after.turn).toBe(2)
    expect(after.deck).toHaveLength(17 - 1)
    after.hands.forEach((hand, seat) => expect(hand, `seat ${seat}`).toHaveLength(seat === 2 ? 2 : 1))
    expect(problems(after)).toEqual([])
    expect(names(after, [...after.deck, after.aside!, ...after.hands.flat()]).sort()).toEqual([...CATALOGUE].sort())
  })

  it("keeps only the favor tokens: nothing played, nobody out, no Handmaid protecting anybody (the reading validated for pp. 5, 7, 11)", () => {
    const before = ended()
    expect(before.areas.flat().length).toBeGreaterThan(0)
    const after = deal(before, "cleo")
    expect(after.areas.every((area) => area.length === 0)).toBe(true)
    expect(after.out.every((out) => !out)).toBe(true)
    expect(after.shielded.every((shielded) => !shielded)).toBe(true)
    expect(after.won).toEqual(before.won)
    expect(after.spies).toEqual(before.spies)
  })

  it("shuffles the cards again, those of the last round included", () => {
    const decks = new Set<string>()
    for (let i = 0; i < 6; i++) {
      const after = deal(lastTurn({ hands: { bob: ["priest"], cleo: ["baron"] }, seed: seedOf(i) }).state, "cleo")
      decks.add(JSON.stringify(names(after, after.deck)))
    }
    expect(decks.size).toBeGreaterThan(1)
  })

  it("sets three cards aside face up again at two players (p. 3)", () => {
    const state = layout({ players: 2, turn: "ana", hands: { ana: ["countess", "guard"], bob: ["priest"] }, deck: [], rest: "away" })
    const after = deal(step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "countess") }).state, "bob")
    expect(after.faceUp).toHaveLength(3)
    expect(after.deck).toHaveLength(15 - 1)
  })

  it("is first played by one of the tied winners, drawn by the stream when there are several (p. 7)", () => {
    const firsts = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const { state } = lastTurn({ hands: { bob: ["baron"], cleo: ["baron"] }, seed: seedOf(i) })
      expect([1, 2]).toContain(state.turn)
      firsts.add(state.turn)
    }
    expect([...firsts].sort()).toEqual([1, 2])
  })
})

describe("the end of the game (p. 7)", () => {
  it("comes when a player holds the favor tokens the number of players asks for: 6, 5, 4, 3, 3 at 2 to 6 players", () => {
    for (let n = 2; n <= 6; n++) {
      const needed = tokensToWin(n)
      const almost = lastTurn({ players: n, hands: { ana: ["countess", "princess"] }, won: { ana: needed - 1 } })
      expect(almost.state.won[0], `${n} players`).toBe(needed)
      expect(GAME.isOver(almost.state), `${n} players`).toBe(true)
      expect(kinds(almost).at(-1)).toBe("over")
      const short = lastTurn({ players: n, hands: { ana: ["countess", "princess"] }, won: { ana: needed - 2 } })
      expect(GAME.isOver(short.state), `${n} players, one token short`).toBe(false)
    }
  })

  it("waits for nobody once it is over, and refuses every action (GAME_OVER)", () => {
    const { state } = lastTurn({ hands: { ana: ["countess", "princess"] }, won: { ana: 5 }, players: 2 })
    expect(GAME.isOver(state)).toBe(true)
    expect(waiting(state)).toEqual([])
    expect(refusal(() => deal(state, "ana"))).toBe("GAME_OVER")
    expect(refusal(() => step(state, { type: "play", playerId: "bob", card: 1 }))).toBe("GAME_OVER")
    expect(viewOf(state, "ana").phase).toEqual({ kind: "over" })
  })

  it("goes on when nobody has enough: another round is dealt (p. 7)", () => {
    const { state } = lastTurn({ hands: { ana: ["countess", "princess"] }, won: { ana: 1 } })
    expect(GAME.isOver(state)).toBe(false)
    expect(waiting(state)).toEqual(["ana"])
  })

  it("counts the Spy's token as a favor token: it can win the game (p. 13)", () => {
    const { state } = lastTurn({ players: 3, hands: { bob: ["priest"], cleo: ["baron"] }, won: { ana: 3 }, spies: { ana: 0 }, areas: { ana: ["spy"] } })
    // ana holds 3 tokens of 5, a Spy's token makes 4: not enough, and cleo won the round
    expect(tokens(state)).toEqual([4, 0, 1])
    expect(GAME.isOver(state)).toBe(false)
    const { state: enough } = lastTurn({ players: 3, hands: { bob: ["priest"], cleo: ["baron"] }, won: { ana: 4 }, areas: { ana: ["spy"] } })
    expect(enough.spies).toEqual([1, 0, 0])
    expect(GAME.isOver(enough)).toBe(true)
  })

  it("lets several players win together: every player who holds at least the number wins, whatever their count above it (the reading validated for p. 7)", () => {
    // five players need 3: ana and bob each hold 2 and tie for the round, so both reach 3
    const tie = lastTurn({ players: 5, turn: "cleo", hands: { cleo: ["countess", "guard"], ana: ["baron"], bob: ["baron"] }, won: { ana: 2, bob: 2 } })
    expect(tokens(tie.state)).toEqual([3, 3, 0, 0, 0])
    expect(GAME.view(tie.state, null).results!.winners).toEqual(["ana", "bob"])
    // ana also earns the Spy's token: 4 against 3, and both still win
    const more = lastTurn({ players: 5, turn: "cleo", hands: { cleo: ["countess", "guard"], ana: ["baron"], bob: ["baron"] }, won: { ana: 2, bob: 2 }, areas: { ana: ["spy"] } })
    expect(tokens(more.state)).toEqual([4, 3, 0, 0, 0])
    expect(GAME.view(more.state, null).results!.winners).toEqual(["ana", "bob"])
    expect(kinds(more).at(-1)).toBe("over")
    expect(more.events.at(-1)!.event).toEqual({ kind: "over", winners: ["ana", "bob"] })
  })

  it("has no winner while nobody has enough, and no results", () => {
    const state = newState(4, seedOf(3))
    expect(GAME.view(state, null).results).toBeNull()
    expect(GAME.view(state, "ana").results).toBeNull()
  })
})

describe("the results of a finished game", () => {
  it("rank the winners first and every other player after them, with no places among them (p. 7: the booklet gives none)", () => {
    const { state } = lastTurn({ players: 4, hands: { ana: ["countess", "princess"] }, won: { ana: 3, bob: 2, cleo: 1 } })
    const results = GAME.view(state, null).results!
    expect(results.winners).toEqual(["ana"])
    expect(results.players.map(({ playerId, rank, total }) => [playerId, rank, total])).toEqual([
      ["ana", 1, 4],
      ["bob", 2, 2],
      ["cleo", 2, 1],
      ["dan", 2, 0],
    ])
  })

  it("count a player's favor tokens as their total and say how they came: rounds played, rounds won, the Spy's tokens", () => {
    const { state } = lastTurn({ players: 3, hands: { ana: ["countess", "princess"] }, won: { ana: 4 }, spies: { ana: 0 }, round: 6 })
    const row = GAME.view(state, null).results!.players.find((player) => player.playerId === "ana")!
    expect(row.total).toBe(5)
    expect(row.detail).toEqual([
      { key: "rounds", points: 6 },
      { key: "won", points: 5 },
      { key: "spy", points: 0 },
    ])
  })

  it("are the same for every viewer, a spectator and a stranger included", () => {
    const { state } = lastTurn({ players: 2, hands: { ana: ["countess", "princess"] }, won: { ana: 5 } })
    const seen = [null, "stranger", ...state.seats].map((viewer) => GAME.view(state, viewer).results)
    for (const results of seen) expect(results).toEqual(seen[0])
  })
})

describe("who is where at the end of a round", () => {
  it("keeps the players' cards where they are for the board to show the finished round, the hands of the players still in face up to everybody (p. 6)", () => {
    const { state } = lastTurn({ hands: { bob: ["priest"], cleo: ["baron"] }, areas: { bob: ["handmaid"] } })
    for (const viewer of ["ana", "bob", "cleo", "stranger", null]) {
      const view = viewOf(state, viewer)
      expect(view.players.map((player) => player.hand?.map((face) => face.type)), String(viewer)).toEqual([["guard"], ["priest"], ["baron"]])
      expect(view.players[0]!.area.map((face) => face.type)).toEqual(["countess"])
    }
    expect(handNames(state, "cleo")).toEqual(["baron"])
    expect(areaNames(state, "bob")).toEqual(["handmaid"])
    expect(seatIn(state, "cleo")).toBe(2)
  })
})

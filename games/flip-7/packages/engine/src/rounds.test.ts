import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { CATALOGUE } from "./catalogue"
import { GAME } from "./game"
import {
  deal,
  deckTitles,
  discardTitles,
  hit,
  kinds,
  layout,
  lineTitles,
  newState,
  playRandomly,
  problems,
  refusal,
  seedOf,
  statusOf,
  stay,
  viewOf,
  waiting,
} from "./test-utils"

// "End of a round", "Calculate scores", "Starting the next round" and "End of the game" (booklet pages 9 to 12).

describe("a Flip 7", () => {
  const six = ["number-1", "number-2", "number-3", "number-4", "number-5", "number-6"] as const

  it("ends the round at once, with 15 points more: seven different numbers in front of a player (page 9)", () => {
    const before = layout({
      lines: { ana: ["number-2", "plus-4"], bob: [...six], cleo: ["number-3", "number-3"] },
      status: { cleo: "busted" },
      stack: [{ kind: "turn", player: "bob" }],
      deck: ["number-7", "number-8"],
    })
    const result = step(before, { type: "hit", playerId: "bob" })
    expect(kinds(result)).toEqual(["draw", "flip7", "end"])
    // bob: 1 + … + 7 = 28, and 15. ana, still in, banks what she holds (a reading: the booklet only says the round ends for everyone); cleo busted: nothing
    expect(result.state.rounds).toEqual([[6, 43, 0]])
    expect(result.state.status).toEqual(["stayed", "stayed", "busted"])
    expect(result.state.stats[1]).toEqual({ busts: 0, flip7: 1 })
    expect(deckTitles(result.state)[0]).toBe("number-8")
    expect(result.state.stack).toEqual([])
    expect(problems(result.state)).toEqual([])
  })

  it("is worth the doubled numbers, the modifiers, then 15 (page 11): the 15 is never doubled", () => {
    const state = hit(layout({ lines: { ana: ["number-0", "number-1", "number-2", "number-3", "number-4", "number-5", "times-2", "plus-6"] }, deck: ["number-6"] }), "ana")
    // (0 + 1 + … + 6) = 21, doubled 42, + 6, + 15
    expect(state.rounds).toEqual([[63, 0, 0]])
  })

  it("counts the zero: it only gives the chance of the bonus (page 2)", () => {
    const state = hit(layout({ lines: { ana: ["number-0", "number-1", "number-2", "number-3", "number-4", "number-5"] }, deck: ["number-6"] }), "ana")
    expect(state.rounds).toEqual([[36, 0, 0]])
  })

  it("is made of number cards only: modifiers and action cards do not count (page 5)", () => {
    const before = layout({ lines: { ana: [...six, "plus-2", "second-chance"] }, deck: ["plus-4", "number-7"] })
    const next = hit(before, "ana")
    expect(next.stack).not.toEqual([])
    expect(lineTitles(next, "ana")).toEqual([...six, "plus-2", "second-chance", "plus-4"])
    expect(waiting(next)).toBe("bob")
    expect(problems(next)).toEqual([])
  })

  it("is not made by a duplicate: a Second Chance spent on the way does not give a seventh number", () => {
    const state = hit(layout({ lines: { ana: [...six, "second-chance"] }, deck: ["number-6"] }), "ana")
    expect(state.rounds).toEqual([])
    expect(lineTitles(state, "ana")).toEqual(six)
  })
})

describe("the next round", () => {
  it("is dealt by the player on the left of the last dealer: the deck is passed to the left (page 12)", () => {
    const state = layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] } })
    const over = stay(stay(stay(state, "ana"), "bob"), "cleo")
    // cleo dealt this round, ana deals the next one
    expect(over.dealer).toBe(0)
    expect(waiting(over)).toBe("ana")
    expect(viewOf(over, "bob").phase).toEqual({ kind: "between", dealer: "ana" })
    expect(viewOf(over, "bob").dealer).toBe("ana")
  })

  it("is dealt by that player alone, and starts with the player on their left", () => {
    const over = stay(stay(stay(layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] }, deck: ["number-1", "number-2", "number-3", "number-4"] }), "ana"), "bob"), "cleo")
    expect(refusal(() => deal(over, "bob"))).toBe("NOT_YOUR_TURN")
    const result = step(over, { type: "deal", playerId: "ana" })
    expect(result.events[0]!.event).toEqual({ kind: "round", number: 2, dealer: "ana" })
    expect([lineTitles(result.state, "bob"), lineTitles(result.state, "cleo"), lineTitles(result.state, "ana")]).toEqual([["number-1"], ["number-2"], ["number-3"]])
    expect(waiting(result.state)).toBe("bob")
    expect(problems(result.state)).toEqual([])
  })

  it("sets the cards of the round aside without shuffling them back into the deck (page 12)", () => {
    const state = layout({
      lines: { ana: ["number-5", "plus-2"], bob: ["number-6"], cleo: ["second-chance"] },
      discard: ["number-12"],
      deck: ["number-1", "number-2", "number-3", "number-4"],
    })
    const over = stay(stay(stay(state, "ana"), "bob"), "cleo")
    // ana deals: bob 1, cleo 2, ana 3
    const next = deal(over, "ana")
    // the deck is the same deck, less the cards just dealt: it was not shuffled
    expect(deckTitles(next)[0]).toBe("number-4")
    expect(deckTitles(next)).toEqual(deckTitles(over).slice(3))
    // every card of the round is on the discard, above what was discarded before
    expect(discardTitles(next)).toEqual(["number-5", "plus-2", "number-6", "second-chance", "number-12"])
    expect(problems(next)).toEqual([])
  })

  it("puts every player back in the round, the busted ones too", () => {
    let state = layout({ lines: { ana: ["number-4"], bob: ["number-5"], cleo: ["number-6"] }, deck: ["number-4", "number-1", "number-2", "number-3", "number-8", "number-9"] })
    state = hit(state, "ana")
    expect(statusOf(state, "ana")).toBe("busted")
    state = stay(stay(state, "bob"), "cleo")
    expect(state.status).toEqual(["busted", "stayed", "stayed"])
    const next = deal(state, "ana")
    expect(next.status).toEqual(["active", "active", "active"])
    expect(next.lines.every((line) => line.length === 1)).toBe(true)
  })

  it("keeps what each player banked, round after round", () => {
    let state = layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] }, deck: ["number-1", "number-2", "number-3", "number-4"] })
    state = stay(stay(stay(state, "ana"), "bob"), "cleo")
    state = deal(state, "ana")
    // ana deals: bob 1, cleo 2, ana 3; bob plays first
    state = stay(stay(stay(state, "bob"), "cleo"), "ana")
    expect(state.rounds).toEqual([
      [5, 6, 7],
      [3, 1, 2],
    ])
    expect(viewOf(state, null).players.map((player) => player.total)).toEqual([8, 7, 9])
    expect(viewOf(state, null).round).toBe(2)
  })

  it("says the round number: the one going on, and the last one once it is over", () => {
    const state = layout({ lines: { ana: ["number-5"] }, rounds: [[1, 2, 3]] })
    expect(viewOf(state, null).round).toBe(2)
    expect(viewOf(stay(stay(stay(layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] } }), "ana"), "bob"), "cleo"), null).round).toBe(1)
  })
})

describe("running out of cards", () => {
  it("shuffles the discard into a new deck when the deck runs out, and leaves the cards in front of the players where they are (page 12)", () => {
    const before = layout({
      lines: { ana: ["number-9"], bob: ["number-10"], cleo: ["number-5", "number-5"] },
      status: { cleo: "busted" },
      discard: ["number-2", "number-3", "number-4"],
      deck: ["number-1"],
      rest: "away",
    })
    const first = step(before, { type: "hit", playerId: "ana" })
    expect(kinds(first)).toEqual(["draw"])
    expect(first.state.deck).toEqual([])
    const second = step(first.state, { type: "hit", playerId: "bob" })
    // the deck was empty: the discard is shuffled, then the card is drawn
    expect(kinds(second)).toEqual(["reshuffle", "draw"])
    expect(second.state.discard).toEqual([])
    expect([...deckTitles(second.state), ...lineTitles(second.state, "bob").slice(1)].sort()).toEqual(["number-2", "number-3", "number-4"])
    // the busted player's cards stayed where they were
    expect(lineTitles(second.state, "cleo")).toEqual(["number-5", "number-5"])
    expect(lineTitles(second.state, "ana")).toEqual(["number-9", "number-1"])
  })

  it("shuffles the same way from the same state: the stream of the shuffles is part of the state", () => {
    const before = layout({ lines: { ana: ["number-9"] }, discard: ["number-2", "number-3", "number-4", "number-6", "number-7"], deck: [], rest: "away" })
    const once = hit(before, "ana")
    const again = hit(before, "ana")
    expect(once).toEqual(again)
    expect(deckTitles(once)).toHaveLength(4)
  })

  it("draws from the cards of the round just finished when the deck runs out in the opening deal", () => {
    const state = layout({
      players: 3,
      dealer: "cleo",
      stack: [],
      lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] },
      status: { ana: "stayed", bob: "stayed", cleo: "stayed" },
      discard: ["number-3"],
      deck: ["number-1", "number-2"],
      rest: "away",
    })
    const result = step(state, { type: "deal", playerId: "cleo" })
    expect(kinds(result)).toEqual(["round", "draw", "draw", "reshuffle", "draw"])
    // four cards were left (the discard and the three of the last round): one is dealt to cleo, three remain
    expect(result.state.deck).toHaveLength(3)
    expect(result.state.discard).toEqual([])
  })

  it("ends the round as if everybody had stayed when there is no card left anywhere", () => {
    const before = layout({ lines: { ana: ["number-9"], bob: ["number-10", "plus-2"], cleo: ["number-5"] }, status: { cleo: "stayed" }, deck: [], rest: "away" })
    const result = step(before, { type: "hit", playerId: "ana" })
    expect(kinds(result)).toEqual(["end"])
    expect(result.state.rounds).toEqual([[9, 12, 5]])
    expect(result.state.status).toEqual(["stayed", "stayed", "stayed"])
  })
})

describe("the end of the game (page 12)", () => {
  /** ana, bob and cleo hold a card each and stay: a round that scores exactly these points. */
  const roundOf = (cards: readonly [string, string, string], rounds: number[][], options?: Record<string, unknown>) => {
    const state = layout({ lines: { ana: [cards[0] as never], bob: [cards[1] as never], cleo: [cards[2] as never] }, rounds, options })
    return stay(stay(stay(state, "ana"), "bob"), "cleo")
  }

  it("goes on while nobody has 200 points", () => {
    const state = roundOf(["number-12", "number-11", "number-10"], [[100, 100, 100]])
    expect(GAME.isOver(state)).toBe(false)
    expect(waiting(state)).toBe("ana")
    expect(viewOf(state, null).phase).toEqual({ kind: "between", dealer: "ana" })
    expect(viewOf(state, null).results).toBeNull()
  })

  it("ends at the end of the round that brings a player to 200", () => {
    const state = roundOf(["number-12", "number-4", "number-3"], [[190, 150, 100]])
    expect(GAME.isOver(state)).toBe(true)
    expect(waiting(state)).toBeUndefined()
    expect(viewOf(state, null).phase).toEqual({ kind: "over" })
    expect(viewOf(state, null).results?.winners).toEqual(["ana"])
  })

  it("is won by the player with the most points, not the first to reach 200", () => {
    const state = roundOf(["number-10", "number-12", "number-1"], [[190, 195, 0]])
    // ana 200, bob 207: both are past 200, bob has more
    expect(viewOf(state, null).results?.winners).toEqual(["bob"])
    expect(viewOf(state, null).results?.players.map((player) => [player.playerId, player.total, player.rank])).toEqual([
      ["bob", 207, 1],
      ["ana", 200, 2],
      ["cleo", 1, 3],
    ])
  })

  it("plays one more round when the best players are tied at 200 or more (the tie is not a win)", () => {
    const state = roundOf(["number-10", "number-12", "number-1"], [[190, 188, 0]])
    // ana 200 and bob 200
    expect(GAME.isOver(state)).toBe(false)
    expect(waiting(state)).toBe("ana")
    expect(viewOf(state, null).results).toBeNull()
    const next = deal(state, "ana")
    expect(problems(next)).toEqual([])
  })

  it("keeps playing rounds while the tie lasts, until one player is alone at the top (the booklet does not say)", () => {
    const again = (cards: readonly [string, string, string], from: { rounds: readonly (readonly number[])[] }) =>
      roundOf(cards, from.rounds.map((round) => [...round]))
    // ana and bob at 200, then at 210: the same points twice, still tied
    const tied = roundOf(["number-10", "number-10", "number-1"], [[190, 190, 0]])
    expect(GAME.isOver(tied)).toBe(false)
    const stillTied = again(["number-10", "number-10", "number-1"], tied)
    expect(stillTied.rounds.at(-1)).toEqual([10, 10, 1])
    expect(GAME.isOver(stillTied)).toBe(false)
    expect(waiting(stillTied)).toBe("ana")
    expect(viewOf(stillTied, null).results).toBeNull()
    // ana 222, bob 219: one player is alone at the top
    const broken = again(["number-12", "number-9", "number-1"], stillTied)
    expect(GAME.isOver(broken)).toBe(true)
    expect(viewOf(broken, null).results?.winners).toEqual(["ana"])
  })

  it("takes the score of the table's option: a lower target is a shorter game", () => {
    const short = roundOf(["number-12", "number-4", "number-3"], [[40, 10, 10]], { targetScore: 50 })
    expect(GAME.isOver(short)).toBe(true)
    expect(viewOf(short, null).target).toBe(50)
    const rules = roundOf(["number-12", "number-4", "number-3"], [[40, 10, 10]])
    expect(GAME.isOver(rules)).toBe(false)
    expect(viewOf(rules, null).target).toBe(200)
  })

  it("refuses everything once it is over, and waits for nobody", () => {
    const over = roundOf(["number-12", "number-4", "number-3"], [[190, 150, 100]])
    expect(refusal(() => deal(over, "ana"))).toBe("GAME_OVER")
    expect(refusal(() => hit(over, "ana"))).toBe("GAME_OVER")
    expect(refusal(() => step(over, { type: "stay", playerId: "bob" }))).toBe("GAME_OVER")
    expect(GAME.waitingFor!(over)).toEqual([])
  })

  it("tells what each player did over the game: points, ranks (ties share one) and stats", () => {
    const state = layout({
      lines: { ana: ["number-9"], bob: ["number-9"], cleo: ["number-1"] },
      rounds: [
        [100, 150, 120],
        [60, 0, 80],
      ],
      options: { targetScore: 200 },
    })
    const over = stay(stay(stay(state, "ana"), "bob"), "cleo")
    // ana 160 + 9, bob 150 + 9, cleo 200 + 1 → ana 169, bob 159, cleo 201
    const results = viewOf(over, null).results!
    expect(results.winners).toEqual(["cleo"])
    expect(results.players.map((player) => [player.playerId, player.total, player.rank])).toEqual([
      ["cleo", 201, 1],
      ["ana", 169, 2],
      ["bob", 159, 3],
    ])
    expect(results.players[0]!.detail.map((line) => line.key)).toEqual(["rounds", "bestRound", "flip7", "busts"])
    expect(results.players[0]!.detail.map((line) => line.points)).toEqual([3, 120, 0, 0])
  })

  it("shares a rank between tied players who are not first", () => {
    const state = layout({ lines: { ana: ["number-12"], bob: ["number-2"], cleo: ["number-2"] }, rounds: [[190, 50, 50]] })
    const over = stay(stay(stay(state, "ana"), "bob"), "cleo")
    expect(viewOf(over, null).results?.players.map((player) => [player.playerId, player.rank])).toEqual([
      ["ana", 1],
      ["bob", 2],
      ["cleo", 2],
    ])
  })
})

describe("a whole game", () => {
  it("is played to the end from any seed, with every card in one place all along", () => {
    for (let i = 0; i < 5; i++) {
      const seed = seedOf(20 + i)
      const states = playRandomly(newState(3 + i, seed), seed)
      const last = states.at(-1)!
      expect(GAME.isOver(last), `game ${i}`).toBe(true)
      for (const state of states) expect(problems(state), `game ${i}`).toEqual([])
      expect(last.rounds.every((scores) => scores.length === last.seats.length)).toBe(true)
      expect(last.deck.length + last.discard.length + last.lines.flat().length).toBe(CATALOGUE.length)
    }
  })
})

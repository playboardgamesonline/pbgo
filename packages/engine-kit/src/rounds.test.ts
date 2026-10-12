import { describe, expect, it } from "vitest"
import { addScores, leaders, ranks, roundsOutcome, sumRounds, type RoundsRule } from "./rounds"

const flip7: RoundsRule = { target: 200, wins: "high", tie: "playOn" }
const skyjo: RoundsRule = { target: 100, wins: "low", tie: "shared" }

describe("addScores", () => {
  it("adds the scores of a round to the totals, seat by seat", () => {
    expect(addScores([10, 0, 25], [5, 7, -3])).toEqual([15, 7, 22])
  })

  it("does not modify its input", () => {
    const totals = [1, 2]
    const scores = [3, 4]
    addScores(totals, scores)
    expect(totals).toEqual([1, 2])
    expect(scores).toEqual([3, 4])
  })

  it("refuses scores that do not match the seats", () => {
    expect(() => addScores([1, 2, 3], [1, 2])).toThrow(RangeError)
    expect(() => addScores([1], [1, 2])).toThrow(RangeError)
  })
})

describe("sumRounds", () => {
  it("adds up the rounds seat by seat", () => {
    expect(
      sumRounds(
        [
          [3, 0, 7],
          [1, 4, 0],
          [0, 2, 2],
        ],
        3,
      ),
    ).toEqual([4, 6, 9])
  })

  it("gives zeros before the first round", () => {
    expect(sumRounds([], 3)).toEqual([0, 0, 0])
    expect(sumRounds([], 0)).toEqual([])
  })

  it("refuses a round that does not match the seats", () => {
    expect(() => sumRounds([[1, 2]], 3)).toThrow(RangeError)
    expect(() => sumRounds([], -1)).toThrow(RangeError)
    expect(() => sumRounds([], 1.5)).toThrow(RangeError)
  })

  it("agrees with adding the rounds one by one", () => {
    const rounds = [
      [5, 1],
      [0, 9],
      [4, 4],
    ]
    expect(sumRounds(rounds, 2)).toEqual(rounds.reduce((totals, scores) => addScores(totals, scores), [0, 0]))
  })
})

describe("leaders", () => {
  it("finds the highest total or the lowest", () => {
    expect(leaders([10, 30, 20], "high")).toEqual([1])
    expect(leaders([10, 30, 20], "low")).toEqual([0])
  })

  it("lists every seat of a tie, in seat order", () => {
    expect(leaders([30, 10, 30], "high")).toEqual([0, 2])
    expect(leaders([5, 5, 5], "low")).toEqual([0, 1, 2])
  })

  it("finds the best of negative totals", () => {
    expect(leaders([-4, -10, 0], "high")).toEqual([2])
    expect(leaders([-4, -10, 0], "low")).toEqual([1])
  })

  it("has no leader without a seat", () => {
    expect(leaders([], "high")).toEqual([])
    expect(leaders([], "low")).toEqual([])
  })
})

describe("ranks", () => {
  it("ranks from 1, the highest total first when high wins", () => {
    expect(ranks([10, 30, 20], "high")).toEqual([3, 1, 2])
  })

  it("ranks the lowest total first when low wins", () => {
    expect(ranks([10, 30, 20], "low")).toEqual([1, 3, 2])
  })

  it("gives a tie the same rank and skips the next ones", () => {
    expect(ranks([30, 10, 30, 20], "high")).toEqual([1, 4, 1, 3])
    expect(ranks([5, 5, 9], "low")).toEqual([1, 1, 3])
  })

  it("ranks like the games always did: 1 + the players strictly ahead", () => {
    const totals = [12, 7, 12, 3, 7]
    expect(ranks(totals, "high")).toEqual(totals.map((t) => 1 + totals.filter((o) => o > t).length))
  })
})

describe("roundsOutcome", () => {
  it("is not over while nobody reached the target", () => {
    expect(roundsOutcome([120, 80, 199], flip7)).toEqual({ over: false })
    expect(roundsOutcome([10, 40, 99], skyjo)).toEqual({ over: false })
  })

  it("ends when a total reaches the target exactly, or goes above it", () => {
    expect(roundsOutcome([200, 80], flip7)).toEqual({ over: true, winners: [0] })
    expect(roundsOutcome([120, 230], flip7)).toEqual({ over: true, winners: [1] })
  })

  it("makes the highest total win when high wins, even for a player who did not reach the target", () => {
    expect(roundsOutcome([210, 215, 190], flip7)).toEqual({ over: true, winners: [1] })
  })

  it("makes the lowest total win when low wins: the one who reached the target loses", () => {
    expect(roundsOutcome([104, 42, 77], skyjo)).toEqual({ over: true, winners: [1] })
  })

  it("plays on when the best total is tied, if the rule says so", () => {
    expect(roundsOutcome([220, 220, 150], flip7)).toEqual({ over: false })
  })

  it("plays on a tie for the best total only: a tie for another place does not matter", () => {
    expect(roundsOutcome([230, 150, 150], flip7)).toEqual({ over: true, winners: [0] })
  })

  it("shares the win when the best total is tied, if the rule says so", () => {
    expect(roundsOutcome([105, 30, 30], skyjo)).toEqual({ over: true, winners: [1, 2] })
  })

  it("plays on a tie when low wins and the rule says so", () => {
    const rule: RoundsRule = { target: 66, wins: "low", tie: "playOn" }
    expect(roundsOutcome([70, 20, 20], rule)).toEqual({ over: false })
    expect(roundsOutcome([70, 20, 25], rule)).toEqual({ over: true, winners: [1] })
  })

  it("counts tokens: first to the target wins", () => {
    const loveLetter: RoundsRule = { target: 4, wins: "high", tie: "playOn" }
    expect(roundsOutcome([3, 2], loveLetter)).toEqual({ over: false })
    expect(roundsOutcome([4, 2], loveLetter)).toEqual({ over: true, winners: [0] })
  })

  it("never ends a game without a seat", () => {
    expect(roundsOutcome([], flip7)).toEqual({ over: false })
  })

  it("plays a whole game: totals from the rounds, then the outcome", () => {
    const rounds: number[][] = []
    const scores = [
      [60, 20, 35],
      [70, 55, 10],
      [40, 90, 45],
      [80, 35, 60],
    ]
    const seen: boolean[] = []
    for (const round of scores) {
      rounds.push(round)
      seen.push(roundsOutcome(sumRounds(rounds, 3), flip7).over)
    }
    expect(seen).toEqual([false, false, false, true])
    expect(roundsOutcome(sumRounds(rounds, 3), flip7)).toEqual({ over: true, winners: [0] })
  })
})

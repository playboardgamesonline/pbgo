import { describe, expect, it } from "vitest"
import type { PlayerResult, Results } from "./contract"
import { outcomesOf, PLAYER_OUTCOMES, type PlayerOutcome } from "./outcomes"
import { leaders, ranks } from "./rounds"

const row = (playerId: string, rank: number, total = 0): PlayerResult => ({ playerId, rank, total, detail: [] })

/** The results of a game won by the best total, built the way the engines do. */
function ranked(totals: Record<string, number>): Results {
  const ids = Object.keys(totals)
  const values = ids.map((id) => totals[id]!)
  const rank = ranks(values, "high")
  return { players: ids.map((id, i) => row(id, rank[i]!, values[i])), winners: leaders(values, "high").map((i) => ids[i]!) }
}

const outcomes = (results: Results) => Object.fromEntries(outcomesOf(results).map(({ playerId, outcome }) => [playerId, outcome]))

describe("outcomesOf", () => {
  it("gives a win to the winner and a loss to the others", () => {
    expect(outcomes(ranked({ a: 10, b: 7, c: 3 }))).toEqual({ a: "win", b: "loss", c: "loss" })
  })

  it("gives a win to players who tie for the first place among others: they beat the rest", () => {
    expect(outcomes(ranked({ a: 10, b: 10, c: 3 }))).toEqual({ a: "win", b: "win", c: "loss" })
  })

  it("gives a draw to everybody when every player is a winner", () => {
    expect(outcomes(ranked({ a: 5, b: 5 }))).toEqual({ a: "draw", b: "draw" })
    expect(outcomes(ranked({ a: 5, b: 5, c: 5 }))).toEqual({ a: "draw", b: "draw", c: "draw" })
  })

  it("gives a win to a player alone at the table, since there is no one to draw with", () => {
    expect(outcomes(ranked({ a: 4 }))).toEqual({ a: "win" })
  })

  it("does not take a tie for another place for a draw", () => {
    expect(outcomes(ranked({ a: 9, b: 4, c: 4 }))).toEqual({ a: "win", b: "loss", c: "loss" })
  })

  it("gives a team the outcome of its members: all of them are winners, the other team loses", () => {
    const team: Results = { players: [row("a", 1), row("b", 3), row("c", 1), row("d", 3)], winners: ["a", "c"] }
    expect(outcomes(team)).toEqual({ a: "win", b: "loss", c: "win", d: "loss" })
  })

  it("gives the whole table the same outcome when it plays together, whoever is among the winners", () => {
    const won: Results = { players: [row("a", 1, 25), row("b", 1, 25)], winners: ["a", "b"], coop: "won" }
    const lost: Results = { players: [row("a", 1, 11), row("b", 1, 11)], winners: [], coop: "lost" }
    expect(outcomes(won)).toEqual({ a: "coop_win", b: "coop_win" })
    expect(outcomes(lost)).toEqual({ a: "coop_loss", b: "coop_loss" })
  })

  it("lists the players in the order of the results, one outcome each", () => {
    const results = ranked({ c: 1, a: 8, b: 3 })
    expect(outcomesOf(results).map(({ playerId }) => playerId)).toEqual(["c", "a", "b"])
  })
})

describe("PLAYER_OUTCOMES", () => {
  it("is what outcomesOf can give, and nothing else", () => {
    const seen = new Set<PlayerOutcome>()
    for (const results of [
      ranked({ a: 2, b: 1 }),
      ranked({ a: 1, b: 1 }),
      { players: [row("a", 1), row("b", 1)], winners: ["a", "b"], coop: "won" } satisfies Results,
      { players: [row("a", 1), row("b", 1)], winners: [], coop: "lost" } satisfies Results,
    ])
      for (const { outcome } of outcomesOf(results)) seen.add(outcome)
    expect([...seen].sort()).toEqual([...PLAYER_OUTCOMES].sort())
  })
})

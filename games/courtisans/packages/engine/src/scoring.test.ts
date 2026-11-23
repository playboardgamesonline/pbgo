import { describe, expect, it } from "vitest"
import { results } from "./results"
import { computeStatuses } from "./scoring"
import { type CardSpec, card, layout } from "./test-utils"
import type { Level } from "./types"

/** The Queen's table of the rulebook's example: 19 cards, the families above and below the mat. */
const BOOKLET_TABLE: (readonly [CardSpec, Level])[] = [
  [card("butterfly"), "up"],
  [card("butterfly"), "up"],
  [card("butterfly"), "down"],
  [card("toad", "noble"), "up"],
  [card("toad", "noble"), "up"],
  [card("nightingale"), "up"],
  [card("nightingale"), "up"],
  [card("nightingale", "noble"), "down"],
  [card("nightingale"), "down"],
  [card("hare", "spy"), "up"],
  [card("hare"), "down"],
  [card("hare", "noble"), "down"],
  [card("stag", "noble"), "up"],
  [card("stag"), "up"],
  [card("stag"), "down"],
  [card("carp"), "up"],
  [card("carp"), "up"],
  [card("carp"), "down"],
  [card("carp"), "down"],
]

describe("computeStatuses", () => {
  it("matches the rulebook example (nobles count double, spies count by family)", () => {
    const statuses = computeStatuses(layout({ table: BOOKLET_TABLE }))
    expect(statuses.butterfly.status).toBe("light")
    expect(statuses.toad).toEqual({ up: 4, down: 0, status: "light" })
    expect(statuses.stag.status).toBe("light")
    expect(statuses.carp.status).toBe("neutral")
    expect(statuses.nightingale).toEqual({ up: 2, down: 3, status: "disgrace" })
    expect(statuses.hare.status).toBe("disgrace")
  })

  it("is the same for every family with no card at the table: neutral", () => {
    for (const standing of Object.values(computeStatuses(layout()))) expect(standing).toEqual({ up: 0, down: 0, status: "neutral" })
  })
})

describe("results", () => {
  it("gives a player 11 points like in the rulebook: 8 for their domain and 3 for the mission that holds", () => {
    // the hares are in disgrace at the table (the first mission holds), the carp are neutral there (the second fails)
    const holds = "mission-dark-4"
    const fails = "mission-dark-1"
    const domain = [
      card("butterfly", "noble"),
      card("butterfly"),
      card("toad"),
      card("toad"),
      card("toad"),
      card("nightingale", "noble"),
      card("nightingale"),
      card("stag", "noble"),
      card("stag", "noble"),
      card("stag"),
      // a guard weighs one, like the plain courtier of the rulebook: the box holds four plain carp, and the table has them
      card("carp", "guard"),
      card("carp", "noble"),
    ]
    const state = layout({ players: ["noemie", "bea"], table: BOOKLET_TABLE, domains: { noemie: domain, bea: [card("hare")] }, missions: { noemie: [holds, fails], bea: [] } })
    const final = results(state)!
    const noemie = final.players.find((player) => player.playerId === "noemie")!
    expect(noemie.domainPoints).toBe(8)
    expect(noemie.missions).toEqual([
      { missionId: holds, done: true, points: 3 },
      { missionId: fails, done: false, points: 0 },
    ])
    expect(noemie.total).toBe(11)
    expect(noemie.detail).toEqual([
      { key: "domain", points: 8 },
      { key: "missions", points: 3 },
    ])
    expect(final.winners).toEqual(["noemie"])
    expect(final.players[1]).toMatchObject({ playerId: "bea", total: -1, rank: 2 })
  })

  it("lists the families of a domain with the weight and the points of each, and leaves out those it holds none of", () => {
    const state = layout({ players: 2, table: [[card("stag"), "down"]], domains: { ana: [card("stag", "noble"), card("hare")] } })
    const final = results(state)!
    expect(final.players.find((player) => player.playerId === "ana")!.families).toEqual([
      { family: "hare", weight: 1, points: 0 },
      { family: "stag", weight: 2, points: -2 },
    ])
  })

  it("shares the victory on a tie, and gives the next player the rank that follows", () => {
    const state = layout({ players: 3, table: [[card("stag"), "down"]], domains: { cleo: [card("stag")] } })
    const final = results(state)!
    expect(final.winners).toEqual(["ana", "bob"])
    expect(final.players.map((player) => player.rank)).toEqual([1, 1, 3])
    // a tie keeps the seat order
    expect(final.players.map((player) => player.playerId)).toEqual(["ana", "bob", "cleo"])
  })

  it("is nothing while the game goes: nobody holds more than the cards of the turn", () => {
    expect(results(layout({ hands: { ana: [card("stag")] } }))).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import { computeResults, computeStatuses } from "./scoring"
import { card, makeState, player, place } from "./test-utils"
import type { Mission } from "./types"

function bookletTable() {
  return [
    place(card("butterfly"), "up"),
    place(card("butterfly"), "up"),
    place(card("butterfly"), "down"),
    place(card("toad", "noble"), "up"),
    place(card("toad", "noble"), "up"),
    place(card("nightingale"), "up"),
    place(card("nightingale"), "up"),
    place(card("nightingale", "noble"), "down"),
    place(card("nightingale"), "down"),
    place(card("hare", "spy"), "up"),
    place(card("hare"), "down"),
    place(card("hare", "noble"), "down"),
    place(card("stag", "noble"), "up"),
    place(card("stag"), "up"),
    place(card("stag"), "down"),
    place(card("carp"), "up"),
    place(card("carp"), "up"),
    place(card("carp"), "down"),
    place(card("carp"), "down"),
  ]
}

describe("computeStatuses", () => {
  it("matches the rulebook example (nobles count double, spies count by famille)", () => {
    const statuses = computeStatuses(bookletTable())
    expect(statuses.butterfly.status).toBe("light")
    expect(statuses.toad).toEqual({ up: 4, down: 0, status: "light" })
    expect(statuses.stag.status).toBe("light")
    expect(statuses.carp.status).toBe("neutral")
    expect(statuses.nightingale).toEqual({ up: 2, down: 3, status: "disgrace" })
    expect(statuses.hare.status).toBe("disgrace")
  })
})

describe("computeResults", () => {
  it("gives Noëmie 11 points like in the rulebook", () => {
    const mission: Mission = {
      id: "m1",
      color: "white",
      text: "Les lièvres doivent être en disgrâce à la cour.",
      condition: { type: "familyStatus", family: "hare", status: "disgrace" },
    }
    const failed: Mission = { ...mission, id: "m2", condition: { type: "familyStatus", family: "carp", status: "light" } }
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
      card("carp"),
      card("carp", "noble"),
    ]
    const state = makeState({
      phase: "over",
      table: bookletTable(),
      players: [player("noemie", { domain, missions: [mission, failed] }), player("b", { domain: [card("hare")] })],
    })
    const results = computeResults(state)
    const noemie = results.players.find((j) => j.playerId === "noemie")!
    expect(noemie.domainPoints).toBe(8)
    expect(noemie.missions).toEqual([
      { missionId: "m1", done: true, points: 3 },
      { missionId: "m2", done: false, points: 0 },
    ])
    expect(noemie.total).toBe(11)
    expect(results.winners).toEqual(["noemie"])
    expect(results.players[1]).toMatchObject({ playerId: "b", total: -1, rank: 2 })
  })

  it("shares the victory on a tie", () => {
    const state = makeState({ phase: "over", players: [player("a"), player("b"), player("c", { domain: [card("stag")] })], table: [place(card("stag"), "down")] })
    const results = computeResults(state)
    expect(results.winners.sort()).toEqual(["a", "b"])
    expect(results.players.map((j) => j.rank)).toEqual([1, 1, 3])
  })
})

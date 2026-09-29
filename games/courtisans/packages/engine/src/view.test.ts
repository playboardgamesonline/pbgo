import { describe, expect, it } from "vitest"
import { applyAction } from "./actions"
import { card, makeState, player } from "./test-utils"
import { playerView } from "./view"

describe("playerView", () => {
  const spy = card("hare", "spy")
  const state = makeState({
    players: [player("a", { hand: [spy, card("stag"), card("stag")] }), player("b", { hand: [card("carp")] })],
    deck: [card("toad")],
  })
  const after = applyAction(state, { type: "playCard", playerId: "a", cardId: spy.id, target: { zone: "table", level: "up" } })

  it("only exposes the viewer's own hand and missions", () => {
    const view = playerView(after, "a")
    expect(view.me?.hand).toHaveLength(2)
    expect(view.players[1]).toMatchObject({ handCount: 1, missions: null })
    expect(JSON.stringify(view)).not.toContain("carp")
    expect(view.deckCount).toBe(1)
  })

  it("hides the famille of played espions, even from their owner and in the journal", () => {
    const view = playerView(after, "a")
    expect(view.table[0]!.card).toEqual({ id: spy.id, family: null, role: "spy" })
    expect(view.log[0]).toMatchObject({ type: "cardPlayed", card: { family: null, role: "spy" } })
  })

  it("reveals everything at the end with resultats", () => {
    const view = playerView({ ...after, phase: "over" }, "b")
    expect(view.table[0]!.card.family).toBe("hare")
    expect(view.results?.players).toHaveLength(2)
    expect(view.players[0]!.missions).toEqual([])
  })

  it("lists the zones still available this turn", () => {
    expect(playerView(after, "a").availableZones).toEqual(["domain", "opponentDomain"])
  })
})

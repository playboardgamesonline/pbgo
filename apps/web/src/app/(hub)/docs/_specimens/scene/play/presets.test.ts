import { describe, expect, it } from "vitest"
import { PLAY_DECK, PLAY_LIMITS, PLAY_PARTS } from "../defaults"
import { cellAt, cellCentres, planOf } from "./geometry"
import { DEFAULT_PRESET, PRESET_IDS, PRESETS, presetState } from "./presets"

describe("the scenes", () => {
  it("each switch on exactly the parts they say, and are fresh every time", () => {
    for (const id of PRESET_IDS) {
      const state = presetState(id)
      expect(PLAY_PARTS.filter((part) => state.parts[part]).sort(), id).toEqual([...PRESETS[id].parts].sort())
      expect(presetState(id)).not.toBe(state)
    }
  })

  it("start inside the limits of the table, with ids that are all different", () => {
    for (const id of PRESET_IDS) {
      const s = presetState(id)
      expect(s.things.length).toBeLessThanOrEqual(PLAY_LIMITS.things)
      expect(s.hand.cards.length).toBeLessThanOrEqual(PLAY_DECK.hand)
      expect(s.zoom).toBeGreaterThanOrEqual(PLAY_LIMITS.zoom.min)
      const ids = [...s.things.map((t) => t.id), ...s.hand.cards.map((c) => c.id), ...s.held.map((c) => c.id), ...s.piles.discard.map((c) => c.id)]
      expect(new Set(ids).size, id).toBe(ids.length)
      expect(Math.min(...ids)).toBeLessThan(s.nextId)
      expect(Math.max(...ids), id).toBeLessThan(s.nextId)
      expect(s.piles.drawn).toBeLessThanOrEqual(PLAY_DECK.size)
    }
  })

  it("seat the players that have plates with cards in hand, and put the board's pieces on cells", () => {
    const card = presetState("card")
    expect(card.layout).toEqual({ hand: "corner", piles: "middle" })
    expect(new Set(card.held.map((h) => h.seat))).toEqual(new Set([1, 2, 3]))
    const board = presetState("board")
    const centres = cellCentres(planOf(board.board))
    for (const piece of board.things) expect(cellAt(centres, piece, 0.1)).toBeGreaterThanOrEqual(0)
  })

  it("begin with the card game", () => {
    expect(DEFAULT_PRESET).toBe("card")
    expect(PRESET_IDS[0]).toBe(DEFAULT_PRESET)
  })
})

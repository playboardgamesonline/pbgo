import { describe, expect, it } from "vitest"
import { presetState } from "./presets"
import { runTransition, TRANSITION_IDS, TRANSITIONS } from "./transitions"
import { SHORTCUTS } from "./shortcuts"

describe("runTransition", () => {
  it("switches on the parts a transition needs, and then does it", () => {
    const s = runTransition(presetState("empty"), "discard")
    expect(s.parts.hand && s.parts.piles).toBe(true)
    expect(s.piles.discard).toHaveLength(1)
  })

  it("deals a card that flies in from the draw pile", () => {
    const s = runTransition(presetState("card"), "deal")
    expect(s.hand.cards.at(-1)?.from).toBeGreaterThan(0)
  })

  it("says so in the log when there is nothing to move, and changes nothing else", () => {
    const empty = presetState("card")
    const bare = { ...empty, hand: { ...empty.hand, cards: [] } }
    const s = runTransition(bare, "playCard")
    expect(s.things).toEqual(bare.things)
    expect(s.log[0]).toMatch(/nothing to move/)
  })

  it("passes cards round the seats", () => {
    const s = runTransition(presetState("card"), "pass")
    expect(s.log[0]).toMatch(/Passed 4 cards/)
  })

  it("has a shortcut in the help for every key written on a button", () => {
    for (const id of TRANSITION_IDS) {
      const { key } = TRANSITIONS[id]
      if (key) expect(SHORTCUTS.some((shortcut) => shortcut.keys.length === 1 && shortcut.keys[0] === key), id).toBe(true)
    }
  })
})

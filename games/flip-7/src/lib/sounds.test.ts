import type { Flip7Event } from "@flip-7/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import { describe, expect, it } from "vitest"
import { cuesOf, FLIP_7_SOUND, SOUNDS } from "./sounds"

const line = (event: Flip7Event): LogLine<Flip7Event> => ({ v: 1, event })
const KINDS: Flip7Event["kind"][] = ["round", "draw", "stay", "bust", "saved", "play", "discarded", "reshuffle", "flip7", "end", "over"]
const sample = (kind: Flip7Event["kind"]): Flip7Event => {
  const card = { id: 1, type: "number-7" }
  switch (kind) {
    case "round":
      return { kind, number: 1, dealer: "a" }
    case "draw":
      return { kind, by: "a", card, how: "hit" }
    case "stay":
      return { kind, by: "a", points: 3 }
    case "bust":
      return { kind, by: "a", card }
    case "saved":
      return { kind, by: "a", card, secondChance: card }
    case "play":
      return { kind, by: "a", target: "b", card }
    case "discarded":
      return { kind, by: "a", card }
    case "reshuffle":
      return { kind }
    case "flip7":
      return { kind, by: "a" }
    case "end":
      return { kind, scores: [1, 2] }
    case "over":
      return { kind, winners: ["a"] }
  }
}

describe("the sounds of Flip 7", () => {
  it("declare the shared effects as they are, and three of their own", () => {
    for (const name of ["click", "turn", "victory", "hover", "select", "slide", "place"]) expect(SOUNDS.effects, name).toHaveProperty(name)
    for (const name of ["bust", "reshuffle", "flip7"]) expect(SOUNDS.effects, name).toHaveProperty(name)
  })

  it("make a sound for a bust when the stamp lands, and for a reshuffle at once, and for no other line: the cards that move make their own", () => {
    expect(cuesOf(line(sample("bust")), 1.4)).toEqual([{ name: "bust", delay: 1.4 }])
    expect(cuesOf(line(sample("reshuffle")), 1.4)).toEqual([{ name: "reshuffle" }])
    for (const kind of KINDS.filter((k) => k !== "bust" && k !== "reshuffle")) expect(cuesOf(line(sample(kind)), 1.4), kind).toEqual([])
  })

  it("only play effects the game declares: a sound that is not declared is not played", () => {
    for (const kind of KINDS) for (const cue of cuesOf(line(sample(kind)), 0)) expect(Object.keys(SOUNDS.effects), cue.name).toContain(cue.name)
    expect(Object.keys(SOUNDS.effects)).toContain(FLIP_7_SOUND)
  })
})

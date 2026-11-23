import type { LoveLetterEvent } from "@love-letter/engine"
import { SHARED_EFFECTS } from "@pbgo/core/lib/sound-config"
import { describe, expect, it } from "vitest"
import { cuesOf, SOUNDS } from "./sounds"

const line = (event: LoveLetterEvent) => ({ v: 1, event })
const face = (id: number) => ({ id, type: "guard" as const })

describe("the sounds of the game", () => {
  it("declare every shared effect, so that the cards, the announcements and the buttons are heard, and the game's own beside them", () => {
    for (const name of Object.keys(SHARED_EFFECTS)) expect(SOUNDS.effects, name).toHaveProperty(name)
    expect(SOUNDS.effects).toHaveProperty("eliminate")
  })

  it("makes a sound for a player who is out of the round, whatever knocked them out, and for nothing a card shows", () => {
    for (const cause of ["guard", "baron", "princess"] as const) expect(cuesOf(line({ kind: "out", player: "ben", cards: [face(3)], cause })), cause).toEqual([{ name: "eliminate", delay: 0.35 }])
    expect(cuesOf(line({ kind: "play", by: "ana", card: face(1) }))).toEqual([])
    expect(cuesOf(line({ kind: "draw", by: "ana" }))).toEqual([])
    expect(cuesOf(line({ kind: "reveal", hands: [] }))).toEqual([])
    expect(cuesOf(line({ kind: "end", how: "last", winners: ["ana"], spy: null }))).toEqual([])
  })

  it("only names effects the game declares: a name that is not is never played", () => {
    const events: LoveLetterEvent[] = [{ kind: "out", player: "ben", cards: [], cause: "guard" }, { kind: "protect", by: "ana" }, { kind: "over", winners: ["ana"] }]
    for (const event of events) for (const cue of cuesOf(line(event))) expect(SOUNDS.effects, cue.name).toHaveProperty(cue.name)
  })
})

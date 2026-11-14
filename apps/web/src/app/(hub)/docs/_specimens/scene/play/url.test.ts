import { describe, expect, it } from "vitest"
import { PLAY_PARTS } from "../defaults"
import { PRESET_IDS, presetState } from "./presets"
import { decodeScene, encodeScene } from "./url"

describe("encodeScene and decodeScene", () => {
  it("write a table nobody changed as the name of its scene alone", () => {
    for (const id of PRESET_IDS) expect(encodeScene(presetState(id))).toBe(`s=${id}`)
  })

  it("bring back a scene as it starts", () => {
    for (const id of PRESET_IDS) expect(decodeScene(`#s=${id}`)?.state.parts).toEqual(presetState(id).parts)
  })

  it("carry what differs from the scene: parts, players, layouts, board, view", () => {
    const start = presetState("card")
    const changed = {
      ...start,
      parts: { ...start.parts, seats: false, dice: true },
      players: 7,
      hand: { ...start.hand, layout: "row" as const },
      layout: { hand: "edge" as const, piles: "edge" as const },
      zoom: 25.5,
      tilt: 12,
      above: true,
    }
    const hash = encodeScene(changed)
    const back = decodeScene(`#${hash}`)
    expect(back?.scene).toBe("card")
    expect(back?.state.parts.seats).toBe(false)
    expect(back?.state.parts.dice).toBe(true)
    expect(back?.state.players).toBe(7)
    expect(back?.state.hand.layout).toBe("row")
    expect(back?.state.layout).toEqual({ hand: "edge", piles: "edge" })
    expect([back?.state.zoom, back?.state.tilt, back?.state.above]).toEqual([25.5, 12, true])
  })

  it("moves what stands on the cells when the board changes its shape", () => {
    const start = presetState("board")
    const back = decodeScene("s=board&bs=hex")
    expect(back?.state.board.shape).toBe("hex")
    const [a, b] = [start.things[0]!, back!.state.things[0]!]
    expect([a.x, a.z]).not.toEqual([b.x, b.z])
  })

  it("leaves out what it does not know and brings numbers into range", () => {
    const back = decodeScene("s=card&on=seats.nonsense.&pl=99&z=-4&t=abc&hl=spiral")
    expect(back?.state.players).toBe(8)
    expect(back?.state.zoom).toBe(14)
    expect(back?.state.tilt).toBe(presetState("card").tilt)
    expect(back?.state.hand.layout).toBe("fan")
    expect(Object.keys(back!.state.parts).sort()).toEqual([...PLAY_PARTS].sort())
  })

  it("is null for a hash that names no scene", () => {
    for (const hash of ["", "#", "#s=nope", "#on=seats", "#x"]) expect(decodeScene(hash)).toBeNull()
  })
})

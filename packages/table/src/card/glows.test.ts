import { describe, expect, it } from "vitest"
import { defineGlows } from "./glows"

describe("defineGlows", () => {
  it("builds only the parts a glow names, filled in with the defaults", () => {
    const { selection } = defineGlows({ selection: { frame: {} } })
    expect(Object.keys(selection)).toEqual(["frame"])
    expect(selection.frame).toEqual({ color: "#ffffff", opacity: 0.75, pulse: 0.2, breath: 0.012, speed: 3 })
  })

  it("keeps what the spec sets and defaults the rest", () => {
    const { gold } = defineGlows({ gold: { halo: { color: "#f2c14e", spread: 0.14 }, sparkle: {} } })
    expect(gold.halo).toEqual({ color: "#f2c14e", opacity: 0.35, pulse: 0.03, speed: 1.6, spread: 0.14, blend: "add" })
    expect(gold.sparkle).toEqual({ opacity: 0.55, speed: 0.35 })
    expect(gold.frame).toBeUndefined()
    expect(gold.outline).toBeUndefined()
  })

  it("gives the red stain its outline and a halo that paints over the table", () => {
    const { red } = defineGlows({ red: { halo: { color: "#ff4d4d", opacity: 0.75, pulse: 0.06, blend: "normal" }, outline: { color: "#ff4d4d" } } })
    expect(red.halo?.blend).toBe("normal")
    expect(red.outline).toEqual({ color: "#ff4d4d", visible: true })
  })

  it("is a glow with no part at all when the spec names none", () => {
    expect(defineGlows({ none: {} }).none).toEqual({})
  })

  it("keeps every glow's name and gives each its own parts: tuning one never moves another", () => {
    const glows = defineGlows({ a: { frame: {} }, b: { frame: {} } })
    expect(Object.keys(glows)).toEqual(["a", "b"])
    expect(glows.a.frame).not.toBe(glows.b.frame)
    glows.a.frame!.opacity = 0.1
    expect(glows.b.frame!.opacity).toBe(0.75)
  })
})

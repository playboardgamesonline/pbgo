import { describe, expect, it } from "vitest"
import { engineOptionsOf } from "./table-options"

const offered = { expansions: ["bonus", "diplomats"], helpers: ["score"] }

describe("engineOptionsOf", () => {
  it("keeps the choices whose id is a key of the engine's options, on or off", () => {
    expect(engineOptionsOf({ expansions: ["bonus"], helpers: [] }, offered, ["bonus", "score"])).toEqual({ bonus: true, score: false })
  })

  it("turns an option off when its expansion is unticked", () => {
    expect(engineOptionsOf({ expansions: [], helpers: [] }, offered, ["bonus"])).toEqual({ bonus: false })
  })

  it("leaves in the page what the engine does not declare", () => {
    expect(engineOptionsOf({ expansions: ["diplomats"], helpers: ["score"] }, offered, ["rounds"])).toEqual({})
    expect(engineOptionsOf({ expansions: ["diplomats"], helpers: ["score"] }, offered, [])).toEqual({})
  })

  it("never invents an option: a key of the engine that the page does not offer is not in the answer", () => {
    expect(engineOptionsOf({ expansions: ["bonus"], helpers: [] }, offered, ["bonus", "rounds"])).toEqual({ bonus: true })
  })
})

import { describe, expect, it } from "vitest"
import { LINE_GAP, scheduleCues } from "./sound-cues"

describe("the cues of a line of the log", () => {
  it("are played as they are for the first line of a batch", () => {
    expect(scheduleCues([{ name: "slide" }, { name: "place", delay: 0.95, volume: 0.8 }], 0)).toEqual([
      { name: "slide", delay: 0 },
      { name: "place", delay: 0.95, volume: 0.8 },
    ])
  })

  it("are put back by the gap for every line of the batch before them", () => {
    const [first] = scheduleCues([{ name: "place", delay: 1 }], 3, 0.2)
    expect(first?.delay).toBeCloseTo(1.6)
  })

  it("use the shared gap when none is given", () => {
    expect(scheduleCues([{ name: "select" }], 2)[0]?.delay).toBeCloseTo(2 * LINE_GAP)
  })

  it("keep the volume and the bus of each cue and leave the cues given alone", () => {
    const given = [{ name: "turn", bus: "alerts" as const, volume: 0.5 }]
    expect(scheduleCues(given, 1)[0]).toMatchObject({ name: "turn", bus: "alerts", volume: 0.5 })
    expect(given[0]).toEqual({ name: "turn", bus: "alerts", volume: 0.5 })
  })

  it("are none for a line that makes no sound", () => {
    expect(scheduleCues([], 4)).toEqual([])
  })
})

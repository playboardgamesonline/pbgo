import { describe, expect, it } from "vitest"
import type { OptionDefinitions } from "./options"
import { choiceLabelKey, engineTextKeys, optionHelpKey, optionLabelKey, presetHelpKey, presetLabelKey, scoreLabelKey } from "./texts"

const options: OptionDefinitions = {
  rounds: { type: "number", defaultValue: 3, min: 1, max: 5 },
  mode: { type: "choice", defaultValue: "slow", choices: [{ value: "slow" }, { value: "fast" }] },
  bids: { type: "boolean", defaultValue: true },
}

describe("the keys of an engine's texts", () => {
  it("name the text, never hold it", () => {
    expect(optionLabelKey("rounds")).toBe("option.rounds.label")
    expect(optionHelpKey("rounds")).toBe("option.rounds.help")
    expect(choiceLabelKey("mode", "fast")).toBe("option.mode.choice.fast")
    expect(presetLabelKey("quick")).toBe("preset.quick.label")
    expect(presetHelpKey("quick")).toBe("preset.quick.help")
    expect(scoreLabelKey("round")).toBe("score.round")
  })
})

describe("engineTextKeys", () => {
  it("requires the label of every option and of every choice, and leaves the help optional", () => {
    expect(engineTextKeys({ options })).toEqual({
      required: ["option.rounds.label", "option.mode.label", "option.mode.choice.slow", "option.mode.choice.fast", "option.bids.label"],
      optional: ["option.rounds.help", "option.mode.help", "option.bids.help"],
    })
  })

  it("requires the label of every preset and of every line of score the definition lists", () => {
    const keys = engineTextKeys({ options: {}, presets: [{ id: "quick", values: {} }], scoreLines: ["round", "bonus"] })
    expect(keys.required).toEqual(["preset.quick.label", "score.round", "score.bonus"])
    expect(keys.optional).toEqual(["preset.quick.help"])
  })

  it("needs nothing from a game with no option, no preset and no known line", () => {
    expect(engineTextKeys({ options: {} })).toEqual({ required: [], optional: [] })
  })
})

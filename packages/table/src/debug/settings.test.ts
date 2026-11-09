import { describe, expect, it, vi } from "vitest"
import { inputs, subscribeSettings } from "./settings"

type Input = { value: unknown; label: string; min?: number; max?: number; step?: number; options?: unknown; onChange: (value: unknown, route: string, context: { initial: boolean }) => void }

const settings = { gloss: 0.5, easing: "linear", on: true, color: "#ffffff" }

describe("the inputs of a settings object", () => {
  it("make one input for each field listed, in that order, and none for the others", () => {
    const made = inputs(settings, { easing: "easing", gloss: ["gloss", 0, 1, 0.01] })
    expect(Object.keys(made)).toEqual(["easing", "gloss"])
  })

  it("start at the value of the object", () => {
    const made = inputs(settings, { gloss: ["gloss", 0, 1, 0.01], on: "on" }) as Record<string, Input>
    expect(made.gloss.value).toBe(0.5)
    expect(made.on.value).toBe(true)
  })

  it("give a number its label, its range and its step", () => {
    const { gloss } = inputs(settings, { gloss: ["shine", 0, 1, 0.01] }) as Record<string, Input>
    expect(gloss).toMatchObject({ label: "shine", min: 0, max: 1, step: 0.01 })
  })

  it("give a choice its label and its options, as a list or as a record", () => {
    const list = inputs(settings, { easing: ["flight easing", ["linear", "cubic"]] }) as Record<string, Input>
    expect(list.easing).toMatchObject({ label: "flight easing", options: ["linear", "cubic"] })
    const record = inputs(settings, { easing: ["flight easing", { slow: "linear" }] }) as Record<string, Input>
    expect(record.easing.options).toEqual({ slow: "linear" })
  })

  it("give a field with a label alone no range: a colour or a switch", () => {
    const { color } = inputs(settings, { color: "colour" }) as Record<string, Input>
    expect(color).toMatchObject({ value: "#ffffff", label: "colour" })
    expect(color.min).toBeUndefined()
  })
})

describe("moving a knob", () => {
  it("writes the value into the object and says that a setting changed", () => {
    const object = { gloss: 0.5 }
    const { gloss } = inputs(object, { gloss: ["gloss", 0, 1, 0.01] }) as Record<string, Input>
    const heard = vi.fn()
    const stop = subscribeSettings(heard)
    gloss.onChange(0.9, "Card.gloss", { initial: false })
    stop()
    expect(object.gloss).toBe(0.9)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it("writes the value the panel starts with, without saying that anything changed", () => {
    const object = { gloss: 0.5 }
    const { gloss } = inputs(object, { gloss: ["gloss", 0, 1, 0.01] }) as Record<string, Input>
    const heard = vi.fn()
    const stop = subscribeSettings(heard)
    gloss.onChange(0.5, "Card.gloss", { initial: true })
    stop()
    expect(object.gloss).toBe(0.5)
    expect(heard).not.toHaveBeenCalled()
  })

  it("stops telling whoever stopped listening", () => {
    const object = { gloss: 0.5 }
    const { gloss } = inputs(object, { gloss: ["gloss", 0, 1, 0.01] }) as Record<string, Input>
    const heard = vi.fn()
    subscribeSettings(heard)()
    gloss.onChange(0.9, "Card.gloss", { initial: false })
    expect(heard).not.toHaveBeenCalled()
  })
})

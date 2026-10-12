import { describe, expect, it } from "vitest"
import { allSubmitted, openSubmissions, pendingSubmissions, submittedFlags, type Submissions } from "./simultaneous"

describe("simultaneous submissions", () => {
  it("opens a step where nobody has submitted, in seat order", () => {
    const step = openSubmissions<number>(["c", "a", "b"])
    expect(step).toEqual({ c: null, a: null, b: null })
    expect(Object.keys(step)).toEqual(["c", "a", "b"])
    expect(pendingSubmissions(step)).toEqual(["c", "a", "b"])
    expect(allSubmitted(step)).toBe(false)
  })

  it("lists the pending players in seat order as the submissions come in", () => {
    let step: Submissions<number> = openSubmissions(["a", "b", "c"])
    step = { ...step, b: 2 }
    expect(pendingSubmissions(step)).toEqual(["a", "c"])
    step = { ...step, a: 0 }
    expect(pendingSubmissions(step)).toEqual(["c"])
    expect(allSubmitted(step)).toBe(false)
    step = { ...step, c: 1 }
    expect(pendingSubmissions(step)).toEqual([])
    expect(allSubmitted(step)).toBe(true)
  })

  it("counts a falsy submission (0, empty string, false) as submitted", () => {
    expect(allSubmitted<number>({ a: 0, b: 0 })).toBe(true)
    expect(pendingSubmissions<string>({ a: "", b: null })).toEqual(["b"])
    expect(pendingSubmissions<boolean>({ a: false, b: null })).toEqual(["b"])
  })

  it("treats a step without players as complete", () => {
    expect(allSubmitted(openSubmissions([]))).toBe(true)
  })

  it("exposes who submitted, never what", () => {
    const flags = submittedFlags<number>({ a: 3, b: null, c: 0 })
    expect(flags).toEqual({ a: true, b: false, c: true })
    expect(JSON.stringify(flags)).not.toContain("3")
  })

  it("does not modify its input", () => {
    const step = openSubmissions<number>(["a", "b"])
    pendingSubmissions(step)
    allSubmitted(step)
    submittedFlags(step)
    expect(step).toEqual({ a: null, b: null })
  })
})

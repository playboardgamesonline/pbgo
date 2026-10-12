import { describe, expect, it } from "vitest"
import { allSubmitted, openSubmissions, pendingSubmissions, submittedFlags, type Submissions } from "./simultaneous"

const SEATS = ["c", "a", "b"]

describe("simultaneous submissions", () => {
  it("opens a step where nobody has submitted", () => {
    const step = openSubmissions<number>(SEATS)
    expect(step).toEqual({ c: null, a: null, b: null })
    expect(pendingSubmissions(step, SEATS)).toEqual(["c", "a", "b"])
    expect(allSubmitted(step)).toBe(false)
  })

  it("lists the pending players in seat order as the submissions come in", () => {
    const seats = ["a", "b", "c"]
    let step: Submissions<number> = openSubmissions(seats)
    step = { ...step, b: 2 }
    expect(pendingSubmissions(step, seats)).toEqual(["a", "c"])
    step = { ...step, a: 0 }
    expect(pendingSubmissions(step, seats)).toEqual(["c"])
    expect(allSubmitted(step)).toBe(false)
    step = { ...step, c: 1 }
    expect(pendingSubmissions(step, seats)).toEqual([])
    expect(allSubmitted(step)).toBe(true)
  })

  it("takes the order from the seats, not from the keys (jsonb does not keep the order of the keys)", () => {
    const stored: Submissions<number> = JSON.parse('{"a":null,"b":null,"c":4}')
    expect(pendingSubmissions(stored, ["c", "b", "a"])).toEqual(["b", "a"])
    expect(pendingSubmissions(stored, ["a", "b", "c"])).toEqual(["a", "b"])
  })

  it("does not list a player who is not part of the step", () => {
    expect(pendingSubmissions<number>({ a: null }, ["a", "b"])).toEqual(["a"])
  })

  it("counts a falsy submission (0, empty string, false) as submitted", () => {
    expect(allSubmitted<number>({ a: 0, b: 0 })).toBe(true)
    expect(pendingSubmissions<string>({ a: "", b: null }, ["a", "b"])).toEqual(["b"])
    expect(pendingSubmissions<boolean>({ a: false, b: null }, ["a", "b"])).toEqual(["b"])
  })

  it("treats a step without players as complete", () => {
    expect(allSubmitted(openSubmissions([]))).toBe(true)
    expect(pendingSubmissions(openSubmissions([]), [])).toEqual([])
  })

  it("exposes who submitted, never what", () => {
    const flags = submittedFlags<number>({ a: 3, b: null, c: 0 })
    expect(flags).toEqual({ a: true, b: false, c: true })
    expect(JSON.stringify(flags)).not.toContain("3")
  })

  it("does not modify its input", () => {
    const step = openSubmissions<number>(["a", "b"])
    pendingSubmissions(step, ["a", "b"])
    allSubmitted(step)
    submittedFlags(step)
    expect(step).toEqual({ a: null, b: null })
  })
})

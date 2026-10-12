import { describe, expect, it } from "vitest"
import { allSubmitted, openSubmissions, pendingSubmissions, revealSubmissions, submit, submittedFlags, type Submissions } from "./simultaneous"

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

describe("submit", () => {
  it("records the answer of a player in a new step and leaves the old one alone", () => {
    const step = openSubmissions<number>(SEATS)
    const next = submit(step, "a", 7)
    expect(next).toEqual({ c: null, a: 7, b: null })
    expect(step).toEqual({ c: null, a: null, b: null })
    expect(next).not.toBe(step)
  })

  it("completes the step with the last answer", () => {
    let step = openSubmissions<number>(SEATS)
    step = submit(step, "b", 2)
    step = submit(step, "c", 3)
    expect(allSubmitted(step)).toBe(false)
    expect(pendingSubmissions(step, SEATS)).toEqual(["a"])
    step = submit(step, "a", 1)
    expect(allSubmitted(step)).toBe(true)
    expect(pendingSubmissions(step, SEATS)).toEqual([])
  })

  it("replaces the answer of a player who answers again: the last one counts", () => {
    const first = submit(openSubmissions<number>(SEATS), "a", 4)
    expect(submit(first, "a", 9)).toEqual({ c: null, a: 9, b: null })
  })

  it("records a falsy answer (0, empty string, false) as an answer", () => {
    expect(submit(openSubmissions<number>(["a", "b"]), "a", 0)).toEqual({ a: 0, b: null })
    expect(submit(openSubmissions<string>(["a", "b"]), "a", "")).toEqual({ a: "", b: null })
    expect(allSubmitted(submit(submit(openSubmissions<boolean>(["a", "b"]), "a", false), "b", false))).toBe(true)
  })

  it("keeps the answer of any shape: a card id, a pair of numbers", () => {
    const step = submit(openSubmissions<{ card: number; row: number }>(["a"]), "a", { card: 12, row: 3 })
    expect(step).toEqual({ a: { card: 12, row: 3 } })
  })

  it("refuses a player who is not part of the step", () => {
    expect(() => submit(openSubmissions<number>(["a", "b"]), "z", 1)).toThrow(RangeError)
  })

  it("does not take a prototype property for a player of the step", () => {
    expect(() => submit(openSubmissions<number>(["a"]), "toString", 1)).toThrow(RangeError)
  })

  it("refuses a missing answer: null would reopen the step and undefined disappears when the state is stored", () => {
    const step = openSubmissions<number>(["a", "b"])
    expect(() => submit(step, "a", null as unknown as number)).toThrow(RangeError)
    expect(() => submit(step, "a", undefined as unknown as number)).toThrow(RangeError)
    expect(step).toEqual({ a: null, b: null })
  })

  it("works on a step that went through jsonb", () => {
    const stored = JSON.parse(JSON.stringify(submit(openSubmissions<number>(SEATS), "b", 5))) as Submissions<number>
    expect(submit(stored, "c", 6)).toEqual({ a: null, b: 5, c: 6 })
  })
})

describe("revealSubmissions", () => {
  it("gives the answers in seat order, whatever the order of the keys (jsonb does not keep it)", () => {
    const stored: Submissions<number> = JSON.parse('{"a":5,"b":9,"c":4}')
    expect(revealSubmissions(stored, ["c", "b", "a"])).toEqual([4, 9, 5])
    expect(revealSubmissions(stored, ["a", "b", "c"])).toEqual([5, 9, 4])
  })

  it("refuses to reveal while somebody has not submitted", () => {
    expect(() => revealSubmissions<number>({ a: 1, b: null }, ["a", "b"])).toThrow(RangeError)
    expect(() => revealSubmissions(openSubmissions<number>(SEATS), SEATS)).toThrow(RangeError)
  })

  it("refuses a player who is not part of the step", () => {
    expect(() => revealSubmissions<number>({ a: 1 }, ["a", "b"])).toThrow(RangeError)
  })

  it("reveals falsy answers", () => {
    expect(revealSubmissions<number>({ a: 0, b: 3 }, ["a", "b"])).toEqual([0, 3])
    expect(revealSubmissions<string>({ a: "", b: "x" }, ["b", "a"])).toEqual(["x", ""])
    expect(revealSubmissions<boolean>({ a: false }, ["a"])).toEqual([false])
  })

  it("ignores a player of the step who is not in the list", () => {
    expect(revealSubmissions<number>({ a: 1, b: 2, c: 3 }, ["c", "a"])).toEqual([3, 1])
  })

  it("reveals a step without players as an empty list", () => {
    expect(revealSubmissions(openSubmissions<number>([]), [])).toEqual([])
  })

  it("does not modify its input and returns a list of its own", () => {
    const step: Submissions<number> = { a: 1, b: 2 }
    const answers = revealSubmissions(step, ["a", "b"])
    answers.push(3)
    expect(step).toEqual({ a: 1, b: 2 })
  })
})

describe("a whole simultaneous step", () => {
  it("collects the answers in any order, then reveals them in seat order", () => {
    const seats = ["a", "b", "c"]
    let step = openSubmissions<number>(seats)
    const arrivals: [string, number][] = [
      ["c", 30],
      ["a", 10],
      ["b", 20],
    ]
    for (const [id, card] of arrivals) {
      expect(allSubmitted(step)).toBe(false)
      step = submit(step, id, card)
    }
    expect(allSubmitted(step)).toBe(true)
    expect(revealSubmissions(step, seats)).toEqual([10, 20, 30])
  })

  it("tells who submitted all along, never what", () => {
    let step = openSubmissions<number>(["a", "b"])
    step = submit(step, "b", 41)
    expect(submittedFlags(step)).toEqual({ a: false, b: true })
    expect(JSON.stringify(submittedFlags(step))).not.toContain("41")
  })
})

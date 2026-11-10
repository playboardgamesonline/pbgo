import { afterEach, describe, expect, it } from "vitest"
import { answersOf, ask, askChoice, askChoices, askNumber, askText, closePrompt, currentPrompt, type Field, initialDraft, subscribePrompt } from "./prompt"

afterEach(() => closePrompt(null))

describe("asking", () => {
  it("opens one window, and gives back what the player confirmed", async () => {
    const promise = askText({ title: "Your clue", value: "cat" })
    expect(currentPrompt()?.prompt.title).toBe("Your clue")
    expect(currentPrompt()?.prompt.fields).toEqual([{ id: "text", kind: "text", value: "cat", placeholder: undefined, rules: undefined }])
    closePrompt({ text: "dog" })
    expect(await promise).toBe("dog")
    expect(currentPrompt()).toBeNull()
  })

  it("gives back null when the player closes the window", async () => {
    const promise = askNumber({ title: "Bet", min: 0, max: 5 })
    closePrompt(null)
    expect(await promise).toBeNull()
  })

  it("closes the window that was open, as cancelled, when another is asked for", async () => {
    const first = askText({ title: "One" })
    const second = askNumber({ title: "Two", min: 1, max: 3 })
    expect(await first).toBeNull()
    expect(currentPrompt()?.prompt.title).toBe("Two")
    closePrompt({ number: 2 })
    expect(await second).toBe(2)
  })

  it("tells the window when something is asked for and when it is closed", async () => {
    let calls = 0
    const stop = subscribePrompt(() => calls++)
    const promise = askChoice({ title: "Pick", options: [{ value: "a", label: "A" }] })
    expect(calls).toBe(1)
    closePrompt({ choice: "a" })
    expect(calls).toBe(2)
    await promise
    stop()
    askText({ title: "later" })
    expect(calls).toBe(2)
  })

  it("asks for a number with its range and step, a choice with its options, several with how many", async () => {
    askNumber({ title: "Bet", min: 0, max: 10, step: 2, value: 4 })
    expect(currentPrompt()?.prompt.fields[0]).toEqual({ id: "number", kind: "number", value: 4, min: 0, max: 10, step: 2 })
    const options = [
      { value: 1, label: "One" },
      { value: 2, label: "Two" },
    ]
    askChoice({ title: "Pick", options, instant: true })
    expect(currentPrompt()?.prompt.instant).toBe(true)
    const many = askChoices({ title: "Pick some", options, many: { min: 1, max: 2 } })
    expect(currentPrompt()?.prompt.fields[0]).toMatchObject({ id: "choices", kind: "choice", many: { min: 1, max: 2 } })
    closePrompt({ choices: [2, 1] })
    expect(await many).toEqual([2, 1])
  })

  it("asks for several fields at once and gives back the answers by id", async () => {
    const promise = ask({
      title: "Your bid",
      fields: [
        { id: "count", kind: "number", label: "How many", min: 1, max: 30 },
        { id: "face", kind: "choice", label: "Of which face", options: [1, 2, 3].map((value) => ({ value, label: String(value) })) },
      ],
    })
    closePrompt({ count: 4, face: 3 })
    expect(await promise).toEqual({ count: 4, face: 3 })
  })
})

const FIELDS: Field[] = [
  { id: "clue", kind: "text", rules: { max: 8, words: 1 } },
  { id: "bet", kind: "number", min: 0, max: 10, step: 2 },
  { id: "face", kind: "choice", options: [1, 2, 3, 4, 5, 6].map((value) => ({ value, label: String(value), disabled: value === 6 })) },
  { id: "some", kind: "choice", options: ["a", "b", "c"].map((value) => ({ value, label: value })), many: { min: 1, max: 2 } },
]

describe("initialDraft", () => {
  it("starts a text on its value, a number on its value or its least, and a choice on the options picked", () => {
    expect(initialDraft(FIELDS)).toEqual({ clue: "", bet: "0", face: [], some: [] })
    expect(
      initialDraft([
        { id: "t", kind: "text", value: "hi" },
        { id: "n", kind: "number", min: 1, max: 9, value: 5 },
        { id: "c", kind: "choice", options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }], value: "y" },
        { id: "m", kind: "choice", options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }, { value: "z", label: "Z" }], value: ["z", "x"], many: {} },
      ]),
    ).toEqual({ t: "hi", n: "5", c: [1], m: [2, 0] })
  })

  it("leaves out a value that is not an option", () => {
    expect(initialDraft([{ id: "c", kind: "choice", options: [{ value: "x", label: "X" }], value: "nope" }])).toEqual({ c: [] })
  })
})

describe("answersOf", () => {
  it("gives the answers of every field, checked by the rules of the engine", () => {
    const result = answersOf(FIELDS, { clue: "  Moon ", bet: "4", face: [2], some: [2, 0] })
    expect(result).toEqual({ ok: true, answers: { clue: "Moon", bet: 4, face: 3, some: ["a", "c"] } })
  })

  it("names the fields that are not right, and only those", () => {
    expect(answersOf(FIELDS, { clue: "two words", bet: "4", face: [2], some: [0] })).toEqual({ ok: false, invalid: ["clue"] })
    expect(answersOf(FIELDS, { clue: "ok", bet: "5", face: [], some: [] })).toEqual({ ok: false, invalid: ["bet", "face", "some"] })
  })

  it("refuses a number that is empty, outside the range or off the steps, and takes one that is on them", () => {
    const only = (bet: string) => answersOf([FIELDS[1]!], { bet })
    expect(only("")).toEqual({ ok: false, invalid: ["bet"] })
    expect(only("12")).toEqual({ ok: false, invalid: ["bet"] })
    expect(only("-2")).toEqual({ ok: false, invalid: ["bet"] })
    expect(only("3")).toEqual({ ok: false, invalid: ["bet"] })
    expect(only("10")).toEqual({ ok: true, answers: { bet: 10 } })
    expect(only("abc")).toEqual({ ok: false, invalid: ["bet"] })
  })

  it("takes a number with decimals when the step has some", () => {
    const field: Field = { id: "n", kind: "number", min: 0, max: 2, step: 0.5 }
    expect(answersOf([field], { n: "1.5" })).toEqual({ ok: true, answers: { n: 1.5 } })
    expect(answersOf([field], { n: "1.2" })).toEqual({ ok: false, invalid: ["n"] })
  })

  it("does not take an option that cannot be chosen", () => {
    expect(answersOf([FIELDS[2]!], { face: [5] })).toEqual({ ok: false, invalid: ["face"] })
    expect(answersOf([FIELDS[3]!], { some: [0, 1, 2] })).toEqual({ ok: false, invalid: ["some"] })
  })

  it("keeps to the number of options asked for", () => {
    expect(answersOf([FIELDS[3]!], { some: [] })).toEqual({ ok: false, invalid: ["some"] })
    expect(answersOf([FIELDS[3]!], { some: [1] })).toEqual({ ok: true, answers: { some: ["b"] } })
  })

  it("gives the values of the options, which may be numbers", () => {
    expect(answersOf([{ id: "n", kind: "choice", options: [{ value: 10, label: "Ten" }, { value: 20, label: "Twenty" }] }], { n: [1] })).toEqual({ ok: true, answers: { n: 20 } })
  })
})

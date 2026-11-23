import { describe, expect, it } from "vitest"
import { inOrder, type SequenceStep, sequenceEnd, stateAfter, stateAt } from "./sequence"

type Ending = { families: number; black: boolean; text: boolean }

const START: Ending = { families: 0, black: false, text: false }

// Written out of order on purpose: a game lists what it likes and the sequence keeps time
const STEPS: SequenceStep<Ending>[] = [
  [3000, { black: true }],
  [1000, { families: 1 }],
  [2000, { families: 2 }],
  [4000, { text: true }],
]

describe("the steps of a sequence", () => {
  it("come in the order they happen, whatever order they were written in", () => {
    expect(inOrder(STEPS).map(([at]) => at)).toEqual([1000, 2000, 3000, 4000])
  })

  it("keep the order they were given in when two happen at once", () => {
    const steps: SequenceStep<{ n: number }>[] = [
      [500, { n: 1 }],
      [500, { n: 2 }],
      [100, { n: 0 }],
    ]
    expect(inOrder(steps).map(([, patch]) => patch.n)).toEqual([0, 1, 2])
    // so the later one of the two wins
    expect(stateAfter({ n: -1 }, steps, 3)).toEqual({ n: 2 })
  })

  it("are not changed by putting them in order", () => {
    const copy = [...STEPS]
    inOrder(STEPS)
    expect(STEPS).toEqual(copy)
  })
})

describe("the state of a sequence", () => {
  it("is the start before anything has happened", () => {
    expect(stateAt(START, STEPS, 0)).toEqual(START)
    expect(stateAt(START, STEPS, 999)).toEqual(START)
    expect(stateAfter(START, STEPS, 0)).toEqual(START)
  })

  it("gathers the steps that have happened, a step at its very moment included", () => {
    expect(stateAt(START, STEPS, 1000)).toEqual({ families: 1, black: false, text: false })
    expect(stateAt(START, STEPS, 2500)).toEqual({ families: 2, black: false, text: false })
    expect(stateAt(START, STEPS, 3000)).toEqual({ families: 2, black: true, text: false })
  })

  it("is the whole of it once the last step has happened, and stays", () => {
    const end = { families: 2, black: true, text: true }
    expect(stateAt(START, STEPS, 4000)).toEqual(end)
    expect(stateAt(START, STEPS, 1e9)).toEqual(end)
  })

  it("after a number of steps is the state at the moment of the last of them", () => {
    for (let count = 0; count <= STEPS.length; count++) {
      const at = count === 0 ? 0 : inOrder(STEPS)[count - 1]![0]
      expect(stateAfter(START, STEPS, count)).toEqual(stateAt(START, STEPS, at === 0 ? -1 : at))
    }
  })

  it("holds a count outside the steps it has at its ends", () => {
    expect(stateAfter(START, STEPS, -3)).toEqual(START)
    expect(stateAfter(START, STEPS, 99)).toEqual(stateAt(START, STEPS, 1e9))
  })

  it("never changes the start it was given", () => {
    const start = { ...START }
    stateAt(start, STEPS, 1e9)
    stateAfter(start, STEPS, 4)
    expect(start).toEqual(START)
  })
})

describe("how long a sequence is", () => {
  it("is when its last step happens, whatever order the steps were written in", () => {
    expect(sequenceEnd(STEPS)).toBe(4000)
  })

  it("is nothing for a sequence with no step", () => {
    expect(sequenceEnd([])).toBe(0)
  })
})

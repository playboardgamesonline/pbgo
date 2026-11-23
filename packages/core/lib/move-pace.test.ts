import { describe, expect, it } from "vitest"
import type { LogLine } from "./game-types"
import { createMoveClock, paceOf } from "./move-pace"

type Event = { kind: "draw" | "stay" | "deal"; id?: number }
const line = (v: number, kind: Event["kind"], id?: number): LogLine<Event> => ({ v, event: { kind, id } })
const beat = (event: Event) => (event.kind === "draw" ? 0.3 : event.kind === "stay" ? 0.2 : 0.1)
const RULES = { beat, landing: 0.85 }

describe("paceOf", () => {
  it("says an empty log is over at once and visits nothing", () => {
    const visited: Event[] = []
    expect(paceOf([], RULES, (event) => void visited.push(event))).toEqual({ v: 0, settle: 0 })
    expect(visited).toEqual([])
  })

  it("visits the events of the last move only, in the order they were said", () => {
    const visited: (number | undefined)[] = []
    const pace = paceOf([line(3, "draw", 1), line(4, "draw", 2), line(4, "stay"), line(4, "draw", 3)], RULES, (event) => void visited.push(event.id))
    expect(pace.v).toBe(4)
    expect(visited).toEqual([2, undefined, 3])
  })

  it("begins each event when the beats of the ones before it are over", () => {
    const at: number[] = []
    paceOf([line(1, "draw", 1), line(1, "stay"), line(1, "draw", 2)], RULES, (_event, cursor) => void at.push(cursor.at))
    expect(at).toEqual([0, 0.3, 0.5])
  })

  it("lands a card where it sets out, and is not over before the last card has landed", () => {
    const entrances = new Map<number, number>()
    const pace = paceOf([line(1, "draw", 1), line(1, "draw", 2), line(1, "draw", 3)], RULES, (event, cursor) => {
      if (event.kind === "draw") entrances.set(event.id!, cursor.land())
    })
    expect([...entrances.entries()].map(([id, delay]) => [id, Math.round(delay * 100) / 100])).toEqual([
      [1, 0],
      [2, 0.3],
      [3, 0.6],
    ])
    // the three beats make 0.9 seconds, but the last card sets out at 0.6 and needs 0.85 to land
    expect(pace.settle).toBeCloseTo(1.45, 10)
  })

  it("is over when its beats are, when no card lands after them", () => {
    expect(paceOf([line(1, "stay"), line(1, "stay")], RULES, () => {}).settle).toBeCloseTo(0.4, 10)
  })

  it("lands a card later than its beat when it is given a delay, and gives the delay back", () => {
    let given: number | null = null
    const pace = paceOf([line(1, "deal")], RULES, (_event, cursor) => {
      given = cursor.land(cursor.at + 1.2)
    })
    expect(given).toBeCloseTo(1.2, 10)
    expect(pace.settle).toBeCloseTo(1.2 + 0.85, 10)
  })

  it("holds what comes next back by the time a deal takes", () => {
    const at: number[] = []
    const pace = paceOf([line(1, "deal"), line(1, "stay")], RULES, (event, cursor) => {
      at.push(cursor.at)
      if (event.kind === "deal") cursor.hold(2)
    })
    // the deal begins at 0 and holds 2 seconds besides its own beat of 0.1: the stay begins at 2.1
    expect(at[0]).toBe(0)
    expect(at[1]).toBeCloseTo(2.1, 10)
    expect(pace.settle).toBeCloseTo(2.3, 10)
  })

  it("is over as it comes, and visits nothing, when the visitor asks for less motion", () => {
    const visited: Event[] = []
    expect(paceOf([line(7, "draw", 1)], { ...RULES, instant: true }, (event) => void visited.push(event))).toEqual({ v: 7, settle: 0 })
    expect(visited).toEqual([])
  })

  it("reads the beats when it is called, so a knob of the debug panel takes effect", () => {
    const rules = { beat: () => knob.seconds, landing: 0 }
    const knob = { seconds: 0.5 }
    expect(paceOf([line(1, "stay")], rules, () => {}).settle).toBe(0.5)
    knob.seconds = 1
    expect(paceOf([line(1, "stay")], rules, () => {}).settle).toBe(1)
  })
})

/** A clock and timers that move when the test says so */
function manual() {
  let time = 0
  let next = 1
  const pending = new Map<number, { at: number; run: () => void }>()
  return {
    now: () => time,
    setTimer: (run: () => void, ms: number) => {
      const id = next++
      pending.set(id, { at: time + ms, run })
      return id
    },
    clearTimer: (id: unknown) => void pending.delete(id as number),
    advance(ms: number) {
      const end = time + ms
      for (;;) {
        const due = [...pending.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        pending.delete(due[0])
        time = due[1].at
        due[1].run()
      }
      time = end
    },
    get waiting() {
      return pending.size
    },
  }
}

describe("createMoveClock", () => {
  const setup = (opened: number) => {
    const timers = manual()
    const played: number[] = []
    const clock = createMoveClock({ opened, onPlayed: (v) => void played.push(v), now: timers.now, setTimer: timers.setTimer, clearTimer: timers.clearTimer })
    return { timers, played, clock }
  }

  it("says a move is played out when its time has passed, and not before", () => {
    const { timers, played, clock } = setup(0)
    clock.note(5, 2)
    timers.advance(1999)
    expect(played).toEqual([])
    timers.advance(1)
    expect(played).toEqual([5])
  })

  it("plays nothing of the move that was there when the board opened", () => {
    const { timers, played, clock } = setup(5)
    clock.note(5, 2)
    expect(timers.waiting).toBe(0)
    timers.advance(5000)
    expect(played).toEqual([])
  })

  it("plays the opening deal when it is opened with nothing played", () => {
    const { timers, played, clock } = setup(0)
    clock.note(1, 3)
    timers.advance(3000)
    expect(played).toEqual([1])
  })

  it("does not time a move twice: the log is given again on every refresh", () => {
    const { timers, played, clock } = setup(0)
    clock.note(5, 2)
    timers.advance(1000)
    clock.note(5, 2)
    clock.note(5, 0)
    timers.advance(1000)
    expect(played).toEqual([5])
    clock.note(5, 2)
    timers.advance(5000)
    expect(played).toEqual([5])
  })

  it("is over when both are, for a move that comes while another plays out", () => {
    const { timers, played, clock } = setup(0)
    clock.note(5, 2)
    timers.advance(500)
    clock.note(6, 1)
    // the second would be over at 1.5 seconds on its own, but the first is not over before 2: the first is never said played, the second is said at 2
    timers.advance(1499)
    expect(played).toEqual([])
    timers.advance(1)
    expect(played).toEqual([6])
    timers.advance(5000)
    expect(played).toEqual([6])
  })

  it("gives a move that comes after the table was free its own time", () => {
    const { timers, played, clock } = setup(0)
    clock.note(5, 1)
    timers.advance(1500)
    expect(played).toEqual([5])
    clock.note(6, 1)
    timers.advance(999)
    expect(played).toEqual([5])
    timers.advance(1)
    expect(played).toEqual([5, 6])
  })

  it("is over in the next tick for a move that takes no time", () => {
    const { timers, played, clock } = setup(0)
    clock.note(2, 0)
    expect(played).toEqual([])
    timers.advance(0)
    expect(played).toEqual([2])
  })

  it("drops its timer when the board goes", () => {
    const { timers, played, clock } = setup(0)
    clock.note(5, 2)
    clock.stop()
    expect(timers.waiting).toBe(0)
    timers.advance(5000)
    expect(played).toEqual([])
  })
})

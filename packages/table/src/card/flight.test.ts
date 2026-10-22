import { Object3D, Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { FACE_DOWN, type Pose, onTable } from "../pose"
import { bezier, flightLift, flightSeconds, startFlight, stepFlight } from "./flight"

/** A straight clock: at half the flight the card is at half the curve */
const SETTINGS = { flightDuration: 1, flightHeight: 1, foldable: 0.04, easing: "linear" }

/** Five units from the origin, facing the way a card does by default */
const GOAL: Pose = { position: new Vector3(3, 0, 4), quaternion: new Quaternion(), scale: 1 }

const near = (v: Vector3, x: number, y: number, z: number, digits = 9) => {
  expect(v.x).toBeCloseTo(x, digits)
  expect(v.y).toBeCloseTo(y, digits)
  expect(v.z).toBeCloseTo(z, digits)
}

/** A card at rest at the origin, and a flight to GOAL */
function takeOff(direction: number, delay = 0, at = new Vector3()) {
  const body = new Object3D()
  body.position.copy(at)
  const fold = { value: 0 }
  const flight = startFlight(body, GOAL, delay, SETTINGS, direction)
  return { body, fold, flight }
}

describe("flightSeconds", () => {
  it("lasts about a second, a little longer when the trip is longer, and never more than 1.6", () => {
    expect(flightSeconds(0)).toBe(1.05)
    expect(flightSeconds(5)).toBeCloseTo(1.15, 12)
    expect(flightSeconds(100)).toBe(1.6)
  })
})

describe("flightLift", () => {
  it("arches higher when the trip is longer, up to 5.5", () => {
    expect(flightLift(0)).toBe(1.8)
    expect(flightLift(10)).toBeCloseTo(4.8, 12)
    expect(flightLift(100)).toBe(5.5)
  })
})

describe("bezier", () => {
  const a = new Vector3(0, 0, 0)
  const b = new Vector3(0, 4, 0)
  const c = new Vector3(6, 4, 2)
  const d = new Vector3(6, 0, 2)

  it("starts at the first point and ends at the last", () => {
    near(bezier(new Vector3(), a, b, c, d, 0), 0, 0, 0)
    near(bezier(new Vector3(), a, b, c, d, 1), 6, 0, 2)
  })

  it("passes at (a + 3b + 3c + d) / 8 half way", () => {
    near(bezier(new Vector3(), a, b, c, d, 0.5), 3, 3, 1)
  })

  it("writes into the vector it is given and returns it", () => {
    const out = new Vector3()
    expect(bezier(out, a, b, c, d, 0.25)).toBe(out)
  })
})

describe("startFlight", () => {
  it("leaves from where the card is, after its delay, for as long as the distance asks", () => {
    const body = new Object3D()
    body.position.set(1, 2, 3)
    body.scale.setScalar(0.8)
    const target: Pose = { position: new Vector3(4, 2, 7), quaternion: new Quaternion(), scale: 1 }
    const flight = startFlight(body, target, 0.5, { flightDuration: 1, flightHeight: 1 }, 1)
    expect(flight.t).toBe(-0.5)
    expect(flight.duration).toBeCloseTo(flightSeconds(5), 12)
    expect(flight.momentum).toBeCloseTo(flightLift(5), 12)
    expect(flight.s0).toBe(0.8)
    expect(flight.direction).toBe(1)
    near(flight.p0, 1, 2, 3)
  })

  it("scales the time and the arch by the settings", () => {
    const body = new Object3D()
    const slow = startFlight(body, GOAL, 0, { flightDuration: 2, flightHeight: 0.5 }, 1)
    expect(slow.duration).toBeCloseTo(flightSeconds(5) * 2, 12)
    expect(slow.momentum).toBeCloseTo(flightLift(5) * 0.5, 12)
  })

  it("keeps a copy of where the card was: the card moving on does not move the start", () => {
    const body = new Object3D()
    const flight = startFlight(body, GOAL, 0, SETTINGS, 1)
    body.position.set(9, 9, 9)
    body.quaternion.set(0, 1, 0, 0)
    near(flight.p0, 0, 0, 0)
    expect(flight.q0.equals(new Quaternion())).toBe(true)
  })

  it("arches to one side or the other when nothing says which", () => {
    const sides = new Set<number>()
    for (let i = 0; i < 64; i++) sides.add(startFlight(new Object3D(), GOAL, 0, SETTINGS).direction)
    expect([...sides].sort()).toEqual([-1, 1])
  })
})

describe("stepFlight", () => {
  it("waits for its turn: nothing moves while the delay runs", () => {
    const { body, fold, flight } = takeOff(1, 0.5)
    expect(stepFlight(flight, 0.3, body, GOAL, SETTINGS, fold)).toBe(false)
    expect(flight.t).toBeCloseTo(-0.2, 12)
    near(body.position, 0, 0, 0)
    expect(fold.value).toBe(0)
  })

  it("starts to move once the delay is over", () => {
    const { body, fold, flight } = takeOff(1, 0.5)
    stepFlight(flight, 0.5 + flight.duration / 4, body, GOAL, SETTINGS, fold)
    expect(body.position.distanceTo(new Vector3())).toBeGreaterThan(0)
  })

  it("arches over the straight line half way: the points of the curve are the start, a lift above it, a lift above the goal, the goal", () => {
    const { body, fold, flight } = takeOff(1)
    expect(stepFlight(flight, flight.duration / 2, body, GOAL, SETTINGS, fold)).toBe(false)
    // x and z are the middle of the line; y is (3m + 3 * 0.85m) / 8 above the table
    near(body.position, 1.5, (flight.momentum * (3 + 3 * 0.85)) / 8, 2)
  })

  it("swells a little half way and turns about the vertical axis towards the side it arches", () => {
    const right = takeOff(1)
    stepFlight(right.flight, right.flight.duration / 2, right.body, GOAL, SETTINGS, right.fold)
    expect(right.body.scale.x).toBeCloseTo(1.14, 12)
    expect(right.body.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.45, 12)
    expect(right.body.quaternion.y).toBeGreaterThan(0)

    const left = takeOff(-1)
    stepFlight(left.flight, left.flight.duration / 2, left.body, GOAL, SETTINGS, left.fold)
    expect(left.body.quaternion.y).toBeLessThan(0)
  })

  it("bends the card the way it arches, most half way", () => {
    const right = takeOff(1)
    stepFlight(right.flight, right.flight.duration / 2, right.body, GOAL, SETTINGS, right.fold)
    expect(right.fold.value).toBeCloseTo(0.04, 12)

    const left = takeOff(-1)
    stepFlight(left.flight, left.flight.duration / 2, left.body, GOAL, SETTINGS, left.fold)
    expect(left.fold.value).toBeCloseTo(-0.04, 12)
  })

  it("gives no extra lift to a card that is already high", () => {
    const { body, fold, flight } = takeOff(1, 0, new Vector3(0, 10, 0))
    stepFlight(flight, flight.duration / 2, body, GOAL, SETTINGS, fold)
    expect(body.position.y).toBeCloseTo((10 + 3 * 10 + 3 * 0.85 * flight.momentum) / 8, 9)
  })

  it("lands exactly on the target pose, flat, at its size, and says so", () => {
    const goal = onTable(3, 4, { y: 0 })
    const body = new Object3D()
    body.quaternion.copy(FACE_DOWN)
    body.scale.setScalar(0.5)
    const fold = { value: 0 }
    const flight = startFlight(body, goal, 0, SETTINGS, -1)
    expect(stepFlight(flight, flight.duration * 0.99, body, goal, SETTINGS, fold)).toBe(false)
    expect(stepFlight(flight, flight.duration, body, goal, SETTINGS, fold)).toBe(true)
    near(body.position, 3, 0, 4, 12)
    expect(body.quaternion.angleTo(goal.quaternion)).toBeCloseTo(0, 9)
    expect(body.scale.x).toBeCloseTo(1, 12)
    expect(fold.value).toBeCloseTo(0, 12)
  })
})

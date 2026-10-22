import { type Object3D, Quaternion, Vector3 } from "three"
import { ease } from "@pbgo/core/components/game/easing"
import type { Pose } from "../pose"

/** The part of `CARD_SETTINGS` a flight reads */
export type FlightSettings = { flightDuration: number; flightHeight: number; foldable: number; easing: string }

/** What moves: a card's group, or anything with a position, an orientation and a scale */
type Body = Pick<Object3D, "position" | "quaternion" | "scale">

/** A card on its way: `t` counts seconds from the start of the move (negative while it waits its turn), `p0` / `q0` / `s0` are where it left from */
export type Flight = { t: number; duration: number; p0: Vector3; q0: Quaternion; s0: number; momentum: number; direction: number }

// Above this height a card is already in the air: it gets no extra lift
const HIGH = 8
const UP = new Vector3(0, 1, 0)
const p1 = new Vector3()
const p2 = new Vector3()
const turn = new Quaternion()

/** A point of the cubic Bézier curve a, b, c, d at `t` (0 to 1), written into `out` */
export function bezier(out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number) {
  const m = 1 - t
  return out
    .copy(a)
    .multiplyScalar(m * m * m)
    .addScaledVector(b, 3 * m * m * t)
    .addScaledVector(c, 3 * m * t * t)
    .addScaledVector(d, t * t * t)
}

/** Seconds a flight over `distance` takes, before the `flightDuration` multiplier: longer for farther, never under about a second */
export const flightSeconds = (distance: number) => Math.min(1.6, Math.max(1.05, 0.95 + distance * 0.04))

/** How high a flight over `distance` arches, before the `flightHeight` multiplier */
export const flightLift = (distance: number) => Math.min(5.5, 1.8 + distance * 0.3)

/**
 * Starts a flight from where `body` is now to `target`, after `delay` seconds.
 * `direction` (1 or -1) is the side the card arches and turns towards: left to chance unless a test pins it.
 */
export function startFlight(
  body: Body,
  target: Pose,
  delay: number,
  settings: Pick<FlightSettings, "flightDuration" | "flightHeight">,
  direction = Math.random() < 0.5 ? -1 : 1,
): Flight {
  const distance = body.position.distanceTo(target.position)
  return {
    t: -delay,
    duration: flightSeconds(distance) * settings.flightDuration,
    p0: body.position.clone(),
    q0: body.quaternion.clone(),
    s0: body.scale.x,
    momentum: flightLift(distance) * settings.flightHeight,
    direction,
  }
}

/**
 * Moves `body` `dt` seconds further along the flight and writes how much the card arches into `fold.value`.
 * The card rises on a curve, turns a little about the vertical axis on the way and swells slightly at mid-flight.
 * Returns true on the frame it lands.
 */
export function stepFlight(v: Flight, dt: number, body: Body, target: Pose, settings: FlightSettings, fold: { value: number }) {
  v.t += dt
  if (v.t < 0) return false
  const u = Math.min(1, v.t / v.duration)
  const e = ease(settings.easing, u)
  p1.copy(v.p0).addScaledVector(UP, v.p0.y > HIGH ? 0 : v.momentum)
  p2.copy(target.position).addScaledVector(UP, target.position.y > HIGH ? 0 : v.momentum * 0.85)
  bezier(body.position, v.p0, p1, p2, target.position, e)
  body.quaternion.slerpQuaternions(v.q0, target.quaternion, e).premultiply(turn.setFromAxisAngle(UP, Math.sin(Math.PI * e) * 0.45 * v.direction))
  body.scale.setScalar((v.s0 + (target.scale - v.s0) * e) * (1 + Math.sin(Math.PI * u) * 0.14))
  fold.value = settings.foldable * Math.sin(Math.PI * u) * v.direction
  return u >= 1
}

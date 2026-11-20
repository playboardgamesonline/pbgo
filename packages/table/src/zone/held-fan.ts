import { Vector3 } from "three"
import type { CardSize } from "../card/geometry"
import { fan } from "../layout"
import { type Pose, RESTING_HEIGHT } from "../pose"

/**
 * How the cards another player holds are laid: a small hand, close together, that stands on the table with its backs to the middle of the table, in the frame of the player's seat, so that the viewer can tell how many cards a player has and nothing more. A plain object that a debug panel
 * edits; every number is read on a render.
 */
export const HELD_FAN_SETTINGS = {
  /** The distance between the feet of two neighbouring cards, in world units: small, so that the cards overlap and only an edge of each shows, which is how a hand is held */
  gap: 0.13,
  /** The scale of a card of the hand */
  scale: 0.68,
  /** How far the cards lean from standing straight, toward their owner, in radians, at a seat the viewer sees from the front (across the table): 0 is straight up. A hand that is held leans back a little, which shows its backs to a viewer who looks down on the table */
  lean: 0.27,
  /** The same at a seat at the side, which the viewer sees edge on: the cards lean back more, so that their backs show to the camera that looks down on them. Between the two, the lean follows the seat */
  sideLean: 0.6,
  /** How much each card turns about its own foot per card from the middle, in radians: the cards open at the top while their feet stay together, as a hand does */
  roll: 0.1,
  /** How far, in world units, each card lies nearer the viewer than the one on its left, so that the cards overlap from the left, the deepest, to the right, the nearest: not the one in the middle in front of the others */
  stack: 0.06,
  /** The small round shadow under the hand: how far it reaches for no card, how much more for each, and how dark it is at its middle */
  shadowBase: 0.45,
  shadowPerCard: 0.07,
  shadowOpacity: 0.55,
}
export type HeldFanSettings = typeof HELD_FAN_SETTINGS

type Knob = [label: string, min: number, max: number, step: number]

/** The knobs a debug panel can offer for `HELD_FAN_SETTINGS`, one for each of its fields */
export const HELD_FAN_FIELDS = {
  gap: ["spacing of the feet", 0.02, 0.6, 0.005],
  scale: ["card size", 0.3, 1, 0.01],
  lean: ["lean back (across)", 0, 1.4, 0.01],
  sideLean: ["lean back (side)", 0, 1.4, 0.01],
  roll: ["fan", 0, 0.4, 0.005],
  stack: ["overlap depth", 0, 0.2, 0.005],
  shadowBase: ["shadow: base", 0, 2, 0.01],
  shadowPerCard: ["shadow: per card", 0, 0.4, 0.005],
  shadowOpacity: ["shadow: darkness", 0, 1, 0.01],
} satisfies Record<keyof HeldFanSettings, Knob>

/**
 * The slots of a hand of `count` cards held by a player, in the frame of their seat (`seats`, turned toward the middle of the table, the same frame their name stands in): a small fan of backs that stands, its feet close together and its tops open, the cards overlapping from the left of the
 * viewer, the deepest, to the right, the nearest. `yaw` is the yaw of the frame: it says how far the seat is seen from the side, which leans the cards back more, and which way the viewer's left lies along the hand.
 */
export function heldFan(count: number, yaw: number, card: CardSize, S: HeldFanSettings = HELD_FAN_SETTINGS): Pose[] {
  // A face-down card is straight up with a tilt of -pi/2, and leans toward its owner as the tilt grows
  const side = Math.sin(yaw) ** 2
  const lean = S.lean + (S.sideLean - S.lean) * side
  // The roll of a face-down card is about its own normal, which looks toward its owner: to open the tops the way a hand does, the cards on the owner's right lean to the right, which is a roll the other way from the one that turns a fan of cards lying face down
  const slots = fan(count, { gap: S.gap, y: RESTING_HEIGHT, foot: card.height, tilt: -Math.PI / 2 + lean, roll: -S.roll, face: "down", scale: S.scale })
  // The viewer's right is the nearest: the frame's z is toward the owner, which is away from the viewer across the table and toward them at a seat in front, and the viewer's right is the first card or the last by the way the frame turns, so the step is by the square of the cosine
  const step = S.stack * Math.cos(yaw) ** 2
  return slots.map((slot, i) => ({ ...slot, position: slot.position.add(new Vector3(0, 0, (i - (count - 1) / 2) * step)) }))
}

/** The small round shadow under a hand of `count` cards: `radius` and `opacity` for a `HandShadow`, the shape `HeldHand` takes. Both read the settings when they are asked, so a knob of the debug panel moves them */
export function heldShadow(S: HeldFanSettings = HELD_FAN_SETTINGS): { radius: (count: number) => number; opacity: number } {
  return {
    radius: (count) => S.shadowBase + S.shadowPerCard * count,
    get opacity() {
      return S.shadowOpacity
    },
  }
}

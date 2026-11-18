import { Euler, Quaternion, Vector3 } from "three"
import type { CardSize } from "../card/geometry"
import type { Pose } from "../pose"

/**
 * Where the picture's edges are at the distance the hand stands from the camera: half its width and half its height, in world units. The hand is laid in the camera's own frame (x to the right, y up, the camera looks down -z), so the edges of the screen are where these say
 * whatever the window and the view.
 */
export type ScreenView = { distance: number; halfWidth: number; halfHeight: number }

/** `ScreenView` of a camera whose projection has `m00` and `m11` (the first and second diagonal elements of its projection matrix), for things `distance` in front of it */
export function screenViewOf({ m00, m11 }: { m00: number; m11: number }, distance: number): ScreenView {
  return { distance, halfWidth: distance / m00, halfHeight: distance / m11 }
}

/**
 * How a hand is held at the bottom left of the screen. The numbers are Courtisans' hand: big cards, in a block that leans a little, the first one flush with the left edge and the bottom of every card cut by the bottom edge of the picture. A plain object that a debug
 * panel edits.
 */
export const SCREEN_HAND_SETTINGS = {
  /** How far in front of the camera the hand stands, in world units. How big it looks does not depend on it, since a card is a share of the picture's height: it only sets the units the poses are in, and keeps the hand nearer than anything on the table */
  distance: 6,
  /** A card's height as a share of the picture's half height: 0.66 is a third of the screen */
  size: 0.66,
  /** The distance between two cards as a share of a card's width: under 1 they overlap */
  step: 0.9,
  /** How far the middle of the hand lies from the left edge, as a share of the picture's half width (0: the first card is flush with the edge) */
  x: 0,
  /** How high the middle of a card stands above the bottom edge of the picture, as a share of the card's height: under 0.5 the bottom of the cards is cut off by the edge */
  y: 0.22,
  /** How the block of cards is turned, in radians: pitch, yaw and roll. A hand drawn square to the screen is flat; this leans it a little toward the middle of the table */
  rotation: { x: -0.11, y: 0.15, z: -0.1 },
  /** How much each card turns about its own axis per card from the middle of the hand, in radians: the cards open as a fan */
  fan: 0.09,
  /** How far each card sinks per card from the middle, as a share of its height: the ends hang lower */
  curve: 0.045,
  /** How far a card advances toward the camera while the pointer is on it, as a share of its height, so that it lies over the cards beside it */
  raise: 0.08,
  /** The most of the picture's width the hand takes, as a share of it (a hand that is wider packs its cards closer, then shrinks them) */
  room: 0.5,
  /** The closest the cards pack, as a share of a card's width, before the hand shrinks to fit the room */
  packed: 0.3,
}
export type ScreenHandSettings = typeof SCREEN_HAND_SETTINGS

type Knob = [label: string, min: number, max: number, step: number]

/** The knobs a debug panel can offer for `SCREEN_HAND_SETTINGS`: every number but the three of the rotation, which is drawn as the three it is */
export const SCREEN_HAND_FIELDS = {
  distance: ["distance from the camera", 2, 20, 0.1],
  size: ["card size", 0.2, 1.5, 0.01],
  step: ["spacing", 0.2, 1.5, 0.01],
  x: ["shift right", -0.5, 1, 0.005],
  y: ["height of a card's middle", -0.5, 1, 0.005],
  fan: ["fan", 0, 0.6, 0.005],
  curve: ["curve", 0, 0.3, 0.005],
  raise: ["advance under the pointer", 0, 0.6, 0.005],
  room: ["room taken", 0.2, 1, 0.01],
  packed: ["closest spacing", 0.1, 1, 0.01],
} satisfies Partial<Record<keyof ScreenHandSettings, Knob>>

const block = new Quaternion()
const roll = new Quaternion()
const euler = new Euler()
const pivot = new Vector3()

/** How big a hand of `count` cards is drawn and how far apart: the size and the spacing the settings ask for, packed closer when the hand would take more than the room, and shrunk when packing is not enough. Both in world units: `scale` of the cards, `step` between two */
export function screenHandFit(count: number, view: ScreenView, card: CardSize, S: ScreenHandSettings = SCREEN_HAND_SETTINGS): { scale: number; step: number } {
  const wanted = (view.halfHeight * S.size) / card.height
  const width = card.width * wanted
  const room = S.room * 2 * view.halfWidth
  if (count <= 1) return { scale: wanted, step: width * S.step }
  const step = width * S.step
  if ((count - 1) * step + width <= room) return { scale: wanted, step }
  const packed = (room - width) / (count - 1)
  if (packed >= width * S.packed) return { scale: wanted, step: packed }
  // Packed as close as it goes and still too wide: the cards shrink, with the spacing they keep, until the hand is as wide as the room
  const fitted = room / ((count - 1) * S.packed + 1)
  const scale = fitted / card.width
  return { scale, step: fitted * S.packed }
}

/**
 * The slots of a hand of `count` cards held at the bottom left of the screen, in the camera's own frame (x to the right, y up, the camera looks down -z): the poses of cards that stand `view.distance` in front of it. The first card is flush with the left edge of the picture
 * and the hand grows to the right, so the cards already in it stay where they are as others come. The card at index `raised` (-1: none) advances toward the camera so that it lies over its neighbours. Courtisans' hand, in `SCREEN_HAND_SETTINGS`.
 */
export function screenHandLayout(count: number, view: ScreenView, card: CardSize, S: ScreenHandSettings = SCREEN_HAND_SETTINGS, raised = -1): Pose[] {
  if (count <= 0) return []
  const { scale, step } = screenHandFit(count, view, card, S)
  const height = card.height * scale
  const width = card.width * scale
  block.setFromEuler(euler.set(S.rotation.x, S.rotation.y, S.rotation.z))
  // The middle of the hand: the first card's middle is half a card (less a hair that hangs past the edge) in from the left edge
  pivot.set(-view.halfWidth - width * 0.02 + width / 2 + ((count - 1) * step) / 2 + S.x * view.halfWidth, -view.halfHeight + height * S.y, -view.distance)
  return Array.from({ length: count }, (_, i) => {
    const t = i - (count - 1) / 2
    const position = new Vector3(t * step, -Math.abs(t) * height * S.curve, (i === raised ? height * S.raise : 0) + i * 0.01).applyQuaternion(block).add(pivot)
    const quaternion = new Quaternion().copy(block).multiply(roll.setFromEuler(euler.set(0, 0, -t * S.fan)))
    return { position, quaternion, scale }
  })
}

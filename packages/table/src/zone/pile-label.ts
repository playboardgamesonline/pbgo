import type { CardSize } from "../card/geometry"
import type { Footprint } from "../floor/label-look"
import type { Spot } from "../layout"
import { RESTING_HEIGHT } from "../pose"

/** How far under the edge of the pile the middle of its count lies, in world units */
export const PILE_LABEL_GAP = 0.55

/** The height of the count's letters, in world units */
export const PILE_LABEL_HEIGHT = 0.5

/** How far the pile reaches from its middle toward the viewer, and as far away from them: its half depth for a pile that is not turned, its half width for one turned a quarter, and in between for the other turns */
function halfDepth(frame: Spot | undefined, size: CardSize, scale: number): number {
  const yaw = frame?.yaw ?? 0
  return ((Math.abs(Math.cos(yaw)) * size.height + Math.abs(Math.sin(yaw)) * size.width) * scale) / 2
}

/**
 * Where the count of a pile is written: under the pile, on the side of the viewer, centred on it. The pile's frame turns its cards and the count stays upright, so the room the pile takes toward the viewer is its half depth for a pile
 * that is not turned, its half width for one turned a quarter, and in between for the other turns. `scale` is the scale of the cards of the pile.
 */
export function pileLabelAt(frame: Spot | undefined, size: CardSize, scale = 1): { x: number; z: number } {
  return { x: frame?.x ?? 0, z: (frame?.z ?? 0) + halfDepth(frame, size, scale) + PILE_LABEL_GAP }
}

/**
 * Where the action label over a pile stands: the middle of the pile, at the height of its top (`y`, the height of its top card: the table's for one card). The label is set up the screen from it, as far as the pile reaches up the screen (`pileFootprint` says how
 * far, whatever way the camera and the pile are turned), so it is centred over the pile as the camera sees it and clear of it, over its far edge, where the count is not.
 */
export function pileAboveAt(frame: Spot | undefined, y: number = RESTING_HEIGHT): { x: number; y: number; z: number } {
  return { x: frame?.x ?? 0, y, z: frame?.z ?? 0 }
}

/** The room a pile takes on the table, which the action label stands clear of: the width and the depth of its cards, turned as its frame turns them. `scale` is the scale of the cards of the pile */
export function pileFootprint(frame: Spot | undefined, size: CardSize, scale = 1): Footprint {
  return { width: size.width * scale, depth: size.height * scale, yaw: frame?.yaw ?? 0 }
}

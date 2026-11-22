import type { CardSize } from "../card/geometry"
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
 * Where the arrow of the action label over a pile points: the middle of the pile's far edge, the one away from the viewer, which is where the count is not, at the height of the top of the pile (`y`, the height of its top card: the table's for one
 * card). The label stays upright for the viewer, as the count does, so this is the room the pile takes away from them, whatever way its frame turns it. `scale` is the scale of the cards of the pile.
 */
export function pileAboveAt(frame: Spot | undefined, size: CardSize, scale = 1, y: number = RESTING_HEIGHT): { x: number; y: number; z: number } {
  return { x: frame?.x ?? 0, y, z: (frame?.z ?? 0) - halfDepth(frame, size, scale) }
}

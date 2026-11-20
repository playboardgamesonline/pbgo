import type { CardSize } from "../card/geometry"
import type { Spot } from "../layout"

/** How far under the edge of the pile the middle of its count lies, in world units */
export const PILE_LABEL_GAP = 0.55

/** The height of the count's letters, in world units */
export const PILE_LABEL_HEIGHT = 0.5

/**
 * Where the count of a pile is written: under the pile, on the side of the viewer, centred on it. The pile's frame turns its cards and the count stays upright, so the room the pile takes toward the viewer is its half depth for a pile
 * that is not turned, its half width for one turned a quarter, and in between for the other turns. `scale` is the scale of the cards of the pile.
 */
export function pileLabelAt(frame: Spot | undefined, size: CardSize, scale = 1): { x: number; z: number } {
  const yaw = frame?.yaw ?? 0
  const half = ((Math.abs(Math.cos(yaw)) * size.height + Math.abs(Math.sin(yaw)) * size.width) * scale) / 2
  return { x: frame?.x ?? 0, z: (frame?.z ?? 0) + half + PILE_LABEL_GAP }
}

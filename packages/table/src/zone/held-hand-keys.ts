import { inFrame, type Spot } from "../layout"
import type { Pose } from "../pose"

/**
 * Whether the first card of a fan laid in the frame of a seat is the one on the left of the picture, as the viewer sees the table: a seat that faces the viewer's way has its own left on the picture's left, and a seat across from the viewer has it on the right, so the last card is the one on
 * the left. A seat turned a quarter has its fan running along the depth of the picture: with the `layout` of the hand the left end is read where the two ends of a hand of five really stand (the step of the fan between two cards, which keeps them apart, can then decide it), and without it the first card, on the
 * seat's own left, counts as the left end.
 */
export function leftEndIsFirst(frame: Spot | undefined, layout?: (count: number) => Pose[]): boolean {
  if (frame && layout) {
    // The two ends of a hand of five, which are what the rule is about: a hand that bends has its middle off to one side at a seat turned a quarter, and the card that leaves is an end
    const slots = layout(5)
    const first = slots[0] && inFrame(frame, slots[0]).position.x
    const last = slots[4] && inFrame(frame, slots[4]).position.x
    if (first !== undefined && last !== undefined && Math.abs(first - last) > 1e-9) return first < last
  }
  return Math.cos(frame?.yaw ?? 0) > -1e-6
}

/** The cards of a hand that nobody but its owner sees, named by a number each: the keys in the order of the slots, and the next number to give. The state of a `HeldHand` between two renders */
export type HeldKeys = { keys: readonly number[]; next: number }

/** A hand that holds nothing yet */
export const NO_KEYS: HeldKeys = { keys: [], next: 0 }

/**
 * The cards of a hand once it holds `count`: all the view knows of it is a count, so which card goes and which comes is a rule. A card that is played leaves from the left end of the fan, as the viewer sees it, and a card that is drawn comes in at its right end, so the cards that stay
 * keep their names and glide to their new slots. The same `HeldKeys` comes back when nothing changed.
 */
export function heldKeysFor(held: HeldKeys, count: number, leftFirst: boolean): HeldKeys {
  const have = held.keys.length
  if (count === have) return held
  if (count < have) {
    const leaving = have - count
    return { keys: leftFirst ? held.keys.slice(leaving) : held.keys.slice(0, count), next: held.next }
  }
  const coming = count - have
  const fresh = Array.from({ length: coming }, (_, i) => held.next + i)
  // The new cards join at the right end of the picture: after the last card when the first is on the left, before the first when it is on the right (the nearest to the others is the oldest)
  return { keys: leftFirst ? [...held.keys, ...fresh] : [...fresh.reverse(), ...held.keys], next: held.next + coming }
}

/** The pose, on the table, of the card at the left end of a hand of `count` in the frame of its seat: where a card that is played from it flies from, with the hand still the size it was */
export function heldLeftPose(frame: Spot, layout: (count: number) => Pose[], count: number): Pose {
  const slots = layout(Math.max(1, count))
  return inFrame(frame, slots[leftEndIsFirst(frame, layout) ? 0 : slots.length - 1]!)
}

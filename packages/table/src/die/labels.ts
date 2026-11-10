import { hashRandom } from "../pose"
import type { DieModel } from "./model"

/** The labels of a die: `labelOf[face]` is the label a face carries, a permutation of 0 to `sides - 1`. A label is the place of a value in the die's list of values */
export type Labels = readonly number[]

/** A new die: every face carries the label the model gives it */
export const newLabels = (model: DieModel): Labels => model.labels

/** The labels after the die is turned by a symmetry of its solid: the label that was on a face is on the face it moved to */
export function turnLabels(labels: Labels, turn: readonly number[]): number[] {
  const next = new Array<number>(labels.length)
  labels.forEach((label, face) => {
    next[turn[face]!] = label
  })
  return next
}

/**
 * Makes the die show a label on a face, without changing what it is. A roll is simulated first, so the face that ends up on top is known before the die is drawn; the die is then labelled so that this face carries the number
 * the engine gave. It is done by turning the labels by a symmetry of the solid that takes the face carrying that label to the face on top, so the die stays a proper one (opposite faces still add up to the same number) and nobody
 * can tell it from a die that landed that way. A die with no such turn (a solid of a game's own) swaps the two labels. The same `key` picks the same turn when several would do.
 */
export function labelFace(model: DieModel, labels: Labels, face: number, label: number, key: string): number[] {
  const carrying = labels.indexOf(label)
  if (carrying === -1) throw new RangeError(`This die has no label ${label}`)
  if (carrying === face) return [...labels]
  const turns = model.symmetries.filter((turn) => turn[carrying] === face)
  if (turns.length > 0) {
    const pick = Math.min(turns.length - 1, Math.floor(((hashRandom(`${key}:turn`) + 1) / 2) * turns.length))
    return turnLabels(labels, turns[pick]!)
  }
  const swapped = [...labels]
  ;[swapped[face], swapped[carrying]] = [swapped[carrying]!, swapped[face]!]
  return swapped
}

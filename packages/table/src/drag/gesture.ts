/**
 * A press on a thing that may be picked up, from the moment the pointer goes down on it: which pointer it is (a mouse, a finger, a pen), where on the page it went down, and whether it has become a drag. It is a click until the pointer has gone far enough
 * from where it went down, so a press that wobbles by a pixel or two is still a press.
 */
export type Press = { pointer: number; x: number; y: number; dragging: boolean }

/** The press of `pointer` that began at (`x`, `y`), the place of the pointer on the page in pixels */
export const startPress = (pointer: number, x: number, y: number): Press => ({ pointer, x, y, dragging: false })

/**
 * The pointer moves to (`x`, `y`): returns the press as it is now, and `began` when this is the move that turned it into a drag, which happens once, the first time the pointer is `threshold` pixels or more from where it went down. The moves of another
 * pointer (a second finger) change nothing, and a press that is a drag already stays one wherever the pointer goes, back to where it began included.
 */
export function movePress(press: Press, pointer: number, x: number, y: number, threshold: number): { press: Press; began: boolean } {
  if (pointer !== press.pointer || press.dragging) return { press, began: false }
  const far = Math.hypot(x - press.x, y - press.y)
  if (far > 0 && far >= threshold) return { press: { ...press, dragging: true }, began: true }
  return { press, began: false }
}

/** What the end of a press is: a click when the pointer never went far enough, a drop when it did */
export const endOf = (press: Press): "click" | "drop" => (press.dragging ? "drop" : "click")

import { TIME } from "./view"

/** The part of a three.js `Clock` that react-three-fiber reads on every frame: how long the frame lasted, and the time since the start */
export type ClockLike = { elapsedTime: number; getDelta: () => number }

/**
 * Stretches the time of a canvas: a frame lasts `TIME.speed` of what it really lasted, and `TIME.freeze` stops it. The cards, the glows and everything damped read the frame's
 * delta or the clock, so they all slow down together; the camera's entrance (it counts real milliseconds) and the renderer do not. Returns what puts the clock back.
 */
export function slowClock(clock: ClockLike, time: typeof TIME = TIME): () => void {
  const real = clock.getDelta
  clock.getDelta = () => {
    const before = clock.elapsedTime
    const delta = real.call(clock)
    const scale = time.freeze ? 0 : time.speed
    if (scale === 1) return delta
    // The clock adds the real delta to its own time as it measures it: take back what the slowdown leaves out
    clock.elapsedTime = before + (clock.elapsedTime - before) * scale
    return delta * scale
  }
  return () => {
    clock.getDelta = real
  }
}

"use client"

/**
 * Photo of the table for the share card: the board registers a capture function while it is mounted
 * (e.g. a board renders its canvas at the requested size), the share dialog calls `captureGamePhoto`.
 */
type Capture = (width: number, height: number) => HTMLCanvasElement | null

/** DOM id of a game's table canvas: the share image falls back to the pixels of `#<id> canvas` when the board registers no capture function. */
export const TABLE_CANVAS_ID = "game-table"

let capture: Capture | null = null

/** Registers the board's capture function; returns the function that unregisters it (effect cleanup). */
export function setPhotoCapture(fn: Capture) {
  capture = fn
  return () => {
    if (capture === fn) capture = null
  }
}

/** Canvas with the table at this size, or null when the board shown has no photo. */
export const captureGamePhoto = (width: number, height: number) => capture?.(width, height) ?? null

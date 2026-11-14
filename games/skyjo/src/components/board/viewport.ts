"use client"

import { useSyncExternalStore } from "react"
import type { Viewport } from "./camera"

/** What a window is taken to be before there is one: a laptop */
const FALLBACK: Viewport = { width: 1280, height: 800 }

let last: Viewport = FALLBACK

const subscribe = (notify: () => void) => {
  window.addEventListener("resize", notify)
  return () => window.removeEventListener("resize", notify)
}

/** The size of the window as a value that only changes when the size does (`useSyncExternalStore` asks for the same object while nothing moved) */
function snapshot(): Viewport {
  const { innerWidth: width, innerHeight: height } = window
  if (width !== last.width || height !== last.height) last = { width, height }
  return last
}

/** The size of the window the board fills, in pixels, followed as it is resized */
export const useViewport = (): Viewport => useSyncExternalStore(subscribe, snapshot, () => FALLBACK)

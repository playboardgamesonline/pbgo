"use client"

import { useSyncExternalStore } from "react"
import { useBinding } from "./binding-context"
import { resolveMotion, type Motion } from "./motion-preference"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Whether the visitor asks for less motion; false on the server, corrected as soon as the page hydrates */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

/** The one place the in-game UI decides how much it moves: the visitor's preference, then the game's `UI_THEME.motion` */
export function useMotion(): Motion {
  const { UI_THEME } = useBinding()
  return resolveMotion(usePrefersReducedMotion(), UI_THEME?.motion)
}

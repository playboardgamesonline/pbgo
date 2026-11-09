"use client"

import { MotionConfig } from "motion/react"
import { useSyncExternalStore, type ReactNode } from "react"

// Whether the platform's motion is reduced, for the code that decides it in JavaScript: the member's own choice, then their device's. The choice (`Reduce motion` of the settings) is written on `<html>` as `data-reduce-motion`, `always` or
// `never`, by the head of every page before it paints and by the settings row when it is pressed (`MOTION_ATTRIBUTE` of `@pbgo/accounts/motion`, which says the same name: `reduced-motion.test.ts` keeps the two together); the stylesheet reads
// it too (`platform.css`, for the durations and the `motion-reduce:` and `motion-safe:` variants). Without it, the device's `prefers-reduced-motion` decides.

/** The attribute of `<html>` that carries the member's choice. */
export const MOTION_ATTRIBUTE = "data-reduce-motion"

const QUERY = "(prefers-reduced-motion: reduce)"

/** Whether the motion is reduced, from the member's choice (`always`, `never`, or anything else for none) and whether the device asks for it: the choice wins, the device decides when there is none. */
export function resolveReducedMotion(choice: string | null, deviceAsks: boolean): boolean {
  if (choice === "always") return true
  if (choice === "never") return false
  return deviceAsks
}

/** Whether the motion is reduced right now, for what is decided when something happens (a scroll that is smooth or not) and not while it is drawn. False where there is no page. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return resolveReducedMotion(document.documentElement.getAttribute(MOTION_ATTRIBUTE), window.matchMedia(QUERY).matches)
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  // The choice changes on `<html>` when the settings row is pressed, or when the account of the member is read
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [MOTION_ATTRIBUTE] })
  return () => {
    query.removeEventListener("change", onChange)
    observer.disconnect()
  }
}

/** Whether the motion is reduced, which follows the choice and the device as they change. The server draws with the motion on, and the page corrects it as soon as it hydrates. It is the hook the platform uses in place of `motion`'s, which follows the device alone. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}

/** `MotionConfig` for the `motion` components below it, which reduce their travel (transforms and layout) when the motion is reduced and keep their fades: it follows the member's choice as well as the device's, where `reducedMotion="user"` follows the device alone. */
export function MotionPreference({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion={useReducedMotion() ? "always" : "never"}>{children}</MotionConfig>
}

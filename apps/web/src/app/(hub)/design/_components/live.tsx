"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

/*
 * The page never states a token value by hand: it reads what the browser computed, so a change of `platform.css` shows up
 * here by itself. Both hooks return nothing on the server and until hydration; the components print "…" meanwhile.
 */

const SEPARATOR = "\u001f"

// Only the viewport moves a token while the page is open (`--gutter` and `--section` widen at the `sm` breakpoint)
function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

function read(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Computed values of CSS variables on `<html>` (where the `platform` class sits), in the order asked. */
export function useCssVars(names: readonly string[]): string[] {
  const joined = useSyncExternalStore(
    subscribe,
    () => names.map(read).join(SEPARATOR),
    () => "",
  )
  return joined === "" ? names.map(() => "") : joined.split(SEPARATOR)
}

/** One CSS variable as text: `<Var name="--radius" />`. */
export function Var({ name }: { name: string }) {
  const [value] = useCssVars([name])
  return <>{value || "…"}</>
}

/**
 * Computed properties of one element, read once the browser has laid it out (for values no variable holds, such as
 * `border-top-left-radius` of `rounded-md`). Pass `ref` to the element; `values` follow the order of `properties`.
 */
export function useMeasured(properties: readonly string[]) {
  const [node, setNode] = useState<Element | null>(null)
  const [joined, setJoined] = useState("")
  // A string, so an inline array literal does not restart the observer on every render
  const key = properties.join(SEPARATOR)
  useEffect(() => {
    if (!node) return
    const names = key.split(SEPARATOR)
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(node)
      setJoined(names.map((name) => style.getPropertyValue(name)).join(SEPARATOR))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, key])
  return { ref: setNode, values: joined === "" ? properties.map(() => "") : joined.split(SEPARATOR) }
}

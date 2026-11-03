import { useSyncExternalStore } from "react"

/**
 * Whether the page is scrolled further than `offset` pixels from its top. False on the server and until the browser has said otherwise, so that a page that is
 * opened at its top reads the same in the server's HTML and in the browser (a page opened further down, on a reload, is read once the browser is ready).
 */
export function useScrolledPast(offset: number): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true })
      return () => window.removeEventListener("scroll", onChange)
    },
    () => window.scrollY > offset,
    () => false
  )
}

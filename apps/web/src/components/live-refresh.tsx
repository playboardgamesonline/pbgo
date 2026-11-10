"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Asks the server to draw the page again now and then while it is in view, and when the visitor comes back to it: the public tables come and go as hosts open them and people sit down, and a page that was drawn a minute ago would offer a table that is full
// (PLT-21). The server draws the page again (`router.refresh`); what is on the screen keeps its state (the table that is picked, a dialog that is open). A tab in the background asks for nothing. Nothing is drawn: it renders no element.

/** How often a page in view asks for the tables again, in milliseconds. */
const EVERY_MS = 20_000

export function LiveRefresh({ everyMs = EVERY_MS }: { everyMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const timer = setInterval(refresh, everyMs)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router, everyMs])
  return null
}

"use client"

import { useEffect, useState } from "react"
import { FIGURES_PATH, FIGURES_REFRESH_MS, type HubFigures, parseFigures, statsItems } from "@pbgo/core/lib/hub-figures"
import { Stats } from "@pbgo/ui/platform/stats"

/**
 * The figures under the title of the home (`Stats`), kept alive. The page is static, so it brings the figures it was built with, and the browser asks for fresh ones when the page opens and every half minute
 * while it is in view (`GET /api/hub/figures`): the players online and the members follow the database, not the last time the page was built. A figure that cannot be refreshed stays as it was, and one that the server could
 * not count keeps its last value; the page never makes one up.
 */
export function LiveStats({ initial, games, className }: { initial: HubFigures; games: number; className?: string }) {
  const [figures, setFigures] = useState(initial)

  useEffect(() => {
    let stopped = false
    const refresh = async () => {
      if (document.visibilityState !== "visible") return
      try {
        const response = await fetch(FIGURES_PATH, { cache: "no-store" })
        if (!response.ok) return
        const next = parseFigures(await response.json())
        if (next && !stopped) setFigures((current) => ({ online: next.online ?? current.online, members: next.members ?? current.members }))
      } catch {
        // Offline, or the server is down: the figures stay as they are
      }
    }
    void refresh()
    const timer = setInterval(refresh, FIGURES_REFRESH_MS)
    const onVisible = () => void refresh()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return <Stats className={className} items={statsItems(figures, games)} />
}

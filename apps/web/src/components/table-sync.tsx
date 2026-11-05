"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { PublicGame } from "@pbgo/core/lib/game-types"
import { subscribeToGame } from "@pbgo/core/lib/realtime"
import { enterBoard } from "@/lib/table-door"

// Keeps the page of a table that waits for players alive (PLT-106): the people who sit down and leave, and the start. It listens to the table's channel (Supabase Realtime, the one the game's own lobby listened to) and asks again every few seconds and
// when the window is back, since the channel is a convenience and not a promise. The page is drawn on the server, so when the table has moved on (`version` is what the page was drawn from) it asks the server to draw it again. When the table has been started, a player who sits at it is taken
// to its board (`enterBoard`), whoever pressed the button; someone who only looks at it sees the page drawn again.

const POLL_MS = 8000

export function TableSync({ slug, code, version, member }: { slug: string; code: string; version: number; member: boolean }) {
  const router = useRouter()
  const shown = useRef({ version, member })
  // The newest version the page asked the server to draw, so that a poll and a message of the channel do not ask twice for the same
  const asked = useRef(version)

  useEffect(() => {
    shown.current = { version, member }
  }, [version, member])

  useEffect(() => {
    let stopped = false
    async function check() {
      try {
        const response = await fetch(`/api/${slug}/games/${code}`, { cache: "no-store" })
        if (!response.ok || stopped) return
        const table = (await response.json()) as Pick<PublicGame, "status" | "version">
        if (table.status !== "lobby" && shown.current.member) return enterBoard(router, slug, code)
        if (table.version !== shown.current.version && table.version !== asked.current) {
          asked.current = table.version
          router.refresh()
        }
      } catch {
        // offline for a moment: the next check asks again
      }
    }
    const stop = subscribeToGame(slug, code, () => void check())
    const poll = setInterval(() => void check(), POLL_MS)
    const onFocus = () => void check()
    window.addEventListener("focus", onFocus)
    return () => {
      stopped = true
      stop()
      clearInterval(poll)
      window.removeEventListener("focus", onFocus)
    }
  }, [slug, code, router])

  return null
}

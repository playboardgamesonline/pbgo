"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@pbgo/ui/platform/sonner"
import { currentQueue, dropQueue, onTablesLeft, pollSearch, useQueue } from "@/lib/matchmaking"
import { ENTER_BOARD_EVENT, enterBoard, messageOf } from "@/lib/table-door"

/** How often the browser asks the server where the search is: it keeps the visitor's seats alive, and tells them a table has filled. */
const POLL_MS = 3_500

/** How long a table that is full and has not begun is waited for before the visitor is taken to its page, where its host starts it (somebody at it is in a game, or a seat changed). */
const FULL_WAIT_MS = 8_000

/**
 * Keeps the search of the visitor alive on every page of the hub (the layout mounts it once, next to the navbar), and takes them where it leads (`lib/matchmaking.ts`). It draws nothing. While there is a search it asks the server where it is every few seconds, which
 * keeps the visitor's seats at the tables alive and tells them how many are seated. When a table of the search has begun, the visitor is taken to its board, where its ready check is (`enterBoard`), and the search is over: the server unseats the players of a game from their
 * other tables when it begins. A table that is full and does not begin takes the visitor to its page after a while. The page the visitor is on is asked again when the tables of the search change, so that the lists of tables show them. A call that fails for good stops the search and says why.
 */
export function SearchSync() {
  const queue = useQueue()
  const router = useRouter()
  const since = queue?.since
  const matched = queue?.tables?.find((table) => table.status !== "lobby")
  const full = queue?.tables?.find((table) => table.status === "lobby" && table.seats > 0 && table.players >= table.seats)

  // The visitor is taken to the board of the table that has begun
  useEffect(() => {
    if (matched) enterBoard(router, matched.game, matched.code)
  }, [matched, router])

  // A visitor who is taken to a board, by this search or by any other door (the host's start, the watcher of their table, the beat), is in a game: the search is over
  useEffect(() => {
    window.addEventListener(ENTER_BOARD_EVENT, dropQueue)
    return () => window.removeEventListener(ENTER_BOARD_EVENT, dropQueue)
  }, [])

  // A table that filled and has not begun after a while: its page, where its host can start it
  useEffect(() => {
    if (!full) return
    const timer = setTimeout(() => {
      const still = currentQueue()?.tables?.find((table) => table.game === full.game && table.code === full.code && table.status === "lobby" && table.players >= table.seats)
      if (!still) return
      dropQueue()
      router.push(`/game/${full.game}/${full.code}`)
    }, FULL_WAIT_MS)
    return () => clearTimeout(timer)
  }, [full, router])

  // The search is asked again while it lasts, a tab in the background included: its seats must not die while the visitor reads another page
  useEffect(() => {
    if (since === undefined) return
    const timer = setInterval(() => {
      pollSearch().catch((error) => toast.error(messageOf(error)))
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [since])

  // The page asks for what it lists again when the tables of the search change, and when the server has answered that the visitor left them
  const signature = (queue?.tables ?? []).map((table) => `${table.game}:${table.code}:${table.players}`).join(",")
  const listed = useRef(signature)
  useEffect(() => {
    if (listed.current === signature) return
    listed.current = signature
    router.refresh()
  }, [signature, router])
  useEffect(() => onTablesLeft(() => router.refresh()), [router])

  return null
}

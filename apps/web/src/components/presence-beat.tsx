"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAccount } from "@pbgo/accounts/client"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { PRESENCE_PATH, readBeatAnswer, startBeating, takenToGame, type BeatResult } from "@pbgo/accounts/presence"
import { enterBoard } from "@/lib/table-door"

/**
 * Tells the server that a signed-in member has the site open, on every page of the hub (the layout mounts it once, next to the navbar): about every 45 s, from a tab that is in view, and at once when the tab
 * comes back into view (`startBeating`). The players online count the member for two minutes after the last beat (`POST /api/hub/presence`). It draws nothing, asks no one, keeps nothing on the device and never makes a page
 * dynamic: the browser reads the session, as the navbar does. A beat that fails is tried again later and later. A guest beats nothing: a guest is online when they sit at a table.
 *
 * The answer to a beat also says where the member should be (PLT-120): a member who is playing, or whose table is in its ready check, is taken to its board from any page of the hub (`takenToGame`: the legal pages, which have to be
 * readable, are the exception), in place of the page they were on. The beat is the safety net of that rule and its only carrier for a member who is not looking at their table: it comes every 15 s while they have a lobby or a
 * ready check, since a ready check lasts a minute. A member seated at nothing that has begun is not taken anywhere.
 */
export function PresenceBeat() {
  const state = useAccount()
  const router = useRouter()
  const pathname = usePathname()
  // The page the member is on when the answer comes: the beat goes on across the pages of the hub, it does not start again at each one
  const page = useRef(pathname)
  useEffect(() => {
    page.current = pathname
  }, [pathname])
  // The demo account of development is in no database
  const member = state.status === "signed-in" && !isDemoAccount(state.account) ? state.account.id : null

  useEffect(() => {
    if (!member) return
    return startBeating({
      send: async (): Promise<BeatResult> => {
        const response = await fetch(PRESENCE_PATH, { method: "POST", cache: "no-store", keepalive: true })
        if (!response.ok) return false
        const { table, watching } = readBeatAnswer(await response.json().catch(() => null))
        if (table && takenToGame(page.current)) enterBoard(router, table.game, table.code, { replace: true })
        return watching ? "soon" : true
      },
      visible: () => document.visibilityState === "visible",
      onVisible: (callback) => {
        const listener = () => {
          if (document.visibilityState === "visible") callback()
        }
        document.addEventListener("visibilitychange", listener)
        return () => document.removeEventListener("visibilitychange", listener)
      },
    })
  }, [member, router])

  return null
}

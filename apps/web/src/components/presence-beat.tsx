"use client"

import { useEffect } from "react"
import { useAccount } from "@pbgo/accounts/client"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { PRESENCE_PATH, startBeating } from "@pbgo/accounts/presence"

/**
 * Tells the server that a signed-in member has the site open, on every page of the hub (the layout mounts it once, next to the navbar): about every 45 s, from a tab that is in view, and at once when the tab
 * comes back into view (`startBeating`). The players online count the member for two minutes after the last beat (`POST /api/hub/presence`). It draws nothing, asks no one, keeps nothing on the device and never makes a page
 * dynamic: the browser reads the session, as the navbar does. A beat that fails is tried again later and later. A guest beats nothing: a guest is online when they sit at a table.
 */
export function PresenceBeat() {
  const state = useAccount()
  // The demo account of development is in no database
  const member = state.status === "signed-in" && !isDemoAccount(state.account) ? state.account.id : null

  useEffect(() => {
    if (!member) return
    return startBeating({
      send: async () => (await fetch(PRESENCE_PATH, { method: "POST", cache: "no-store", keepalive: true })).ok,
      visible: () => document.visibilityState === "visible",
      onVisible: (callback) => {
        const listener = () => {
          if (document.visibilityState === "visible") callback()
        }
        document.addEventListener("visibilitychange", listener)
        return () => document.removeEventListener("visibilitychange", listener)
      },
    })
  }, [member])

  return null
}

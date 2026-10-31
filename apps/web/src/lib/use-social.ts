"use client"

import { useEffect, useState } from "react"
import type { Account } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { Friend } from "@pbgo/ui/friends"
import type { Conversation, FriendRequest } from "@pbgo/ui/social"

/** What the social panel of the navbar holds: the friends, the conversations with them and the requests to be friends. */
export type Social = { friends: readonly Friend[]; requests: readonly FriendRequest[]; conversations: readonly Conversation[] }

const NOBODY: Social = { friends: [], requests: [], conversations: [] }

/**
 * The friends, the conversations and the requests of a signed-in visitor, for the social panel that every page of the hub has (`SiteSocial`). The pages are static
 * and the panel is in the browser, so they are asked for here and not by the page. Nobody has any yet for a real account (PLT-23: they are in the platform schema,
 * which does not exist), so this is nothing, and this is where they will be read, with the presence of the friends, when they do. The demo account of development
 * has made-up ones (`demo-data.ts`), loaded only in development: the check on `NODE_ENV` is the build's, which drops the import from a deployment.
 */
export function useSocial(account: Account): Social {
  const [demo, setDemo] = useState<Social | null>(null)
  const isDemo = account.id === DEMO_ACCOUNT.id

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !isDemo) return
    let active = true
    import("./demo-data").then((data) => {
      if (active) setDemo({ friends: data.DEMO_FRIENDS, requests: data.DEMO_REQUESTS, conversations: data.demoConversations(Date.now()) })
    })
    return () => {
      active = false
    }
  }, [isDemo])

  return isDemo && demo ? demo : NOBODY
}

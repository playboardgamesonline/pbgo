"use client"

import { useEffect, useMemo, useState } from "react"
import type { Account } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { SocialState } from "@pbgo/core/lib/friends"
import { panelOf } from "@pbgo/core/lib/friends-view"
import type { Friend } from "@pbgo/ui/friends"
import type { Conversation, FriendRequest, TableInvitation } from "@pbgo/ui/social"
import { useSocialState } from "./social-store"

/** What the social panel of the navbar holds: the friends, the conversations with them and the requests to be friends. */
export type Social = { friends: readonly Friend[]; requests: readonly FriendRequest[]; conversations: readonly Conversation[]; invitations: readonly TableInvitation[] }

const NOBODY: Social = { friends: [], requests: [], conversations: [], invitations: [] }

/**
 * The friends, the conversations and the requests of a signed-in visitor, for the social panel that every page of the hub has (`SiteSocial`). The pages are static and the panel is in the browser, so they are asked for here and not by the page: a real account's
 * friends, with whether they are online and the game they are at, and the requests, come from `GET /api/hub/friends`, read when the panel is on the page and again every 20 s while a tab is in view (`social-store.ts`); there are no conversations until
 * the messages exist (PLT-25), and the invitations to a table that wait for the member come with the state (PLT-109). The demo account of development has made-up ones (`demo-data.ts`), loaded only in development: the check on `NODE_ENV` is the build's, which drops the import from a deployment. A page that has read the state on the server
 * (`social-state.ts`) gives it as `initial`, which is shown until the browser has read it.
 */
export function useSocial(account: Pick<Account, "id"> | null, initial?: SocialState | null): Social {
  const [demo, setDemo] = useState<Social | null>(null)
  const isDemo = account?.id === DEMO_ACCOUNT.id
  const state = useSocialState(account && !isDemo ? account.id : null, initial)
  const real = useMemo<Social>(() => {
    if (!state) return NOBODY
    const { friends, requests, invitations } = panelOf(state)
    return { friends, requests, conversations: [], invitations }
  }, [state])

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !isDemo) return
    let active = true
    import("./demo-data").then((data) => {
      if (active) setDemo({ friends: data.DEMO_FRIENDS, requests: data.DEMO_REQUESTS, conversations: data.demoConversations(Date.now()), invitations: [] })
    })
    return () => {
      active = false
    }
  }, [isDemo])

  return isDemo ? (demo ?? NOBODY) : real
}

"use client"

import { useEffect, useMemo, useState } from "react"
import type { Account } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { SocialState } from "@pbgo/core/lib/friends"
import { panelOf } from "@pbgo/core/lib/friends-view"
import type { Friend } from "@pbgo/ui/friends"
import type { Group } from "@pbgo/ui/groups"
import type { Conversation, FriendRequest, Invitation } from "@pbgo/ui/social"
import { useSocialState } from "./social-store"

/** What the social panel of the navbar holds: the friends, the conversations with them, the requests to be friends, the invitations (to a table, to a group, requests to join one) and the member's own group, null when they are in none. */
export type Social = { friends: readonly Friend[]; requests: readonly FriendRequest[]; conversations: readonly Conversation[]; invitations: readonly Invitation[]; group: Group | null }

const NOBODY: Social = { friends: [], requests: [], conversations: [], invitations: [], group: null }

/**
 * The friends, the conversations and the requests of a signed-in visitor, for the social panel that every page of the hub has (`SiteSocial`). The pages are static and the panel is in the browser, so they are asked for here and not by the page: a real account's
 * friends, with whether they are online and the game they are at, and the requests, come from `GET /api/hub/friends`, read when the panel is on the page and again every 20 s while a tab is in view (`social-store.ts`); the conversations (the last message of each and what is not read), the invitations that wait for the member (PLT-109) and their group (PLT-23) come with the state. The demo account of development has made-up ones (`demo-data.ts`), loaded only in development: the check on `NODE_ENV` is the build's, which drops the import from a deployment. A page that has read the state on the server
 * (`social-state.ts`) gives it as `initial`, which is shown until the browser has read it.
 */
export function useSocial(account: Pick<Account, "id"> | null, initial?: SocialState | null): Social {
  const [demo, setDemo] = useState<Social | null>(null)
  const isDemo = account?.id === DEMO_ACCOUNT.id
  const state = useSocialState(account && !isDemo ? account.id : null, initial)
  const real = useMemo<Social>(() => {
    if (!state) return NOBODY
    const { friends, requests, invitations, conversations, group } = panelOf(state)
    return { friends, requests, conversations, invitations, group }
  }, [state])

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !isDemo) return
    let active = true
    import("./demo-data").then((data) => {
      if (active) setDemo({ friends: data.DEMO_FRIENDS, requests: data.DEMO_REQUESTS, conversations: data.demoConversations(Date.now()), invitations: [], group: data.DEMO_GROUP })
    })
    return () => {
      active = false
    }
  }, [isDemo])

  return isDemo ? (demo ?? NOBODY) : real
}

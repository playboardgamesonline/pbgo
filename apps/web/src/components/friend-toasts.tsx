"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { tagText, type Handle } from "@pbgo/accounts"
import { NO_WATCH, requestKey, requestToastId, watchRequests, type RequestWatch } from "@pbgo/core/lib/friend-toasts"
import type { RequestEntry } from "@pbgo/core/lib/friends"
import { personKey } from "@pbgo/core/lib/friends-view"
import { FriendRequestSentToast, showFriendRequestReceived } from "@pbgo/ui/platform/person-toast"
import { toast } from "@pbgo/ui/platform/sonner"
import { TOAST_DURATION } from "@pbgo/ui/toasts"
import { useSocialRead, useSocialState } from "@/lib/social-store"

// The toasts of the friends (PLT-23): one when a request is sent, which takes it back, and one for each request that comes in, which accepts or declines it in a press. They are the platform's toasts about a person (`@pbgo/ui/platform/person-toast`); what a press does is
// `changeFriends`'s, given in by the caller, so that this file and `friend-actions.tsx` do not import each other. The names are `ph-mask` in the toasts themselves.

/** What answering a request that came in is: the same two actions as the buttons of the panel, which tell what became of them themselves. */
type Answer = (action: "accept" | "decline", who: Handle) => Promise<boolean>

/**
 * The toast of a request that was sent. The member typed a username and a tag, so the picture is not known when it is raised: it is found in the requests that the store reads next (the one that went out is among them), and the initials stand in until then.
 * `cancel` takes the request back and says so; once it went through, the page is read again (`router.refresh()`), so that the button of a profile that sent the request does not go on saying "Request sent".
 */
function SentRequest({ who, cancel, onDone }: { who: Handle; cancel: () => Promise<boolean>; onDone: () => void }) {
  const router = useRouter()
  const read = useSocialRead()
  const sent = read?.outgoing.find((entry) => personKey(entry) === personKey(who))
  return (
    <FriendRequestSentToast
      person={{ nickname: sent?.nickname ?? who.nickname, tag: tagText(sent?.tag ?? who.tag), avatarUrl: sent?.avatarUrl ?? null }}
      onCancel={async () => {
        const done = await cancel()
        if (done) router.refresh()
        return done
      }}
      onDone={onDone}
    />
  )
}

/** Raises the toast of a request that was sent to this member. Raised again for the same member it is the same toast. */
export function showSentRequest(who: Handle, cancel: () => Promise<boolean>): string | number {
  return toast.custom((id) => <SentRequest who={who} cancel={cancel} onDone={() => toast.dismiss(id)} />, { id: `friend-request-sent:${personKey(who)}`, duration: TOAST_DURATION.request })
}

/** Raises the toast of a request that came in, with its picture and the two answers. One toast for each request (`requestToastId`). */
function showReceivedRequest(entry: RequestEntry, answer: Answer): void {
  const who: Handle = { nickname: entry.nickname, tag: entry.tag }
  showFriendRequestReceived({
    id: requestToastId(requestKey(entry)),
    person: { nickname: entry.nickname, tag: tagText(entry.tag), avatarUrl: entry.avatarUrl },
    onAccept: () => answer("accept", who),
    onDecline: () => answer("decline", who),
  })
}

/**
 * Raises a toast for each friend request that comes in while the tab is open, and takes down the toast of one that was answered elsewhere (the panel, another tab). The requests are the social state's, read about every 20 s (`social-store.ts`): what waited when the tab
 * first read them is told by the badge of the panel and gets no toast, and a request is never told twice (`watchRequests`, which holds the rules and is tested). A burst is told by its newest and counted by one more toast. It reads the store for the account `accountId` (null for
 * no account: a guest, or the demo account of development, whose requests are made up and never come in) and keeps what it has seen in memory only, for as long as the page is open.
 */
export function useReceivedRequestToasts(accountId: string | null, answer: Answer): void {
  const state = useSocialState(accountId)
  const watching = useRef<{ account: string | null; watch: RequestWatch }>({ account: null, watch: NO_WATCH })

  useEffect(() => {
    if (accountId === null || state === null) return
    // Another account is another tab as far as the requests go: the first read of it tells nothing
    if (watching.current.account !== accountId) watching.current = { account: accountId, watch: NO_WATCH }
    const news = watchRequests(watching.current.watch, state.incoming)
    watching.current.watch = news.watch
    for (const key of news.gone) toast.dismiss(requestToastId(key))
    for (const entry of news.tell) showReceivedRequest(entry, answer)
    if (news.more > 0) toast.info(`${news.more} more friend requests`, { id: "friend-requests-more", description: "Answer them in the social panel." })
  }, [accountId, state, answer])
}

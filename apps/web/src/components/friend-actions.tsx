"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { handleText, parseHandleText, profilePath, type Handle } from "@pbgo/accounts"
import type { FriendRequestSource } from "@pbgo/analytics"
import { ApiClientError, gameRequest } from "@pbgo/core/lib/api"
import { friendActionPath, type FriendAction, type FriendResult } from "@pbgo/core/lib/friends"
import { handleOfPerson } from "@pbgo/core/lib/friends-view"
import type { Friend } from "@pbgo/ui/friends"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { toast } from "@pbgo/ui/platform/sonner"
import type { FriendRequest } from "@pbgo/ui/social"
import { refreshSocial } from "@/lib/social-store"
import { messageOf } from "@/lib/table-door"

// What a member does with their friends from the screens (PLT-23): send a request, answer one, remove a friend, block somebody, lift a block. Each is one `POST` under `/api/hub/friends` (`changeFriends`), which says what it did in a toast (the names in it are
// `ph-mask`, as nicknames are everywhere) and reads the social state again either way, so that every list on the page shows what the server says. Removing a friend and blocking ask first, in a window: both are easy to press by mistake and block is not undone by
// adding them again. The demo account of development is told it is done by the same routes and its lists, which the browser makes up, do not change.

/** A handle in a text of a toast or a window, masked in the recordings. */
const Name = ({ who }: { who: Handle }) => <span className="ph-mask">{handleText(who)}</span>

/** What a member is told when a change went through, or nothing: answering a request is seen in the list, where the row leaves. */
function saidAfter(action: FriendAction, result: FriendResult, who: Handle): ReactNode | null {
  if (result === "friends") return <>You are already friends with <Name who={who} />.</>
  if (result === "accepted") return <>You and <Name who={who} /> are now friends.</>
  if (action === "request") return <>Request sent to <Name who={who} />.</>
  if (action === "remove") return <>Removed <Name who={who} /> from your friends.</>
  if (action === "block") return <>Blocked <Name who={who} />.</>
  if (action === "unblock") return <>Unblocked <Name who={who} />.</>
  return null
}

/**
 * Makes one change to the member's friends and tells them what became of it: true when it was done. The social state is read again whatever the answer was, since a refusal can mean that what the screen shows is stale (a request that was answered in the
 * meantime, a member who changed their tag). `source` is where a request is sent from (the analytics' only property of it).
 */
export async function changeFriends(action: FriendAction, who: Handle, source?: FriendRequestSource): Promise<boolean> {
  try {
    const { result } = await gameRequest<{ ok: true; result: FriendResult }>(friendActionPath(action), {
      method: "POST",
      body: JSON.stringify({ nickname: who.nickname, tag: who.tag, ...(source ? { source } : {}) }),
    })
    const said = saidAfter(action, result, who)
    if (said) toast.success(said)
    return true
  } catch (error) {
    toast.error(messageOf(error))
    return false
  } finally {
    refreshSocial()
  }
}

type Change = { kind: "remove" | "block"; friend: Friend }

/** The window that asks before a friend is removed or a player blocked. It keeps the last change it was asked about while it closes, so that it does not empty as it fades. */
function ConfirmFriendChange({ change, busy, onConfirm, onCancel }: { change: Change | null; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const [shown, setShown] = useState<Change | null>(change)
  if (change && change !== shown) setShown(change)
  const who = shown ? handleOfPerson(shown.friend) : null
  return (
    <Dialog open={change !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        {shown && who && (
          <>
            <DialogHeader>
              <DialogTitle>{shown.kind === "remove" ? "Remove friend" : "Block player"}</DialogTitle>
              <DialogDescription>
                {shown.kind === "remove" ? (
                  <>
                    Remove <Name who={who} /> from your friends? You will need to send a new request to be friends again.
                  </>
                ) : (
                  <>
                    Block <Name who={who} />? You will no longer be friends, and they cannot send you friend requests. They are not told.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant={shown.kind === "block" ? "destructive" : "default"} size="lg" onClick={onConfirm} disabled={busy}>
                {shown.kind === "remove" ? "Remove" : "Block"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * What the friends' screens do (the panel of the navbar, the page of the friends): the handlers to give the panel, and the `dialog` to render beside it, as `useAgeGate` does. `sendRequest` takes what the form typed, `username#tag`, and answers whether it
 * went (a refusal keeps the fields); `answer` is for the buttons of a request (accept, decline, cancel); `viewProfile` goes to a friend's profile; `remove` and `block` ask in the window first. A change that is on its way is not sent twice.
 */
export function useFriendActions() {
  const router = useRouter()
  const sending = useRef(new Set<string>())
  const [change, setChange] = useState<Change | null>(null)
  const [busy, setBusy] = useState(false)

  /** Runs a change unless the same one is on its way. */
  const once = useCallback(async (action: FriendAction, who: Handle, source?: FriendRequestSource): Promise<boolean> => {
    const key = `${action}:${who.nickname.toLowerCase()}#${who.tag}`
    if (sending.current.has(key)) return false
    sending.current.add(key)
    try {
      return await changeFriends(action, who, source)
    } finally {
      sending.current.delete(key)
    }
  }, [])

  const sendRequest = useCallback(
    async (text: string): Promise<boolean> => {
      const who = parseHandleText(text)
      if (!who) {
        toast.error(new ApiClientError("FRIEND_INVALID").message)
        return false
      }
      return once("request", who, "form")
    },
    [once],
  )

  const answer = useCallback(
    (request: FriendRequest, how: "accept" | "decline" | "cancel") => {
      const who = handleOfPerson(request)
      if (who) void once(how, who)
    },
    [once],
  )

  const viewProfile = useCallback(
    (friend: Friend) => {
      const who = handleOfPerson(friend)
      if (who) router.push(profilePath(who))
    },
    [router],
  )

  const confirm = useCallback(async () => {
    const who = change ? handleOfPerson(change.friend) : null
    if (!change || !who) return
    setBusy(true)
    await once(change.kind, who)
    setBusy(false)
    setChange(null)
  }, [change, once])

  const dialog = <ConfirmFriendChange change={change} busy={busy} onConfirm={confirm} onCancel={() => setChange(null)} />
  return {
    sendRequest,
    answer,
    viewProfile,
    remove: (friend: Friend) => setChange({ kind: "remove", friend }),
    block: (friend: Friend) => setChange({ kind: "block", friend }),
    dialog,
  }
}

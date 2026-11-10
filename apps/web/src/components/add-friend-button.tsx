"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tick02Icon, UserAdd01Icon, UserBlock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Handle } from "@pbgo/accounts"
import type { FriendAction, FriendRelation } from "@pbgo/core/lib/friends"
import { Button } from "@pbgo/ui/platform/button"
import { changeFriends } from "@/components/friend-actions"

/** What the button does for each relation, and the relation that follows when it went through. Friends and a request that waits have nothing to press. */
const NEXT: Partial<Record<FriendRelation, { action: FriendAction; becomes: FriendRelation }>> = {
  none: { action: "request", becomes: "outgoing" },
  incoming: { action: "accept", becomes: "friends" },
  blocked: { action: "unblock", becomes: "none" },
}

/**
 * The button of another member's profile (PLT-23), for a signed-in visitor: Add friend, then Request sent while it waits, Accept request when that member had asked first, Friends once they are, and Unblock when the visitor blocked them. `relation` is what the server
 * read for the page; the button shows what it just did at once and asks the page to read it again (`router.refresh`). A request that the server refuses is told in a toast (`changeFriends`), and the button stays as it was.
 */
export function AddFriendButton({ handle, relation: initial }: { handle: Handle; relation: FriendRelation }) {
  const router = useRouter()
  // What the button shows is what it just did, until the page reads the relation again: then it is the server's word
  const [shown, setShown] = useState({ read: initial, relation: initial })
  const [busy, setBusy] = useState(false)
  if (shown.read !== initial) setShown({ read: initial, relation: initial })
  const relation = shown.relation

  const next = NEXT[relation]

  async function press() {
    if (!next || busy) return
    setBusy(true)
    const done = await changeFriends(next.action, handle, next.action === "request" ? "profile" : undefined)
    setBusy(false)
    if (!done) return
    setShown((current) => ({ ...current, relation: next.becomes }))
    router.refresh()
  }

  if (relation === "outgoing") {
    return (
      <Button type="button" variant="secondary" disabled>
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} data-icon="inline-start" />
        Request sent
      </Button>
    )
  }
  if (relation === "friends") {
    return (
      <Button type="button" variant="secondary" disabled>
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} data-icon="inline-start" />
        Friends
      </Button>
    )
  }
  return (
    <Button type="button" variant={relation === "blocked" ? "outline" : "default"} onClick={press} disabled={busy}>
      <HugeiconsIcon icon={relation === "blocked" ? UserBlock01Icon : UserAdd01Icon} strokeWidth={2} data-icon="inline-start" />
      {relation === "incoming" ? "Accept request" : relation === "blocked" ? "Unblock" : "Add friend"}
    </Button>
  )
}

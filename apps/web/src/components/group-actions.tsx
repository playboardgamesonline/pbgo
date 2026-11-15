"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { handleText, profilePath, type Handle } from "@pbgo/accounts"
import { gameRequest } from "@pbgo/core/lib/api"
import { handleOfPerson } from "@pbgo/core/lib/friends-view"
import { NO_GROUP_WATCH, watchGroup, type GroupWatch } from "@pbgo/core/lib/group-toasts"
import { groupActionPath, type GroupAction, type GroupResult } from "@pbgo/core/lib/groups"
import { invitationActionPath, type InvitationResult } from "@pbgo/core/lib/invitations"
import type { Friend } from "@pbgo/ui/friends"
import type { GroupMember } from "@pbgo/ui/groups"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { InviteFriendDialog } from "@pbgo/ui/platform/invite-friend"
import { toast } from "@pbgo/ui/platform/sonner"
import { refreshSocial, useSocialState } from "@/lib/social-store"
import { messageOf } from "@/lib/table-door"

// What a member does with their group from the screens (PLT-23): invite a friend to it (a friend's row, the menu of the chat, the picker of the group tab), ask to join the group of a friend, leave, remove a member and hand the lead over (the leader's). Inviting and asking are
// invitations (`POST /api/hub/invitations/send`, `kind` `group` and `join`: the one mechanism of the invitations to a table); the rest are `POST`s under `/api/hub/groups`. Each says what it did in a toast (the names in it are `ph-mask`) and reads the social state again either
// way, so that every list on the page shows what the server says: the group comes with it. Removing a member asks first, in a window. The demo account of development is told it is done by the same routes and its group, which the browser makes up, does not change.
// `useGroupNews` tells what changed in the group between two reads (somebody joined, somebody left, the group is over), since the others' changes are the only thing the member's own presses do not tell.

/** A handle in a text of a toast or a window, masked in the recordings. */
const Name = ({ who }: { who: Handle }) => <span className="ph-mask">{handleText(who)}</span>

/** The nickname of a member in a sentence, masked in the recordings. */
const Nickname = ({ nickname }: { nickname: string }) => <span className="ph-mask">{nickname}</span>

/** What a member is told when an invitation or a request went out. */
async function sendInvitation(kind: "group" | "join", friend: Friend): Promise<boolean> {
  const who = handleOfPerson(friend)
  if (!who) return false
  try {
    await gameRequest<InvitationResult>(invitationActionPath("send"), { method: "POST", body: JSON.stringify({ kind, nickname: who.nickname, tag: who.tag }) })
    toast.success(
      kind === "group" ? (
        <>
          Invited <Name who={who} /> to your group.
        </>
      ) : (
        <>
          Asked <Name who={who} /> to let you join their group.
        </>
      ),
    )
    return true
  } catch (error) {
    toast.error(messageOf(error))
    return false
  } finally {
    refreshSocial()
  }
}

/** What a member is told when a change of the group went through. */
function saidAfter(result: GroupResult, who: Handle | null): ReactNode {
  if (result === "left") return "You left the group."
  if (!who) return null
  return result === "kicked" ? (
    <>
      Removed <Name who={who} /> from the group.
    </>
  ) : (
    <>
      <Name who={who} /> leads the group now.
    </>
  )
}

/** Whether the member just pressed Leave: the group that is over in their next read is then no news to them. A press that is refused takes it back. */
let leaving = false

/** Whether the member just accepted an invitation to a group: the group they have in their next read is then no news to them (their own toast told it). */
let accepted = false

/** Called when the member's acceptance of an invitation to a group went through, before the state is read again. */
export function markAccepted(): void {
  accepted = true
}

/** Makes one change to the member's group and tells them what became of it: true when it was done. The social state is read again whatever the answer was. */
async function changeGroup(action: GroupAction, who: Handle | null): Promise<boolean> {
  try {
    const { result } = await gameRequest<{ ok: true; result: GroupResult }>(groupActionPath(action), { method: "POST", body: JSON.stringify(who ? { nickname: who.nickname, tag: who.tag } : {}) })
    const said = saidAfter(result, who)
    if (said) toast.success(said)
    return true
  } catch (error) {
    toast.error(messageOf(error))
    return false
  } finally {
    refreshSocial()
  }
}

/** The window that asks before a member is removed from the group. It keeps the last member it was asked about while it closes, so that it does not empty as it fades. */
function ConfirmRemoveMember({ member, busy, onConfirm, onCancel }: { member: GroupMember | null; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const [shown, setShown] = useState<GroupMember | null>(member)
  if (member && member !== shown) setShown(member)
  const who = shown ? handleOfPerson(shown) : null
  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        {shown && who && (
          <>
            <DialogHeader>
              <DialogTitle>Remove from group</DialogTitle>
              <DialogDescription>
                Remove <Name who={who} /> from your group? They can join again with a new invitation.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="lg" onClick={onConfirm} disabled={busy}>
                Remove
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * What the group's screens do (the panel of the navbar, the chat's menu, the page of the friends): the handlers to give them, and the `dialogs` to render beside the panel, as `useFriendActions` does. `friends` are the member's friends, for the picker of the group tab (a friend in
 * a group is not listed: they are asked to let the member in, from their row; the friends already invited show as sent). `invite` and `askToJoin` are for a friend's row; `openInvite` opens the picker; `leave`, `kick` (it asks first), `makeLeader` and `viewProfile` are for the
 * group tab. A change that is on its way is not sent twice.
 */
export function useGroupActions(friends: readonly Friend[]) {
  const router = useRouter()
  const running = useRef(new Set<string>())
  const [removing, setRemoving] = useState<GroupMember | null>(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)

  /** Runs a change unless the same one is on its way. */
  const once = useCallback(async (key: string, run: () => Promise<boolean>): Promise<boolean> => {
    if (running.current.has(key)) return false
    running.current.add(key)
    try {
      return await run()
    } finally {
      running.current.delete(key)
    }
  }, [])

  const invite = useCallback((friend: Friend) => void once(`invite:${friend.id}`, () => sendInvitation("group", friend)), [once])
  const askToJoin = useCallback((friend: Friend) => void once(`ask:${friend.id}`, () => sendInvitation("join", friend)), [once])
  const inviteFromPicker = useCallback((friend: Friend) => once(`invite:${friend.id}`, () => sendInvitation("group", friend)), [once])

  const leave = useCallback(
    () =>
      void once("leave", async () => {
        leaving = true
        const done = await changeGroup("leave", null)
        if (!done) leaving = false
        return done
      }),
    [once],
  )

  const makeLeader = useCallback(
    (member: GroupMember) => {
      const who = handleOfPerson(member)
      if (who) void once(`lead:${member.id}`, () => changeGroup("lead", who))
    },
    [once],
  )

  const confirmRemove = useCallback(async () => {
    const who = removing ? handleOfPerson(removing) : null
    if (!removing || !who) return
    setBusy(true)
    await once(`kick:${removing.id}`, () => changeGroup("kick", who))
    setBusy(false)
    setRemoving(null)
  }, [removing, once])

  const viewProfile = useCallback(
    (member: GroupMember) => {
      const who = handleOfPerson(member)
      if (who) router.push(profilePath(who))
    },
    [router],
  )

  // The picker lists the friends who are in no group and shows the ones already invited as sent
  const listed = useMemo(() => friends.filter((friend) => friend.group === undefined), [friends])
  const invited = useMemo(() => new Set(friends.filter((friend) => friend.pending === "invited").map((friend) => friend.id)), [friends])

  const dialogs = (
    <>
      <ConfirmRemoveMember member={removing} busy={busy} onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
      <InviteFriendDialog
        open={picking}
        onOpenChange={setPicking}
        friends={listed}
        invited={invited}
        onInvite={inviteFromPicker}
        title="Invite to your group"
        description="Friends who are online come first. One press sends the invitation to your group."
      />
    </>
  )

  return { invite, askToJoin, leave, makeLeader, viewProfile, kick: (member: GroupMember) => setRemoving(member), openInvite: () => setPicking(true), dialogs }
}

/** The nicknames of a few members in a sentence: "Bob", "Bob and Cat", and a count for more. */
function names(nicknames: readonly string[]): ReactNode {
  if (nicknames.length === 1) return <Nickname nickname={nicknames[0]!} />
  if (nicknames.length === 2) {
    return (
      <>
        <Nickname nickname={nicknames[0]!} /> and <Nickname nickname={nicknames[1]!} />
      </>
    )
  }
  return `${nicknames.length} players`
}

/**
 * Tells the member what changed in their group between two reads of the social state: who joined, who left, and that it is over when they did not leave it themselves. The read in which the member gets a group says it too, unless they accepted an invitation themselves (their own
 * toast told it): a member whose invitation was accepted is told who joined the group it made, and one who was let in after asking that they joined it. The first read of a tab tells nothing; `watchGroup` holds the rules and is tested. Nothing for no account (a guest, or the demo account of development, whose group is made up and never changes). It keeps what it has seen in memory only, for as long as the page is open.
 */
export function useGroupNews(accountId: string | null): void {
  const state = useSocialState(accountId)
  const watching = useRef<{ account: string | null; watch: GroupWatch }>({ account: null, watch: NO_GROUP_WATCH })

  useEffect(() => {
    if (accountId === null || state === null) return
    // Another account is another tab as far as the group goes: the first read of it tells nothing
    if (watching.current.account !== accountId) watching.current = { account: accountId, watch: NO_GROUP_WATCH }
    const news = watchGroup(watching.current.watch, state.group)
    watching.current.watch = news.watch
    if (news.joined.length > 0) toast.info(<>{names(news.joined)} joined the group.</>)
    if (news.entered === "guest") {
      if (accepted) accepted = false
      else toast.info("You joined the group.")
    }
    if (news.left.length > 0) toast.info(<>{names(news.left)} left the group.</>)
    if (news.ended) {
      if (leaving) leaving = false
      else toast.info("You are no longer in the group.")
    }
  }, [accountId, state])
}

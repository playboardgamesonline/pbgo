"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { tagText } from "@pbgo/accounts"
import { useAccount } from "@pbgo/accounts/client"
import { gameRequest } from "@pbgo/core/lib/api"
import { handleOfPerson } from "@pbgo/core/lib/friends-view"
import { invitationActionPath, type InvitationResult } from "@pbgo/core/lib/invitations"
import { NO_INVITATION_WATCH, invitationToastId, watchInvitations, type InvitationWatch } from "@pbgo/core/lib/invitation-toasts"
import type { Friend } from "@pbgo/ui/friends"
import { InviteFriendDialog } from "@pbgo/ui/platform/invite-friend"
import { showGameInvitation } from "@pbgo/ui/platform/person-toast"
import { toast } from "@pbgo/ui/platform/sonner"
import type { TableInvitation } from "@pbgo/ui/social"
import { refreshSocial, useSocialState } from "@/lib/social-store"
import { messageOf } from "@/lib/table-door"
import { useSocial } from "@/lib/use-social"
import { useJoinTable } from "./join-table"

// The invitations to a table (PLT-109), from the screens. The host's side: "Invite a friend" in the menu of a free seat opens the picker (`useInviteFriend`), and a press on a friend sends the invitation (`POST /api/hub/invitations/send`). The friend's side: the card of the social
// panel and the toast that comes in while a tab is open give Accept and Decline (`useInvitationActions`, `useReceivedInvitationToasts`); accepting asks the server for the table (`POST …/accept`, which checks that it still waits and has room) and then sits the visitor down
// with the one way every list sits them down (`useJoinTable`: the game's own join route, and a refusal of its rank or language is a toast), which takes them to the lobby. A refusal of the invitation itself (a table that is full, began or is gone, an invitation that expired) is a toast
// in the platform's words. The social state is read again after each, whatever the answer was. The demo account of development is told it is done by the same routes, and nothing is written.

/** Sends an invitation to a friend, to the table `code` of `game`, and tells the visitor why when it was refused: true when it went. */
export async function inviteToTable(friend: Friend, table: { game: string; code: string }): Promise<boolean> {
  const who = handleOfPerson(friend)
  if (!who) return false
  try {
    await gameRequest<InvitationResult>(invitationActionPath("send"), { method: "POST", body: JSON.stringify({ nickname: who.nickname, tag: who.tag, game: table.game, code: table.code }) })
    return true
  } catch (error) {
    toast.error(messageOf(error))
    return false
  } finally {
    refreshSocial()
  }
}

/**
 * The picker of the friend to invite to a table, for the free seats of the visitor's own lobby: `invite(game, code)` opens it for that table and `dialog` is what to render beside the list. The friends are the social state's (online ones first, as suggestions: `InviteFriendDialog`), and
 * a press on one sends the invitation. Nothing is asked of the server until a press.
 */
export function useInviteFriend() {
  const state = useAccount()
  const account = state.status === "signed-in" ? state.account : null
  const { friends } = useSocial(account)
  const [table, setTable] = useState<{ game: string; code: string } | null>(null)
  const [shown, setShown] = useState<{ game: string; code: string } | null>(null)
  if (table && table !== shown) setShown(table)
  const invite = useCallback((game: string, code: string) => setTable({ game, code }), [])
  const dialog = (
    // Closing it keeps the table it was for while it fades, and a new table starts a clean list (`key`)
    <InviteFriendDialog
      key={shown ? `${shown.game}:${shown.code}` : "none"}
      open={table !== null}
      onOpenChange={(open) => !open && setTable(null)}
      friends={friends}
      onInvite={(friend) => (shown ? inviteToTable(friend, shown) : false)}
      description={shown ? `Online friends come first. One press sends the invitation to table ${shown.code}.` : undefined}
    />
  )
  return { invite, dialog }
}

/** Sits the visitor down at the table of an accepted invitation, once, as soon as it is on the page, and says when it is done. It is a component only because the join of a game is a hook of that game (`useJoinTable`). */
function JoinInvited({ game, code, onDone }: { game: string; code: string; onDone: () => void }) {
  const { join, dialogs } = useJoinTable(game, true)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void join(code).finally(onDone)
  }, [join, code, onDone])
  return <>{dialogs}</>
}

/**
 * What the visitor does with the invitations they got: `answer` is for the buttons of the card and of the toast, and answers whether it went (a refusal is told in a toast and keeps the invitation where it is: the card reads the state again). `joining` is what to render beside the
 * panel: it sits the visitor down at the table of an invitation that was accepted.
 */
export function useInvitationActions(): { answer: (invitation: Pick<TableInvitation, "id">, action: "accept" | "decline") => Promise<boolean>; joining: ReactNode } {
  const [joining, setJoining] = useState<{ game: string; code: string } | null>(null)
  const running = useRef(new Set<string>())

  const answer = useCallback(async (invitation: Pick<TableInvitation, "id">, action: "accept" | "decline"): Promise<boolean> => {
    if (running.current.has(invitation.id)) return false
    running.current.add(invitation.id)
    try {
      const result = await gameRequest<InvitationResult>(invitationActionPath(action), { method: "POST", body: JSON.stringify({ id: invitation.id }) })
      if (result.result === "accepted") setJoining({ game: result.game, code: result.code })
      return true
    } catch (error) {
      toast.error(messageOf(error))
      return false
    } finally {
      running.current.delete(invitation.id)
      refreshSocial()
    }
  }, [])

  return { answer, joining: joining && <JoinInvited key={`${joining.game}:${joining.code}`} game={joining.game} code={joining.code} onDone={() => setJoining(null)} /> }
}

/**
 * Raises a toast for each invitation that comes in while the tab is open (`showGameInvitation`: it stays until it is answered or closed), takes down the toast of one that was answered or expired elsewhere, and counts a burst in one more. The invitations are the social state's, read
 * about every 20 s (`social-store.ts`); what waited when the tab first read them is on the card and gets no toast, and an invitation is never told twice (`watchInvitations`, which holds the rules and is tested). Nothing for no account (a guest, or the demo account of
 * development, whose invitations never come in).
 */
export function useReceivedInvitationToasts(accountId: string | null, answer: (invitation: Pick<TableInvitation, "id">, action: "accept" | "decline") => Promise<boolean>, gameIcon: (slug: string) => string): void {
  const state = useSocialState(accountId)
  const watching = useRef<{ account: string | null; watch: InvitationWatch }>({ account: null, watch: NO_INVITATION_WATCH })

  useEffect(() => {
    if (accountId === null || state === null) return
    if (watching.current.account !== accountId) watching.current = { account: accountId, watch: NO_INVITATION_WATCH }
    const news = watchInvitations(watching.current.watch, state.invitations)
    watching.current.watch = news.watch
    for (const id of news.gone) toast.dismiss(invitationToastId(id))
    for (const entry of news.tell) {
      showGameInvitation({
        id: invitationToastId(entry.id),
        from: { nickname: entry.from.nickname, tag: tagText(entry.from.tag), avatarUrl: entry.from.avatarUrl },
        game: { name: entry.game.name, iconUrl: gameIcon(entry.game.slug) },
        onAccept: () => answer(entry, "accept"),
        onDecline: () => answer(entry, "decline"),
      })
    }
    if (news.more > 0) toast.info(`${news.more} more invitations`, { id: "table-invitations-more", description: "Answer them in the social panel." })
  }, [accountId, state, answer, gameIcon])
}

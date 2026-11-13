import type { InvitationEntry } from "./invitations"

/**
 * When a toast tells a member that an invitation to a table came in (PLT-109). The browser reads the social state every 20 s (`social-sync.ts`), and a toast is for what is new since the last read of this tab: the first read of a tab tells nothing (what waits is
 * counted on the picture of the panel and shown by its card), and an invitation is never told twice, whatever the reads that follow say. The same rules as the friend requests' (`friend-toasts.ts`), kept in the same shape: pure, so that the page and the tests read
 * the invitations the same way; the tab keeps an `InvitationWatch` and gives it back with each read, and nothing is stored anywhere.
 */

/** How many toasts one read raises at most: sonner shows three at a time, so a burst is told by the newest, and one more toast counts the rest. */
export const INVITATION_TOASTS_MAX = 3

/** What a tab remembers of the invitations it read, for as long as it is open. */
export type InvitationWatch = {
  /** Every invitation this tab has seen, so that none is told twice. Null until the first read, which tells nothing. */
  seen: ReadonlySet<string> | null
  /** The invitations that waited at the last read: the toast of one that is not there any more (answered, expired, its sender removed or blocked) is out of date. */
  waiting: ReadonlySet<string>
}

/** Nothing read yet: a new tab, or a tab that now shows another account. */
export const NO_INVITATION_WATCH: InvitationWatch = { seen: null, waiting: new Set() }

/** The id of the toast of an invitation: one toast for each, so that a toast raised again is the same one. */
export const invitationToastId = (id: string): string => `table-invitation:${id}`

export type InvitationNews = {
  /** The invitations to tell one by one, the oldest first, so that the newest is the one in front. */
  tell: InvitationEntry[]
  /** How many came in that are not told one by one (a burst): one toast counts them. */
  more: number
  /** The ids of the invitations that were told and are not waiting any more: their toasts are out of date. */
  gone: string[]
  /** What the tab remembers from now on. */
  watch: InvitationWatch
}

/** Reads the invitations that wait and says what is new, what is told, and which toasts are out of date. */
export function watchInvitations(watch: InvitationWatch, invitations: readonly InvitationEntry[]): InvitationNews {
  const ids = invitations.map((entry) => entry.id)
  const waiting = new Set(ids)
  if (watch.seen === null) return { tell: [], more: 0, gone: [], watch: { seen: new Set(ids), waiting } }

  const known = watch.seen
  const fresh = invitations.filter((entry) => !known.has(entry.id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const burst = fresh.length > INVITATION_TOASTS_MAX
  const tell = burst ? fresh.slice(fresh.length - (INVITATION_TOASTS_MAX - 1)) : fresh
  return { tell, more: fresh.length - tell.length, gone: [...watch.waiting].filter((id) => !waiting.has(id)), watch: { seen: new Set([...known, ...ids]), waiting } }
}

import type { RequestEntry } from "./friends"
import { personKey } from "./friends-view"

/**
 * When a toast tells a member that a friend request came in (PLT-23). The browser reads the requests every 20 s (`social-sync.ts`), and a toast is for what is new since the last read of this tab: the first read of a tab tells nothing, since what waits already is what
 * the badge of the panel counts, and a request is never told twice, whatever the reads that follow say. Pure, so that the page and the tests read the requests the same way: the tab keeps a `RequestWatch` and gives it back with each read, and nothing is stored anywhere.
 */

/** How many toasts one read raises at most: sonner shows three at a time, so a burst of requests is told by the newest, and one more toast counts the rest. */
export const REQUEST_TOASTS_MAX = 3

/** What a tab remembers of the requests it read, for as long as it is open. */
export type RequestWatch = {
  /** Every request this tab has seen, so that none is told twice. Null until the first read, which tells nothing. */
  seen: ReadonlySet<string> | null
  /** The requests that waited at the last read: the toast of one that is not there any more (it was answered, in the panel or on another device, or taken back) is out of date. */
  waiting: ReadonlySet<string>
}

/** Nothing read yet: a new tab, or a tab that now shows another account. */
export const NO_WATCH: RequestWatch = { seen: null, waiting: new Set() }

/**
 * What names a request: who it comes from (their handle, whatever the case of the nickname) and the moment it was sent, so that the same person asking again after they took a request back is a new request, and the same request read again is the one that was told.
 * Never an account's id: nothing of the kind reaches the browser.
 */
export const requestKey = (entry: Pick<RequestEntry, "nickname" | "tag" | "at">): string => `${personKey(entry)}@${entry.at}`

/** The id of the toast of a request: one toast for each, so that a toast raised again is the same one and not another. */
export const requestToastId = (key: string): string => `friend-request:${key}`

/** What one read says to do about the toasts of the requests that came in. */
export type RequestNews = {
  /** The requests to tell one by one, the oldest first, so that the newest is the one in front. */
  tell: RequestEntry[]
  /** How many came in that are not told one by one (a burst): one toast counts them. */
  more: number
  /** The keys of the requests that were told and are not waiting any more: their toasts are out of date. */
  gone: string[]
  /** What the tab remembers from now on. */
  watch: RequestWatch
}

/**
 * Reads the requests that wait for the member's answer and says what is new. The first read of a tab (`watch.seen` null) only remembers them; each read after it tells the requests that were not there before, never one that was seen once (a request that goes and
 * comes back is the same one), and says which toasts are out of date. With more new requests than `REQUEST_TOASTS_MAX` the newest are told and the others only counted (`more`).
 */
export function watchRequests(watch: RequestWatch, incoming: readonly RequestEntry[]): RequestNews {
  const keys = incoming.map(requestKey)
  const waiting = new Set(keys)
  if (watch.seen === null) return { tell: [], more: 0, gone: [], watch: { seen: new Set(keys), waiting } }

  const known = watch.seen
  const fresh = incoming
    .filter((entry, index) => !known.has(keys[index]) && keys.indexOf(keys[index]) === index)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const burst = fresh.length > REQUEST_TOASTS_MAX
  const tell = burst ? fresh.slice(fresh.length - (REQUEST_TOASTS_MAX - 1)) : fresh
  return {
    tell,
    more: fresh.length - tell.length,
    gone: [...watch.waiting].filter((key) => !waiting.has(key)),
    watch: { seen: new Set([...known, ...keys]), waiting },
  }
}

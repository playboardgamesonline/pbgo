import { personKey } from "./friends-view"
import { youLeadGroup, type GroupEntry } from "./groups"

/**
 * When a toast tells a member what changed in their group (PLT-23): somebody joined, somebody left, or the group is over. The browser reads the social state every 20 s (`social-sync.ts`), and the group is read with it, so what a tab can tell is what changed between two
 * reads. The first read of a tab tells nothing (it has no "before"). The read in which the member gets a group says how (`entered`): a member whose invitation was accepted leads the group that it made, and is told who joined; a member who is not the leader was let in (they asked,
 * or they accepted an invitation themselves, which the page knows and tells in its own toast). The same shape as the invitations' (`invitation-toasts.ts`): pure, so that the page and the tests read the group the same way; the tab keeps a `GroupWatch` and gives it back with
 * each read, and nothing is stored anywhere. Who is told is by nickname only: the tags are not in the sentences, and nothing is said of why somebody left (they left, or they were removed, or the member who removed them is not told either).
 */

/** What a tab remembers of the group it read, for as long as it is open. */
export type GroupWatch = {
  /** Whether this tab has read the group at least once: the first read tells nothing. */
  read: boolean
  /** Whether the member was in a group at the last read. */
  had: boolean
  /** The other members at the last read, by their handle's key, with their nickname. */
  others: ReadonlyMap<string, string>
}

/** Nothing read yet: a new tab, or a tab that now shows another account. */
export const NO_GROUP_WATCH: GroupWatch = { read: false, had: false, others: new Map() }

export type GroupNews = {
  /** The nicknames of the members who joined the group since the last read, in the order the group lists them: when the member's own invitation made the group (`entered` is `host`), all the others. */
  joined: string[]
  /** The nicknames of the members who are not in the group any more since the last read. */
  left: string[]
  /** The member was in a group and is in none now: it was left (by them, which the page knows, or by the others), removed from, or it went with its second-to-last member. */
  ended: boolean
  /** The member has a group now and had none at the last read: `host` when they lead it (a friend accepted their invitation: it was made for them), `guest` when they do not (they were let in after asking, or accepted an invitation themselves). */
  entered: "host" | "guest" | null
  /** What the tab remembers from now on. */
  watch: GroupWatch
}

const othersOf = (group: GroupEntry | null): Map<string, string> => new Map((group?.members ?? []).filter((member) => !member.you).map((member) => [personKey(member), member.nickname]))

/** Reads the member's group and says what changed in it since the last read. */
export function watchGroup(watch: GroupWatch, group: GroupEntry | null): GroupNews {
  const others = othersOf(group)
  const next: GroupWatch = { read: true, had: group !== null, others }
  if (!watch.read) return { joined: [], left: [], ended: false, entered: null, watch: next }
  if (!watch.had) {
    if (group === null) return { joined: [], left: [], ended: false, entered: null, watch: next }
    const host = youLeadGroup(group)
    return { joined: host ? [...others.values()] : [], left: [], ended: false, entered: host ? "host" : "guest", watch: next }
  }
  if (group === null) return { joined: [], left: [], ended: true, entered: null, watch: next }
  return {
    joined: [...others].filter(([key]) => !watch.others.has(key)).map(([, nickname]) => nickname),
    left: [...watch.others].filter(([key]) => !others.has(key)).map(([, nickname]) => nickname),
    ended: false,
    entered: null,
    watch: next,
  }
}

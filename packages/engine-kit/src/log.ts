/**
 * A game's log with who may read what. Some things that happen are private: the card a Priest shows, the three cards a player
 * looks at with See the Future. The others know *that* it happened, not what it was.
 *
 * An entry holds the event twice at most: the whole of it for the players it concerns, and a `masked` version for everybody
 * else. The log is never part of the state (lean state, PLT-45: the platform keeps what happened, the state only what the next
 * move needs), so these functions only filter; they work on entries wherever they are kept.
 */

/**
 * One thing that happened. `event` and `masked` are plain data (ids and numbers, never display text): the client turns them into
 * sentences in the viewer's language.
 */
export type LogEntry<E> = {
  /** What happened, in full. */
  event: E
  /** The players who see `event` in full; absent: everybody, spectators included. */
  to?: readonly string[]
  /** What everyone else sees instead (`{ kind: "peek", seat: 2 }` for `{ kind: "peek", seat: 2, cards: [4, 9, 12] }`); absent: nothing. */
  masked?: E
}

/**
 * The log as `viewerId` reads it, oldest first: the full event when it is public or addressed to them, else its `masked` version,
 * else nothing. `null` is a spectator: they only see public and masked events.
 */
export function viewLog<E>(entries: readonly LogEntry<E>[], viewerId: string | null): E[] {
  const seen: E[] = []
  for (const entry of entries) {
    if (entry.to === undefined || (viewerId !== null && entry.to.includes(viewerId))) seen.push(entry.event)
    else if (entry.masked !== undefined) seen.push(entry.masked)
  }
  return seen
}

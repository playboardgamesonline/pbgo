/**
 * Takeover: pure logic (no Next, no Supabase), shared by the takeover route and `publicGame`, tested in `takeover.test.ts`.
 *
 * When the game waits for players who don't play (`waitingPlayers` of the engine-kit), the others vote to play for them.
 * A vote is a pair `(voter, target)`, stored in `games.takeover_votes` as `<state fingerprint>:<voter>:<target>`: every move
 * changes the state, so its fingerprint, and the votes of the previous state are ignored without having to purge them.
 * Player ids must not contain `:` (they are UUIDs).
 *
 * A target is played for once every voter required for it has voted for it. The voters required for a target are the PRESENT
 * players (seen by the server in the last 75 s) other than the target itself: an absent player never blocks the vote.
 * Presence is the per-player last-seen time (`games.seen`), written by `server/presence.ts`.
 */

import type { TakeoverStatus } from "../lib/game-types"

export type { TakeoverStatus }

/** A member counts as present when the server saw them less than this long ago (a hidden tab refreshes about once a minute) */
export const PRESENCE_WINDOW_MS = 75_000

/** The server writes a player's last-seen time at most this often, so reads don't turn into writes */
export const SEEN_WRITE_EVERY_MS = 15_000

/** Taken off the inactivity delay (`turnTimeout`): the clock of the player who votes and the server's differ by a little */
export const STALL_GRACE_MS = 2_000

type Seat = { id: string }

type Seen = Readonly<Record<string, string>> | null | undefined

export type TakeoverVote = { voter: string; target: string }

export class TakeoverError extends Error {
  constructor(
    /** `NOT_STALLED`: nobody to play for (they played in the meantime, or the only target is the voter) · `UNKNOWN_PLAYER`: the voter is not at the table */
    public code: "NOT_STALLED" | "UNKNOWN_PLAYER",
  ) {
    super(code)
  }
}

/** Members seen by the server in the last `PRESENCE_WINDOW_MS`, in seat order. `seen` maps a player id to an ISO time. */
export function presentPlayers(players: readonly Seat[], seen: Seen, now: number): string[] {
  const present: string[] = []
  for (const { id } of players) {
    const at = Date.parse(seen?.[id] ?? "")
    if (!Number.isNaN(at) && now - at <= PRESENCE_WINDOW_MS) present.push(id)
  }
  return present
}

/** True when the stored last-seen time of a player is missing or old enough that the server should write it again (`SEEN_WRITE_EVERY_MS`). */
export function seenNeedsWrite(stored: string | undefined, now: number): boolean {
  const at = Date.parse(stored ?? "")
  return Number.isNaN(at) || now - at >= SEEN_WRITE_EVERY_MS
}

/** True when the game has not moved (`updated_at`) for `turnTimeout` seconds, less the grace. A table without a readable time counts as stalled. */
export function isStalled(updatedAt: string | null | undefined, now: number, turnTimeout: number): boolean {
  const at = Date.parse(updatedAt ?? "")
  return Number.isNaN(at) || now - at >= turnTimeout * 1000 - STALL_GRACE_MS
}

/** True when `next` is exactly what is stored, so the votes need no write. */
export function sameVotes(next: readonly string[], stored: readonly string[] | null | undefined): boolean {
  const current = stored ?? []
  return next.length === current.length && next.every((entry, index) => entry === current[index])
}

/** Votes cast for the current state (`fingerprint`). Stale votes and the old `<fingerprint>:<voter>` format are ignored. */
export function parseVotes(entries: readonly string[] | null | undefined, fingerprint: string): TakeoverVote[] {
  const votes: TakeoverVote[] = []
  for (const entry of entries ?? []) {
    const [key, voter, target, ...rest] = entry.split(":")
    if (key !== fingerprint || !voter || !target || rest.length) continue
    if (!votes.some((vote) => vote.voter === voter && vote.target === target)) votes.push({ voter, target })
  }
  return votes
}

export const voteEntry = (fingerprint: string, { voter, target }: TakeoverVote) => `${fingerprint}:${voter}:${target}`

/** The players who have to agree before the others play for `target`: the present players other than `target`, in seat order. */
function requiredVoters(players: readonly Seat[], present: readonly string[], target: string): string[] {
  return players.filter(({ id }) => id !== target && present.includes(id)).map(({ id }) => id)
}

/**
 * The takeover of each player the game waits for, in the order of `waiting`. `votes` are the votes of the current state
 * (`parseVotes`), `present` the present players (`presentPlayers`, plus the viewer when they are at the table).
 */
export function takeoverStatus({
  players,
  waiting,
  present,
  votes,
}: {
  players: readonly Seat[]
  waiting: readonly string[]
  present: readonly string[]
  votes: readonly TakeoverVote[]
}): TakeoverStatus[] {
  return waiting.map((playerId) => {
    const voters = requiredVoters(players, present, playerId)
    return { playerId, voters, votes: voters.filter((voter) => votes.some((vote) => vote.voter === voter && vote.target === playerId)) }
  })
}

/**
 * What every viewer of the table is shown about the takeover (`PublicGame.present` and `.takeovers`): who is present, and where
 * the takeover of each waiting player stands. The viewer counts as present when they are at the table: their request is
 * being served right now, `markSeen` only records it after the response.
 */
export function publicTakeover({
  players,
  seen,
  viewer,
  waiting,
  entries,
  fingerprint,
  now,
}: {
  players: readonly Seat[]
  seen: Seen
  viewer: string | null
  /** Players the game waits for now (`waitingPlayers`), none outside a game in progress */
  waiting: readonly string[]
  entries: readonly string[] | null | undefined
  fingerprint: string
  now: number
}): { present: string[]; takeovers: TakeoverStatus[] } {
  const here = viewer && players.some(({ id }) => id === viewer) ? { ...seen, [viewer]: new Date(now).toISOString() } : seen
  const present = presentPlayers(players, here, now)
  return { present, takeovers: takeoverStatus({ players, waiting, present, votes: parseVotes(entries, fingerprint) }) }
}

/**
 * Records the votes of `voter` for `targets` and tells whom to play for now: the targets whose required voters have all voted,
 * in the order of `waiting`. The voter always counts as present. Casting again a vote that exists is allowed and still checks
 * the targets, so a repeat completes a vote left unfinished by a voter who has since left.
 *
 * `entries` is the new content of `takeover_votes`: the votes of the current state only (stale and old-format ones dropped).
 * Throws `TakeoverError`: `UNKNOWN_PLAYER` when the voter is not at the table, `NOT_STALLED` when none of the targets is a
 * player the game waits for, other than the voter.
 */
export function castVotes({
  players,
  waiting,
  present,
  entries,
  fingerprint,
  voter,
  targets,
}: {
  players: readonly Seat[]
  /** Players the game waits for now (`waitingPlayers`) */
  waiting: readonly string[]
  present: readonly string[]
  /** Stored votes (`takeover_votes`) */
  entries: readonly string[] | null | undefined
  fingerprint: string
  voter: string
  targets: readonly string[]
}): { entries: string[]; play: string[] } {
  if (!players.some(({ id }) => id === voter)) throw new TakeoverError("UNKNOWN_PLAYER")
  const wanted = waiting.filter((id) => id !== voter && targets.includes(id))
  if (!wanted.length) throw new TakeoverError("NOT_STALLED")

  const votes = parseVotes(entries, fingerprint)
  for (const target of wanted) {
    if (!votes.some((vote) => vote.voter === voter && vote.target === target)) votes.push({ voter, target })
  }
  const here = present.includes(voter) ? present : [...present, voter]
  const play = wanted.filter((target) =>
    requiredVoters(players, here, target).every((id) => votes.some((vote) => vote.voter === id && vote.target === target)),
  )
  return { entries: votes.map((vote) => voteEntry(fingerprint, vote)), play }
}

// What a table of a game is made of for `@pbgo/ui/platform/table-card`: its seats, and the few words said of it (who is at it, how long ago it was opened, what a visitor may do there). No React in
// this file, so that it is tested as it is. The hub's page works these out from its rows (`apps/web/src/lib/game-activity-props.ts`) and the card draws what it is given.

import type { Rank } from "./ranks"

/**
 * What a player has done in a game, as the card that opens on their picture says it: their rank and how many of their games they won. The rating that the rank comes from is not here, nor in any type the browser gets: it stays on
 * the server.
 */
export type PlayerRecord = { rank: Rank; gamesPlayed: number; wins: number }

/**
 * The person in a seat, as the table draws them: a name and the tag that tells two players of one name apart (null for a guest), a picture when they have one (the initials of the name otherwise), whether they opened the table, and their
 * record in the game, which their card says (null for a guest, and for an account that has not played the game ranked). `href` is where their profile is, which their card leads to: an account has one, a guest has none.
 */
export type SeatedPlayer = { name: string; tag?: string | null; avatarUrl?: string | null; host?: boolean; record?: PlayerRecord | null; href?: string | null }

/** A seat of a table: who sits in it, or `null` when it is free. */
export type TableSeat = SeatedPlayer | null

/** What a table is doing: it waits for players, or it is being played. */
export type TableState = "waiting" | "playing"

/** What a visitor may do at a table: sit down (`join`), or nothing because it is `full`. A table that is played has no way in: no game lets anyone look on for now. */
export type TableAction = "join" | "full"

/** How fast a table is played, the speed of the game (`tables.turn_timer`): no clock (`none`), a clock on every turn, long (`slow`), usual (`normal`) or short (`fast`), or a day or more for each turn (`async`). */
export type Pace = "none" | "slow" | "normal" | "fast" | "async"

/** Every pace, with the words that name it, in the order of a setting: from no clock to the shortest. */
export const PACES: readonly { value: Pace; label: string }[] = [
  { value: "none", label: "No timer" },
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
  { value: "async", label: "Async" },
]

/** The paces a lobby offers to the visitor who sets it, in that order: a table that is played a day a turn (`async`) is not one of them, and is still read as what it is. */
export const SPEEDS: readonly Pace[] = ["none", "slow", "normal", "fast"]

/** The most seats a table is drawn with: three rows of five. */
export const MAX_SEATS = 15

/**
 * How many players a lobby may be set for: from the game's least to its most, and never more than the seats a table is drawn with. A game that says no most ("3 or more") goes up to the seats there are, one that says
 * nothing at all is for two and more, and a most under the least is the least.
 */
export function playerRange(min: number | null, max: number | null): { min: number; max: number } {
  const least = Math.min(MAX_SEATS, Math.max(1, min ?? 2))
  return { min: least, max: Math.min(MAX_SEATS, Math.max(least, max ?? MAX_SEATS)) }
}

/**
 * How many players a table is set for when nobody picked: the median of the game's range, the value in the middle of `min`..`max`. When the range holds an even number of counts (2 to 5: 2, 3, 4, 5) there is no single middle one and the lower
 * of the two is taken (3), so a table that is opened without a choice is the one that fills first, never above the middle. 2-4 is 3, 2-5 is 3, 2-6 is 4, 2-8 is 5, 1-4 is 2, and a game that takes one count (4-4) is that count. It is the one place that
 * decides it: the space that opens a table (the game's page, the home), the seats a table is created with when none are given and the search of Find a game all read it, in the browser and on the server. `max` under `min` is `min`. A table is for more than one player, so a game that takes one player or two (1-2) is two, and only a game that takes no more than one (1-1) is one.
 */
export const defaultSeats = (min: number, max: number): number => {
  const most = Math.max(min, max)
  return Math.max(Math.min(2, most), Math.floor((min + most) / 2))
}

/**
 * The seats of a table set for `count` players: the people who sit, in their order, then free seats up to the count. Nobody is dropped to fit a count that is under the people who sit, so a table is never drawn with fewer
 * seats than it has players.
 */
export function fitSeats(seats: readonly TableSeat[], count: number): TableSeat[] {
  const seated = seats.filter((seat): seat is SeatedPlayer => seat !== null)
  return Array.from({ length: Math.max(count, seated.length) }, (_, index) => seated[index] ?? null)
}

/** A player of a table as the platform keeps them: the seat they took, the name they sat down with (null once they have deleted their account), its tag, their picture, whether they opened the table, and their record in the game. */
export type SeatClaim = { seat: number; name: string | null; tag?: string | null; avatarUrl?: string | null; host?: boolean; record?: PlayerRecord | null; href?: string | null }

/** What a player who deleted their account is called at the tables they sat at. */
export const DELETED_PLAYER = "Deleted player"

/**
 * The seats of a table, in order: a player in the seat they took, `null` in every seat nobody took, as many as the table has. A player whose seat is not one of the table's, or is taken by another, goes to the first
 * seat that is free, so that nobody sitting at a table is left out of it; one too many for the table (which the platform does not allow) is left out.
 */
export function seatsOf(players: readonly SeatClaim[], seatsMax: number): TableSeat[] {
  const seats: TableSeat[] = Array.from({ length: Math.max(0, seatsMax) }, () => null)
  const misplaced: SeatedPlayer[] = []
  for (const { seat, name, tag, avatarUrl, host, record, href } of [...players].sort((a, b) => a.seat - b.seat)) {
    const player: SeatedPlayer = { name: name ?? DELETED_PLAYER, tag, avatarUrl, host, record, href }
    if (seats[seat] === null) seats[seat] = player
    else misplaced.push(player)
  }
  for (const player of misplaced) {
    const free = seats.indexOf(null)
    if (free >= 0) seats[free] = player
  }
  return seats
}

/** How many seats are taken, how many the table has, and how many are left. */
export function seatCount(seats: readonly TableSeat[]): { taken: number; total: number; free: number } {
  const taken = seats.filter((seat) => seat !== null).length
  return { taken, total: seats.length, free: seats.length - taken }
}

/** The name of the person who opened a table, the host among its seats: null when there is none (they deleted their account, or nobody sits). */
export function hostOf(seats: readonly TableSeat[]): string | null {
  return seats.find((seat) => seat?.host)?.name ?? null
}

/** The name a player goes by, without the `#0042` after it that tells two players of one name apart ("Alex#0042" is "Alex"). A guest has no tag, so their name stays as it is. */
export const nicknameOf = (displayName: string): string => displayName.replace(/#\d{1,4}$/, "")

/** The tag that follows a nickname ("0042" for "Alex#0042"), or null when there is none, as for a guest. */
export const tagOf = (displayName: string): string | null => /#(\d{1,4})$/.exec(displayName)?.[1] ?? null

/** The people at a table in one line: up to three by name, then "and N others" ("Alex", "Alex and Sam", "Alex, Sam and Robin", "Alex, Sam and 3 others"). Nothing for a table nobody sits at. */
export function namesOf(seats: readonly TableSeat[]): string {
  const names = seats.flatMap((seat) => (seat ? [seat.name] : []))
  if (names.length > 3) return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "")
}

/** What a visitor may do at a table: sit down at one that waits and has a seat free, and nothing at one that waits and is full (it is about to start) or at one that is played, since nobody looks on at a game for now. */
export function tableAction(state: TableState, free: number): TableAction | null {
  if (state === "waiting") return free > 0 ? "join" : "full"
  return null
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A stretch of time in the one unit that fits: "4 min", "2 h 05", "3 d". */
export function lasted(ms: number): string {
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min`
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ${String(Math.floor((ms % HOUR) / MINUTE)).padStart(2, "0")}`
  return `${Math.floor(ms / DAY)} d`
}

/**
 * How old a table is, in the words of its state: when a table that waits was opened ("Opened just now", "Opened 4 min ago"), how long one that is played has been ("Just started", "Playing for 18 min"). `since` is an ISO
 * date, `now` is a parameter so that it is tested; a date that does not read, or one in the future, counts as now.
 */
export function ageOf(state: TableState, since: string, now: number = Date.now()): string {
  const ms = Math.max(0, now - Date.parse(since)) || 0
  if (state === "waiting") return ms < MINUTE ? "Opened just now" : `Opened ${lasted(ms)} ago`
  return ms < MINUTE ? "Just started" : `Playing for ${lasted(ms)}`
}

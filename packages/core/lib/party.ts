// The start of a group's game from the home (PLT-141), pure, so that the browser and the server read it the same way and it is tested as it is. The leader of a group presses "Start game" in Custom: the game's own route opens a private table for the people of the group
// (`settings.party`, `lib/table-settings.ts`), the leader stays on the home, and each member's own tab sits down at it by itself (a seat is the secret of the browser's own cookie, so only that browser can take it). The table is the only state: both sides ask the server for "the
// table of my group" (`GET /api/hub/groups/table`, `server/party.ts`) while they are in a group, so a reload, a second tab or a member who joins late all see the same thing. The join that takes the last seat begins the table's ready check, and everybody
// seated is taken to its board, where each says they are there.

/** Where a member's browser asks for the table that its group's leader opened for the group. */
export const PARTY_PATH = "/api/hub/groups/table"

/** How often a tab in a group asks for it, and how often a tab that waits at it reads where it stands: a start has to reach everybody in a few seconds, and the presence beat (every 15 s at a lobby) stays the fallback. */
export const PARTY_POLL_MS = 3_000

/** How long the leader waits for the group before the button to start with the people who came is offered, in seconds: a member who never comes must not hang the leader. */
export const PARTY_START_AFTER_SECONDS = 60

/** How long a table opened for a group is waited for, in seconds: one that has waited longer was forgotten (its leader went away), and is no group's table any more. */
export const PARTY_TABLE_TTL_SECONDS = 30 * 60

/** The table a group's leader opened for it: the game and its code, where it stands (the lobby waits for the group, then the table is in its ready check), how many seats it has and how many are taken, whether the visitor sits at it and is the leader who opened it, and how long it has waited. */
export type PartyTable = {
  game: string
  code: string
  status: "lobby" | "starting"
  seats: number
  seated: number
  /** Whether the visitor sits at it. */
  you: boolean
  /** Whether the visitor is the leader who opened it. */
  host: boolean
  /** How long it has waited, in whole seconds, as the server counted when it answered (a duration, not a date: a clock that is off does not matter). */
  waited: number
}

/** What the route answers: the table of the visitor's group, null when it has none. */
export type PartyAnswer = { table: PartyTable | null }

const isCount = (value: unknown, least: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= least

/** The table that the wire says, or null: a browser never acts on what the server did not mean to send. */
export function partyTableOf(value: unknown): PartyTable | null {
  if (typeof value !== "object" || value === null) return null
  const { game, code, status, seats, seated, you, host, waited } = value as Record<string, unknown>
  if (typeof game !== "string" || game === "" || typeof code !== "string" || code === "") return null
  if (status !== "lobby" && status !== "starting") return null
  if (!isCount(seats, 1) || !isCount(seated, 0) || typeof you !== "boolean" || typeof host !== "boolean" || !isCount(waited, 0)) return null
  return { game, code, status, seats, seated, you, host, waited }
}

/** The answer of the route, read: its table, or none for anything else. */
export const partyAnswerOf = (body: unknown): PartyTable | null => (typeof body === "object" && body !== null ? partyTableOf((body as Record<string, unknown>).table) : null)

/** The key that tells one table from another, for what a tab remembers it did about it. */
export const partyKey = (table: Pick<PartyTable, "game" | "code">): string => `${table.game}:${table.code}`

/**
 * What a tab does about the table of its group, from where the table stands and which tables it has tried already:
 * - `enter`: the table is in its ready check and the visitor sits at it: take them to its board, where everybody says they are there;
 * - `wait`: it waits for the group and they sit at it (the leader, or a member who sat down): ask again soon;
 * - `join`: it waits and they do not sit at it, and this tab has not tried it: sit them down with the game's own join route (a table that was tried, and refused, is never tried again: the member was told why);
 * - `none`: nothing to do (no table, or one that began without them).
 */
export type PartyStep = "enter" | "wait" | "join" | "none"

export function partyStep(table: PartyTable | null, tried: ReadonlySet<string>): PartyStep {
  if (!table) return "none"
  if (table.status === "starting") return table.you ? "enter" : "none"
  if (table.you) return "wait"
  return !table.host && !tried.has(partyKey(table)) ? "join" : "none"
}

/**
 * Whether the table that a member sat at, in its lobby, is gone when their tab reads again: its leader cancelled it, or it was forgotten. Only for two reads that follow one another (`gapMs` is the time between them): a tab that was away cannot tell a table that began and was
 * played from one that was cancelled, so it says nothing.
 */
export function partyEnded(before: PartyTable | null, after: PartyTable | null, gapMs: number): boolean {
  return before !== null && before.you && !before.host && before.status === "lobby" && after === null && gapMs <= PARTY_POLL_MS * 3
}

/**
 * Whether the leader may start with the people who are seated, and with how many. After a wait: the table has waited a minute, is not full and has at least what the game needs (two, even for a game that takes one: a ready check of one is not what the group asked for); the people
 * who have not come are not seated when it begins. A table that is full begins by itself, so one that is full and still waits could not (somebody at it is in a game, or a seat changed): its leader may start it at once, and the host's own start tells them why when it cannot.
 */
export function startableWith(table: PartyTable, least: number): number | null {
  if (!table.host || table.status !== "lobby") return null
  if (table.seated >= table.seats) return table.seated >= 2 ? table.seated : null
  if (table.waited < PARTY_START_AFTER_SECONDS) return null
  return table.seated >= Math.max(least, 2) ? table.seated : null
}

/** What the wait says: who is awaited, and how many of the seats are taken. */
export const partyWaitText = (table: Pick<PartyTable, "seated" | "seats">): { label: string; count: string } => ({ label: "Waiting for the group", count: `${table.seated}/${table.seats}` })

/** The wait as a sentence, for the line beside the button of a member who sits at the table already: "Waiting for the group, 2/3." */
export function partyWaitLine(table: Pick<PartyTable, "seated" | "seats">): string {
  const { label, count } = partyWaitText(table)
  return `${label}, ${count}.`
}

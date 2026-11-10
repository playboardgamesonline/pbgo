import { baseLanguageOf, isPlatformLanguage, type PlatformLanguage } from "@pbgo/accounts/language"
import { TIERS, type Rank, type Tier } from "@pbgo/ui/ranks"
import { MAX_SEATS, PACES, SPEEDS, type Pace } from "@pbgo/ui/tables"

// The settings of a table (PLT-21, phase B): who may join it, how fast it is played and how many seats it has. A table is a row of `games`, whose columns are the engine's; the host's choices at the top of the lobby's panel are one object kept next to it
// (`games.settings`, migration 0014), which only the server writes, from the create route and from `POST …/settings`, and which these functions read and check. It is kept sparse: a key is there only when it was set, and a table with none is a private table
// of the game's own speed and seats, as every table was before. Only a **public** table asks for something (a minimum rank, a language): a private one is reached by its link alone. Pure, so that the server, the page and the tests read it the same way.

/** Who may find a table: a `public` one is listed with the open tables of its game, a `private` one is reached by its link. */
export type Visibility = "public" | "private"

export const VISIBILITIES: readonly Visibility[] = ["public", "private"]

/** The ranks a table may ask for. The lowest tier is every player's (a guest and a player who never played the game ranked have it), so asking for it asks for nothing and the panel does not offer it. */
export const ASKABLE_TIERS: readonly Tier[] = TIERS.slice(1)

/** What a table keeps of its settings, as the database holds it: a key only where the host set it. */
export type TableSettings = {
  visibility?: Visibility
  /** The least rank a player must have in the game to sit at a public table. */
  minRank?: Tier
  /** The language a public table's players are asked to speak: a language people speak (`SPOKEN_LANGUAGES`), English once. */
  language?: PlatformLanguage
  /** How fast it is played (one of the lobby's `SPEEDS`). */
  pace?: Pace
  /** How many players it was set for, between the game's least and most. */
  seats?: number
  /** The table counts for the rank: a ranked search opened it. Members only, no helpers, and nothing in it changes once it is open (`isLocked`). */
  ranked?: boolean
  /** The tier of the member who opened a ranked table: the others sit at it while their tier is near it (`withinRankGap`). */
  anchor?: Tier
}

/** What the host sends to set a table: every setting at once, so that the server writes what the panel shows (a rank or a language that asks for nothing is `null`). */
export type TableSettingsInput = { visibility: Visibility; minRank: Tier | null; language: PlatformLanguage | null; pace: Pace; seats: number }

/** The settings as the lobby shows them: what a table that never had any shows, with what it has put over it. */
export type EffectiveSettings = { visibility: Visibility; minRank: Tier | null; language: PlatformLanguage | null; pace: Pace; seats: number }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** A language people speak, by the code the lobby offers: the base form of a platform language (English (UK) is a form of English and a table asks for English). */
const isSpoken = (value: unknown): value is PlatformLanguage => isPlatformLanguage(value) && baseLanguageOf(value) === value

const isPace = (value: unknown): value is Pace => PACES.some((pace) => pace.value === value)

/** What a row of `games` holds as its settings, kept to what is valid: a key that is not one of ours, or a value that is not one of its kind, is left out, so that a value written by hand or by another version of the site cannot reach a page. */
export function parseTableSettings(raw: unknown): TableSettings {
  if (!isRecord(raw)) return {}
  const settings: TableSettings = {}
  if (raw.visibility === "public" || raw.visibility === "private") settings.visibility = raw.visibility
  if (typeof raw.minRank === "string" && (ASKABLE_TIERS as readonly string[]).includes(raw.minRank)) settings.minRank = raw.minRank as Tier
  if (isSpoken(raw.language)) settings.language = raw.language
  if (isPace(raw.pace)) settings.pace = raw.pace
  if (typeof raw.seats === "number" && Number.isInteger(raw.seats) && raw.seats >= 1 && raw.seats <= MAX_SEATS) settings.seats = raw.seats
  if (raw.ranked === true) settings.ranked = true
  if (typeof raw.anchor === "string" && (TIERS as readonly string[]).includes(raw.anchor)) settings.anchor = raw.anchor as Tier
  return settings
}

/** How a table counts: `ranked` for the rank, `normal` for playing. A table that kept no setting is a normal one. */
export const modeOf = (settings: Pick<TableSettings, "ranked">): "normal" | "ranked" => (settings.ranked === true ? "ranked" : "normal")

/** A ranked table is fixed: who may join, the speed, the seats and the options are not changed, and its host cannot start it before it is full. */
export const isLocked = (settings: Pick<TableSettings, "ranked">): boolean => settings.ranked === true

/** How many players a table that a search opens is set for: the value between the game's least and most (the lower one when there is none in the middle). */
export const defaultSeats = (min: number, max: number): number => Math.floor((Math.min(min, max) + max) / 2)

/** How many tiers apart a player may be from the one who opened a ranked table, when it has just opened, and how long the table waits before it takes one more. */
export const RANK_GAP_BASE = 1
export const RANK_GAP_STEP_MS = 30_000

/** The gap in tiers that a ranked table accepts after it has waited `waitedMs`: it widens by one tier for each `RANK_GAP_STEP_MS`, so that a table nobody fits ends up taking anybody. */
export const rankGap = (waitedMs: number): number => RANK_GAP_BASE + Math.floor(Math.max(0, Number.isFinite(waitedMs) ? waitedMs : 0) / RANK_GAP_STEP_MS)

/** Whether a player of tier `tier` may sit at a ranked table opened by a player of tier `anchor` that has waited `waitedMs`. */
export const withinRankGap = (anchor: Tier, tier: Tier, waitedMs: number): boolean => Math.abs(TIERS.indexOf(anchor) - TIERS.indexOf(tier)) <= rankGap(waitedMs)

/** The least and the most players the game takes, and how many are seated now: what the number of seats of a table is checked against. */
export type SeatLimits = { min: number; max: number; seated: number }

export type SettingsCheck = { ok: true; settings: TableSettings } | { ok: false; code: "INVALID_REQUEST" | "INVALID_PLAYERS" }

const refused = (code: "INVALID_REQUEST" | "INVALID_PLAYERS"): SettingsCheck => ({ ok: false, code })

/**
 * The settings a host sends, checked: every setting is there and is one of its kind (`INVALID_REQUEST`), and the number of seats is between the game's least and most players and never under the people who sit already (`INVALID_PLAYERS`). What
 * comes back is what to keep: a rank or a language that asks for nothing is not written.
 */
export function checkTableSettings(input: unknown, { min, max, seated }: SeatLimits): SettingsCheck {
  if (!isRecord(input)) return refused("INVALID_REQUEST")
  const { visibility, minRank, language, pace, seats } = input
  if (visibility !== "public" && visibility !== "private") return refused("INVALID_REQUEST")
  if (minRank !== null && minRank !== undefined && !(typeof minRank === "string" && (ASKABLE_TIERS as readonly string[]).includes(minRank))) return refused("INVALID_REQUEST")
  if (language !== null && language !== undefined && !isSpoken(language)) return refused("INVALID_REQUEST")
  if (typeof pace !== "string" || !(SPEEDS as readonly string[]).includes(pace)) return refused("INVALID_REQUEST")
  if (typeof seats !== "number" || !Number.isInteger(seats)) return refused("INVALID_REQUEST")
  if (seats < Math.max(min, seated, 1) || seats > Math.min(max, MAX_SEATS)) return refused("INVALID_PLAYERS")
  return {
    ok: true,
    settings: {
      visibility,
      ...(minRank ? { minRank: minRank as Tier } : {}),
      ...(language ? { language: language as PlatformLanguage } : {}),
      pace: pace as Pace,
      seats,
    },
  }
}

/** The settings a table shows: its own over the defaults of a table that never had any (private, nothing asked, the usual speed, the game's most seats). */
export function effectiveSettings(settings: TableSettings, gameMax: number): EffectiveSettings {
  return {
    visibility: settings.visibility ?? "private",
    minRank: settings.minRank ?? null,
    language: settings.language ?? null,
    pace: settings.pace ?? "normal",
    seats: Math.max(1, Math.min(settings.seats ?? gameMax, gameMax)),
  }
}

/** The tier a player has in a game: their rank's, and the lowest for a player with none (a guest, a member who never played it ranked). */
export const tierOf = (rank: Pick<Rank, "tier"> | null | undefined): Tier => rank?.tier ?? TIERS[0]

/** What a visitor is, as far as the criteria of a table go: their tier in the game and the language of the platform they use. */
export type Viewer = { tier: Tier; language: PlatformLanguage }

/** What a visitor does not meet at a table: its minimum rank, its language, or, at a ranked table, the gap between their tier and the tier it opened at. */
export type Unmet = "rank" | "language" | "gap"

/**
 * Whether a visitor meets what a table asks: its minimum rank, then its language (a regional form of the language is that language: English (UK) speaks English), then, at a ranked table, that their tier is within the gap of the one it opened
 * at (`withinRankGap`, which widens with the time the table has waited: `waitedMs`). Only a public table asks for anything. Null: they meet it, or it asks for nothing.
 */
export function unmetCriteria(settings: TableSettings, viewer: Viewer, waitedMs = 0): Unmet | null {
  if (settings.visibility !== "public") return null
  if (settings.minRank && TIERS.indexOf(viewer.tier) < TIERS.indexOf(settings.minRank)) return "rank"
  if (settings.language && baseLanguageOf(viewer.language) !== settings.language) return "language"
  if (settings.ranked && settings.anchor && !withinRankGap(settings.anchor, viewer.tier, waitedMs)) return "gap"
  return null
}

/** The error code a criterion that is not met is refused with. */
export const UNMET_CODES: Record<Unmet, string> = { rank: "RANK_TOO_LOW", language: "LANGUAGE_MISMATCH", gap: "RANK_GAP" }

/** Whether a table asks for something of the people who sit at it (a public table with a rank or a language, or a ranked one, which looks at the tier of whoever sits). */
export const asksSomething = (settings: TableSettings): boolean =>
  settings.visibility === "public" && (settings.minRank !== undefined || settings.language !== undefined || settings.ranked === true)

/** What the button that says who may join reports (`LobbyAccess`): the page keeps it as it is until the table is opened or set. */
export type AccessChoice = { visibility: Visibility; minRank: Tier | null; language: string | null }

/** What the button is set to before the host touches it: a public table that asks for nothing (it is what the button's globe shows). */
export const OPEN_TO_ANYONE: AccessChoice = { visibility: "public", minRank: null, language: null }

/**
 * What the host chose before the table existed, as the create route takes it: who may join (the button at the top right of the space that opens a table), the speed and the number of players, each as the panel shows it. A rank that asks for nothing is `null`;
 * a language that is not one the lobby offers is left out (the server would refuse it); a speed the lobby does not offer is the usual one; the number of players that was not picked is the game's most, and one that is not between the game's least and most
 * is brought back to it. `range` is the game's: the table is checked against it all the same on the server (`checkTableSettings`).
 */
export function creationSettings(access: AccessChoice, pace: Pace, seats: number | null, range: { min: number; max: number }): TableSettingsInput {
  return {
    visibility: access.visibility,
    minRank: access.minRank,
    language: isSpoken(access.language) ? access.language : null,
    pace: (SPEEDS as readonly string[]).includes(pace) ? pace : "normal",
    seats: Math.min(range.max, Math.max(range.min, seats ?? range.max)),
  }
}

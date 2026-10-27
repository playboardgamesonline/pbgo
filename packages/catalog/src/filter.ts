// The search and the filters of the hub's list of games as a pure model: what a visitor typed and picked (`GameFilter`), what of a game
// is searched (`GameIndex`), which games stay (`filterGames`) and how the picks travel in the URL (`filterFromParams`, `filterToParams`).
// No I/O and no framework in this file, so that the browser (the list on the hub), the tests and Node read it as it is (docs/catalog.md).

import type { CatalogEntry } from "./catalog"

/** The last number of players the filter offers does not mean "exactly this many" but "this many or more". */
export const MANY_PLAYERS = 8

/** The numbers of players the filter offers: 1 to 7, then `MANY_PLAYERS` for "8 or more". */
export const PLAYER_COUNTS = [1, 2, 3, 4, 5, 6, 7, MANY_PLAYERS] as const

/** The durations the filter offers, in minutes: a game fits when it takes at most that long. */
export const DURATION_LIMITS = [15, 30, 45] as const

/** `all`: every game. `play`: the games to play now. `soon`: the games to come. */
export const AVAILABILITIES = ["all", "play", "soon"] as const
export type Availability = (typeof AVAILABILITIES)[number]

/** The longest search the field takes: nobody looks for a game with more than this. */
export const MAX_QUERY_LENGTH = 60

/** What a visitor typed and picked. */
export type GameFilter = {
  /** The text of the search field, as typed (spaces included: a visitor in the middle of a phrase). It stays in the page, never in the URL. */
  query: string
  availability: Availability
  /** The number of players of the table, one of `PLAYER_COUNTS`; null for any. */
  players: number | null
  /** The longest a game may take, in minutes, one of `DURATION_LIMITS`; null for any. */
  duration: number | null
}

/** Nothing typed, nothing picked: every game stays. */
export const NO_FILTER: GameFilter = { query: "", availability: "all", players: null, duration: null }

/**
 * What the filter reads of a catalog entry, and all a client component needs of it to filter the list: the page sends this to the
 * browser, not the entry (no descriptions, no pictures).
 */
export type GameIndex = {
  slug: string
  /** A game to play now (`play`) or a game to come (`soon`). */
  live: boolean
  /** What the search looks into, already normalised (`normalize`). */
  text: string
  /** `max: null` is "N or more". Null when the game does not say. */
  players: { min: number; max: number | null } | null
  /** Minutes: the longest the game takes. Null when the game does not say. */
  duration: number | null
}

// The letters that are not a letter with a mark on it (Unicode has no decomposition for them), spelled the way a keyboard without them does
const SPELLED: Record<string, string> = { œ: "oe", æ: "ae", ß: "ss", ø: "o", ł: "l" }

/**
 * A text as the search compares it: lower case and no accent ("Hervé" and "herve" are the same word), a ligature spelled out, and no
 * apostrophe, straight or curly ("Miller's" and "millers" are too: a keyboard has one, a game's name the other).
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/['’ʼ]/g, "")
    .replace(/[œæßøł]/g, (letter) => SPELLED[letter] ?? letter)
}

/** The words of a query, normalised: runs of letters and digits, anything else (spaces, punctuation) only separates them. */
export function words(query: string): string[] {
  return normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/**
 * The part of a catalog entry the filter reads. A live game is searched by its name, a planned one by its name, its authors, its
 * illustrators and its publishers (never by its descriptions: a word of a sentence is not what a visitor looks a game up by).
 * A live game gives its longest duration, so that "up to 30 min" never promises a game that can run longer.
 */
export function indexEntry(entry: CatalogEntry): GameIndex {
  if (entry.live) {
    const { name, players, duration } = entry.game
    return { slug: entry.slug, live: true, text: normalize(name), players: players ?? null, duration: duration?.max ?? null }
  }
  const { name, authors, illustrators, publishers, players, duration } = entry.game
  return {
    slug: entry.slug,
    live: false,
    text: normalize([name, ...authors, ...illustrators, ...publishers.map((publisher) => publisher.name)].join(" ")),
    players,
    duration,
  }
}

/**
 * Whether a table of `count` players can play the game: `count` is within its range, and a game with no upper limit ("3+") seats any
 * number above its lower one. `MANY_PLAYERS` is "that many or more", so it asks for a game that seats that many, whatever its lower limit.
 */
function fitsPlayers(game: GameIndex, count: number): boolean {
  if (!game.players) return false
  const { min, max } = game.players
  return (max === null || max >= count) && (count >= MANY_PLAYERS || min <= count)
}

/**
 * The games that stay for a filter, in the order they came in (the filter never sorts), each as it came in: whatever else a game
 * carries beside its index is kept. All criteria must hold. A game that does not say its players or its duration is left out as soon as
 * the filter asks for them. Every word of the query must be somewhere in the text of the game (a part of a word is enough), in any order.
 */
export function filterGames<T extends GameIndex>(games: readonly T[], filter: GameFilter): T[] {
  const terms = words(filter.query)
  return games.filter(
    (game) =>
      (filter.availability === "all" || game.live === (filter.availability === "play")) &&
      (filter.players === null || fitsPlayers(game, filter.players)) &&
      (filter.duration === null || (game.duration !== null && game.duration <= filter.duration)) &&
      terms.every((term) => game.text.includes(term)),
  )
}

/** Whether the visitor has typed or picked anything: whether there is something to clear. A query of blanks is nothing. */
export function isFiltered(filter: GameFilter): boolean {
  return filter.query.trim() !== "" || filter.availability !== "all" || filter.players !== null || filter.duration !== null
}

/** The option among `options` that the text spells exactly (no "04" for 4, no "4.0"), else null: the pick that a link or a select stands for. */
export function optionOf<T extends number | string>(options: readonly T[], value: string | null): T | null {
  return options.find((option) => String(option) === value) ?? null
}

// ---------- In the URL ----------
// The three picks, `show`, `players` and `duration`, each left out when it is the default, so that the link to the unfiltered list is the
// hub's. The typed text is not in it: the address of the page goes to analytics with every event, and what a visitor types in a field is
// theirs, so it is neither written to the URL nor read from it.

/** The picks a link holds, with no query. A value the filters do not offer is ignored, never an error: a link is anything someone typed or kept for a long time. */
export function filterFromParams(params: { get(name: string): string | null }): GameFilter {
  return {
    ...NO_FILTER,
    availability: optionOf(AVAILABILITIES, params.get("show")) ?? "all",
    players: optionOf(PLAYER_COUNTS, params.get("players")),
    duration: optionOf(DURATION_LIMITS, params.get("duration")),
  }
}

/** The parameters of the link to a filter: the picks that are set, in a fixed order, and never the query. */
export function filterToParams(filter: GameFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.availability !== "all") params.set("show", filter.availability)
  if (filter.players !== null) params.set("players", String(filter.players))
  if (filter.duration !== null) params.set("duration", String(filter.duration))
  return params
}

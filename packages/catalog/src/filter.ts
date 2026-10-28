// The search and the filters of the hub's list of games as a pure model: what a visitor typed and picked (`GameFilter`), what of a game
// is searched (`GameIndex`), which games stay (`filterGames`) and how the picks travel in the URL (`filterFromParams`, `filterToParams`).
// No I/O and no framework in this file, so that the browser (the list on the hub), the tests and Node read it as it is (docs/catalog.md).

import type { CatalogEntry } from "./catalog"

/** The last number of players the filter offers does not mean "exactly this many" but "this many or more". */
export const MANY_PLAYERS = 8

/** The numbers of players the filter offers: 1 to 7, then `MANY_PLAYERS` for "8 or more". */
export const PLAYER_COUNTS = [1, 2, 3, 4, 5, 6, 7, MANY_PLAYERS] as const

/** The durations the filter offers, in minutes: a game fits when it takes at most that long. A quarter of an hour at a time up to the hour, then half an hour. */
export const DURATION_LIMITS = [15, 30, 45, 60, 90, 120] as const

/** The ages the filter offers, in years: the age of the youngest player, so a game stays when its minimum age is at most that. */
export const AGE_LIMITS = [6, 8, 10, 12, 14] as const

/**
 * What a stepper of the search bar picks the first time it is pressed, while nothing is picked: the number it shows then, dimmed. Each one is one
 * of its options (`PLAYER_COUNTS`, `DURATION_LIMITS`, `AGE_LIMITS`): a table of three, a game of half an hour, a child of eight.
 */
export const FIRST_PICKS = { players: 3, duration: 30, age: 8 } as const

/** The longest search the field takes: nobody looks for a game with more than this. */
export const MAX_QUERY_LENGTH = 60

/** What a visitor typed and picked. */
export type GameFilter = {
  /** The text of the search field, as typed (spaces included: a visitor in the middle of a phrase). It stays in the page, never in the URL. */
  query: string
  /** The categories to keep, by name, in the order they were picked: a game stays when it has any of them. Empty for any. */
  categories: readonly string[]
  /** The number of players of the table, one of `PLAYER_COUNTS`; null for any. */
  players: number | null
  /** The longest a game may take, in minutes, one of `DURATION_LIMITS`; null for any. */
  duration: number | null
  /** The age of the youngest player, one of `AGE_LIMITS`: a game stays when its minimum age is at most that; null for any. */
  age: number | null
}

/** Nothing typed, nothing picked: every game stays. */
export const NO_FILTER: GameFilter = { query: "", categories: [], players: null, duration: null, age: null }

/**
 * What the filter reads of a catalog entry, and all a client component needs of it to filter the list: the page sends this to the
 * browser, not the entry (no descriptions, no pictures).
 */
export type GameIndex = {
  slug: string
  /** A game to play now or a game to come: no filter asks for it, but the list marks the games to play (`data-game`). */
  live: boolean
  /** What the search looks into, already normalised (`normalize`). */
  text: string
  /** `max: null` is "N or more". Null when the game does not say. */
  players: { min: number; max: number | null } | null
  /** Minutes, the one figure the game gives. Null when it does not say. */
  duration: number | null
  /** The minimum age in years. Null when the game does not say. */
  age: number | null
  /** The names of its categories (the tags of its Notion row), in the order of the row. None when it has none. */
  categories: readonly string[]
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
 * The part of a catalog entry the filter reads, the same for every game, a live one included: its name, its authors, its illustrators
 * and its publishers (never its descriptions: a word of a sentence is not what a visitor looks a game up by), then the players, the
 * duration, the minimum age and the categories, which are the ones of its Notion row (of the registry for the players and the duration
 * of a live game with no row).
 */
export function indexEntry(entry: CatalogEntry): GameIndex {
  const { name, authors, illustrators, publishers, players, duration, age, categories } = entry.game
  return {
    slug: entry.slug,
    live: entry.live,
    text: normalize([name, ...authors, ...illustrators, ...publishers.map((publisher) => publisher.name)].join(" ")),
    players,
    duration,
    age,
    categories,
  }
}

// "Bluffing" before "Co-op" before "Party", whatever the case; "2 players" before "10 players"
const NAMES = new Intl.Collator("en", { sensitivity: "base", numeric: true })

/** The categories the games have, each one once, by name: what the category filter offers. None when no game has one. */
export function categoriesOf(games: readonly Pick<GameIndex, "categories">[]): string[] {
  return [...new Set(games.flatMap((game) => game.categories))].sort(NAMES.compare)
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
 * carries beside its index is kept. All criteria must hold. A game that does not say its players, its duration or its minimum age is
 * left out as soon as the filter asks for it, and so is a game with no category when a category is picked. A game has a picked
 * category when it has any of them, spelled exactly. Every word of the query must be somewhere in the text of the game (a part of a
 * word is enough), in any order.
 */
export function filterGames<T extends GameIndex>(games: readonly T[], filter: GameFilter): T[] {
  const terms = words(filter.query)
  return games.filter(
    (game) =>
      (filter.categories.length === 0 || game.categories.some((category) => filter.categories.includes(category))) &&
      (filter.players === null || fitsPlayers(game, filter.players)) &&
      (filter.duration === null || (game.duration !== null && game.duration <= filter.duration)) &&
      (filter.age === null || (game.age !== null && game.age <= filter.age)) &&
      terms.every((term) => game.text.includes(term)),
  )
}

/** Whether the visitor has typed or picked anything: whether there is something to clear. A query of blanks is nothing. */
export function isFiltered(filter: GameFilter): boolean {
  return (
    filter.query.trim() !== "" ||
    filter.categories.length > 0 ||
    filter.players !== null ||
    filter.duration !== null ||
    filter.age !== null
  )
}

/** The option among `options` that the text spells exactly (no "04" for 4, no "4.0"), else null: the pick that a link or a chip stands for. */
export function optionOf<T extends number | string>(options: readonly T[], value: string | null): T | null {
  return options.find((option) => String(option) === value) ?? null
}

/**
 * Where a stepper goes from `current`: one place along `options` in the `direction` (1 for the next one, -1 for the one before), and it stays where
 * it is at either end. While nothing is picked (`current` is null, or is not one of the options) the first press picks `first`, whichever way it
 * goes: the stepper shows `first`, dimmed, until then, so a press picks what it shows.
 */
export function stepOption(options: readonly number[], current: number | null, direction: 1 | -1, first: number): number {
  const index = current === null ? -1 : options.indexOf(current)
  if (index === -1) return first
  return options[Math.min(options.length - 1, Math.max(0, index + direction))] ?? first
}

/** Whether a stepper can go `direction` from `current`: it always can while nothing is picked, then until the last option, or the first. */
export function canStep(options: readonly number[], current: number | null, direction: 1 | -1): boolean {
  const index = current === null ? -1 : options.indexOf(current)
  if (index === -1) return true
  const next = index + direction
  return next >= 0 && next < options.length
}

// ---------- In the URL ----------
// The picks, `category` (once for each category), `players`, `duration` and `age`, each left out when it is the default, so that the link
// to the unfiltered list is the hub's. The typed text is not in it: the address of the page goes to analytics with every event, and what
// a visitor types in a field is theirs, so it is neither written to the URL nor read from it.

/**
 * The picks a link holds, with no query. `offered` are the categories the filter offers (`categoriesOf`): a value the filters do not
 * offer, a category no game has included, is ignored, never an error, since a link is anything someone typed or kept for a long time.
 * The categories keep the order of the link, each one once.
 */
export function filterFromParams(
  params: { get(name: string): string | null; getAll(name: string): string[] },
  offered: readonly string[],
): GameFilter {
  return {
    ...NO_FILTER,
    categories: [...new Set(params.getAll("category"))].filter((category) => offered.includes(category)),
    players: optionOf(PLAYER_COUNTS, params.get("players")),
    duration: optionOf(DURATION_LIMITS, params.get("duration")),
    age: optionOf(AGE_LIMITS, params.get("age")),
  }
}

/** The parameters of the link to a filter: the picks that are set, in a fixed order, and never the query. */
export function filterToParams(filter: GameFilter): URLSearchParams {
  const params = new URLSearchParams()
  for (const category of filter.categories) params.append("category", category)
  if (filter.players !== null) params.set("players", String(filter.players))
  if (filter.duration !== null) params.set("duration", String(filter.duration))
  if (filter.age !== null) params.set("age", String(filter.age))
  return params
}

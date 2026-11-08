// The search, the filters and the order of the hub's list of games as a pure model: what a visitor typed and picked (`GameFilter`), what of a game
// is searched and sorted (`GameIndex`), which games stay (`filterGames`), in which order they are listed (`sortGames`) and how the picks and the
// order travel in the URL (`filterFromParams`, `filterToParams`, `sortFromParams`, `sortToParams`).
// No I/O and no framework in this file, so that the browser (the list on the hub), the tests and Node read it as it is (docs/catalog.md).

import type { CatalogEntry } from "./catalog"

/** The last number of players the filter offers does not mean "exactly this many" but "this many or more". */
export const MANY_PLAYERS = 8

/** The numbers of players the filter offers: 1 to 7, then `MANY_PLAYERS` for "8 or more". */
export const PLAYER_COUNTS = [1, 2, 3, 4, 5, 6, 7, MANY_PLAYERS] as const

/**
 * The durations the filter offers, in minutes, five at a time: a game stays when it takes at most that long. They are the first eleven steps of a
 * slider whose twelfth, "1h+", is no limit at all (`null`): the games of an hour or more stay only there.
 */
export const DURATION_LIMITS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const

/**
 * The levels of the complexity filter, from light (1) to heavy (5): the scale of the weight that BoardGameGeek gives a game, in whole levels. A game
 * is at the level its weight rounds to (`complexityLevel`).
 */
export const COMPLEXITY_LEVELS = [1, 2, 3, 4, 5] as const

/** The ages the filter offers, in years, written "8+" (from 8 years old): the age of the youngest player, so a game stays when its minimum age is at most that. */
export const AGE_LIMITS = [6, 8, 10, 12, 14, 18] as const

/** Where the number of players starts: a table of four. One of `PLAYER_COUNTS`. */
export const DEFAULT_PLAYERS = 4

/** Where the age starts: the youngest player is 8 years old, "8+". One of `AGE_LIMITS`. */
export const DEFAULT_AGE = 8

/** Where the duration starts: games that take 20 minutes at most, "20′". One of `DURATION_LIMITS`. */
export const DEFAULT_DURATION = 20

/** Where the complexity starts: up to level 3 of 5, medium. One of `COMPLEXITY_LEVELS`; the bars never go below level 1. */
export const DEFAULT_COMPLEXITY = 3

/** What a link writes for the last step of the duration slider, "1h+", which is no limit (`null`): it is not where the slider starts, so a link does not leave it out. */
export const ANY_DURATION = "any"

/** The longest search the field takes: nobody looks for a game with more than this. */
export const MAX_QUERY_LENGTH = 60

/** What a visitor typed and picked. */
export type GameFilter = {
  /** The text of the search field, as typed (spaces included: a visitor in the middle of a phrase). It stays in the page, never in the URL. */
  query: string
  /** The categories to keep, by name, in the order they were picked: a game stays when it has any of them. Empty for any. */
  categories: readonly string[]
  /** The number of players of the table, one of `PLAYER_COUNTS`; null for any (the search bar never leaves it empty: it starts on `DEFAULT_PLAYERS`). */
  players: number | null
  /** The longest a game may take, in minutes, one of `DURATION_LIMITS`; null for no limit ("1h+", the last step of the slider, which starts on `DEFAULT_DURATION`). */
  duration: number | null
  /** The most complex a game may be, one of `COMPLEXITY_LEVELS`: a game stays when its level (its weight, rounded) is at most that; null for any (the search bar never leaves it empty: it starts on `DEFAULT_COMPLEXITY` and its bars never go below level 1). */
  complexity: number | null
  /** The age of the youngest player, one of `AGE_LIMITS`: a game stays when its minimum age is at most that; null for any (the search bar never leaves it empty: it starts on `DEFAULT_AGE`). */
  age: number | null
}

/** Nothing typed, nothing picked, not even the starting picks: every game stays. */
export const NO_FILTER: GameFilter = { query: "", categories: [], players: null, duration: null, complexity: null, age: null }

/**
 * Where the search bar starts, and where it goes back to when it is reset: a table of four, games of 20 minutes at most, up to level 3 of 5 in
 * complexity and the youngest player 8 years old. The four are never empty in the bar (the duration can go to "1h+", which is no limit, but not to
 * nothing, and the bars never go below level 1), so they are always at work; what is typed and picked besides (the text, the categories) starts
 * empty. The four are no demand on a game that does not say its players, its duration, its complexity or its minimum age (`filterGames`).
 */
export const DEFAULT_FILTER: GameFilter = {
  ...NO_FILTER,
  players: DEFAULT_PLAYERS,
  duration: DEFAULT_DURATION,
  complexity: DEFAULT_COMPLEXITY,
  age: DEFAULT_AGE,
}

/**
 * What the filter and the sort read of a catalog entry, and all a client component needs of it to filter and order the list: the page sends this to the
 * browser, not the entry (no descriptions, no pictures).
 */
export type GameIndex = {
  slug: string
  /** The name of the game as the Studio has it: what the A–Z sort compares (`sortGames`). */
  name: string
  /** A game to play now or a game to come: no filter asks for it, but the list marks the games to play (`data-game`). */
  live: boolean
  /** ISO date and time the game was added (created in the Studio): what the Newest sort reads. Null when the game does not say. */
  addedAt: string | null
  /** What the search looks into, already normalised (`normalize`). */
  text: string
  /** `max: null` is "N or more". Null when the game does not say. */
  players: { min: number; max: number | null } | null
  /** Minutes, the one figure the game gives. Null when it does not say. */
  duration: number | null
  /** The weight BoardGameGeek gives the game, from 1 (light) to 5 (heavy), as written in its row (2.35). Null when it does not say. */
  complexity: number | null
  /** The minimum age in years. Null when the game does not say. */
  age: number | null
  /** The names of its categories, in the order the Studio lists them. None when it has none. */
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
 * The part of a catalog entry the filter reads, the same for every game, a live one included: its name, the people credited on it, whatever
 * they did, and its publishers (never its descriptions: a word of a sentence is not what a visitor looks a game up by), then the
 * players, the duration, the complexity, the minimum age and the categories, which are the ones of its game in the Studio (of the
 * registry for the players and the duration of a live game with none). Beside them, what the sort reads: its name and the day it was added.
 */
export function indexEntry(entry: CatalogEntry): GameIndex {
  const { name, creators, publishers, players, duration, complexity, age, categories, addedAt } = entry.game
  return {
    slug: entry.slug,
    name,
    live: entry.live,
    addedAt,
    text: normalize([name, ...creators.map((creator) => creator.name), ...publishers.map((publisher) => publisher.name)].join(" ")),
    players,
    duration,
    complexity,
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

/** The level of a game on the scale of the filter: its weight rounded to the nearest level (2.4 is level 2, 2.5 level 3), kept within the scale. */
export function complexityLevel(weight: number): number {
  return Math.min(COMPLEXITY_LEVELS[4], Math.max(COMPLEXITY_LEVELS[0], Math.round(weight)))
}

/**
 * The games that stay for a filter, in the order they came in (the filter never sorts), each as it came in: whatever else a game
 * carries beside its index is kept. All criteria must hold. A game that does not say its players, its duration, its complexity or its
 * minimum age is left out as soon as the filter asks for it, except that the picks the filter starts on (`DEFAULT_PLAYERS`, `DEFAULT_DURATION`,
 * `DEFAULT_COMPLEXITY`, `DEFAULT_AGE`) leave out only the games that say they do not fit: a starting point is no demand, and the list would be empty
 * wherever the rows have no weight or no age yet. A game
 * with no category is left out too when a category is picked. A game has a picked
 * category when it has any of them, spelled exactly. Every word of the query must be somewhere in the text of the game (a part of a
 * word is enough), in any order.
 */
export function filterGames<T extends GameIndex>(games: readonly T[], filter: GameFilter): T[] {
  const terms = words(filter.query)
  return games.filter(
    (game) =>
      (filter.categories.length === 0 || game.categories.some((category) => filter.categories.includes(category))) &&
      (filter.players === null || (game.players === null ? filter.players === DEFAULT_PLAYERS : fitsPlayers(game, filter.players))) &&
      (filter.duration === null || (game.duration === null ? filter.duration === DEFAULT_DURATION : game.duration <= filter.duration)) &&
      (filter.complexity === null ||
        (game.complexity === null ? filter.complexity === DEFAULT_COMPLEXITY : complexityLevel(game.complexity) <= filter.complexity)) &&
      (filter.age === null || (game.age === null ? filter.age === DEFAULT_AGE : game.age <= filter.age)) &&
      terms.every((term) => game.text.includes(term)),
  )
}

// ---------- The order ----------

/** The orders the list can be in, as a visitor is offered them: the catalog's own, by name, by the day a game was added. */
export const SORTS = ["trending", "name", "newest"] as const
export type GameSort = (typeof SORTS)[number]

/** Where the list starts, and what a link leaves out: Trending, the order of the catalog. */
export const DEFAULT_SORT: GameSort = "trending"

/** When a game was added, in milliseconds, or null when it does not say (or says something that is no date). */
function addedTime(game: Pick<GameIndex, "addedAt">): number | null {
  const time = game.addedAt === null ? NaN : Date.parse(game.addedAt)
  return Number.isNaN(time) ? null : time
}

/**
 * The games in the order a visitor asked for, as a new list: the games come in the order of the catalog (`buildCatalog`: the live games first, then the games
 * to come, each group by the `order` of the Studio, lowest first, the owner's "hotness" of the games) and every sort keeps it for the games it leaves tied.
 * - `trending` is that order, the games as they came: the live games first, then the others, each group by hotness.
 * - `name` is alphabetical, case and accents aside, numbers in their order ("6 nimmt!", "7 Wonders", "10 Minutes", "Azul").
 * - `newest` puts the game added last first, a game that says no date after those that do. The games of the first seed were all added at one moment, so they
 *   come in the order of the catalog until a game is added after them.
 * The sort is stable, so two games it cannot tell apart (the same name, the same moment) stay in the order they came in.
 */
export function sortGames<T extends Pick<GameIndex, "name" | "addedAt">>(games: readonly T[], sort: GameSort): T[] {
  const sorted = [...games]
  if (sort === "name") return sorted.sort((a, b) => NAMES.compare(a.name, b.name))
  if (sort === "newest") {
    return sorted.sort((a, b) => {
      const [first, second] = [addedTime(a), addedTime(b)]
      if (first === second) return 0
      if (first === null) return 1
      if (second === null) return -1
      return second - first
    })
  }
  return sorted
}

/** Whether the visitor has typed or picked anything beyond where the filter starts (`DEFAULT_FILTER`): whether there is something to reset. A query of blanks is nothing. */
export function isFiltered(filter: GameFilter): boolean {
  return (
    filter.query.trim() !== "" ||
    filter.categories.length > 0 ||
    filter.players !== DEFAULT_PLAYERS ||
    filter.duration !== DEFAULT_DURATION ||
    filter.complexity !== DEFAULT_COMPLEXITY ||
    filter.age !== DEFAULT_AGE
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
// The picks, `category` (once for each category), `players`, `duration`, `complexity` and `age`, each left out when it is where the filter starts
// (`DEFAULT_PLAYERS`, `DEFAULT_DURATION`, `DEFAULT_COMPLEXITY` and `DEFAULT_AGE`; no limit on the duration, "1h+", is `duration=any`), so that the link
// to the list as it opens is the hub's. The typed text is not in it: the address of the page goes to analytics with every event, and what
// a visitor types in a field is theirs, so it is neither written to the URL nor read from it. The order is in it, `sort`, apart from the picks since it is
// no filter (the filters can be put back where they start and keep the order), left out when it is where the list starts (`DEFAULT_SORT`).

/** The limit a link holds: a number of minutes the slider offers, `any` for no limit ("1h+"), and anything else is where the duration starts. */
function durationOfParam(value: string | null): number | null {
  return value === ANY_DURATION ? null : (optionOf(DURATION_LIMITS, value) ?? DEFAULT_DURATION)
}

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
    ...DEFAULT_FILTER,
    categories: [...new Set(params.getAll("category"))].filter((category) => offered.includes(category)),
    players: optionOf(PLAYER_COUNTS, params.get("players")) ?? DEFAULT_PLAYERS,
    duration: durationOfParam(params.get("duration")),
    complexity: optionOf(COMPLEXITY_LEVELS, params.get("complexity")) ?? DEFAULT_COMPLEXITY,
    age: optionOf(AGE_LIMITS, params.get("age")) ?? DEFAULT_AGE,
  }
}

/** The parameters of the link to a filter: the picks that are set, in a fixed order, and never the query. */
export function filterToParams(filter: GameFilter): URLSearchParams {
  const params = new URLSearchParams()
  for (const category of filter.categories) params.append("category", category)
  if (filter.players !== null && filter.players !== DEFAULT_PLAYERS) params.set("players", String(filter.players))
  if (filter.duration === null) params.set("duration", ANY_DURATION)
  else if (filter.duration !== DEFAULT_DURATION) params.set("duration", String(filter.duration))
  if (filter.complexity !== null && filter.complexity !== DEFAULT_COMPLEXITY) params.set("complexity", String(filter.complexity))
  if (filter.age !== null && filter.age !== DEFAULT_AGE) params.set("age", String(filter.age))
  return params
}

/** The order a link holds: one of `SORTS`, spelled exactly; anything else, or none, is where the list starts (`DEFAULT_SORT`), since a link is anything someone typed or kept for a long time. */
export function sortFromParams(params: { get(name: string): string | null }): GameSort {
  return optionOf(SORTS, params.get("sort")) ?? DEFAULT_SORT
}

/** The parameters of the link to a list in an order: the picks' (`filterToParams`), if any are given, then `sort`, which is left out for `DEFAULT_SORT`. The parameters it is given are not changed. */
export function sortToParams(sort: GameSort, params: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const next = new URLSearchParams(params)
  if (sort !== DEFAULT_SORT) next.set("sort", sort)
  return next
}

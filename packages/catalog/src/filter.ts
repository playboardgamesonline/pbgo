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

/** Where a press of the players' stepper picks when nothing is picked yet: a table of four, whichever way the press goes. One of `PLAYER_COUNTS`. The stepper starts on no number, "Any". */
export const FIRST_PLAYERS = 4

/**
 * The last level of the complexity scale is no limit: every game is at that level or lighter, so a bar pressed there is no pick (`complexityPick`), as the last
 * step of the duration slider, "1h+", is none. The bars start on it.
 */
export const ANY_COMPLEXITY = COMPLEXITY_LEVELS[4]

/**
 * The last age is no limit: a youngest player of 18 can play every game, so it is no pick (`agePick`) and the menu words it "All ages" instead of "18+". The
 * menu starts on it.
 */
export const ANY_AGE = AGE_LIMITS[5]

/** The longest search the field takes: nobody looks for a game with more than this. */
export const MAX_QUERY_LENGTH = 60

/**
 * What a visitor typed and picked. A pick that is null is no demand: the filter starts with none, so that every game of the catalog is listed, a game that
 * does not say its players, its duration, its complexity or its minimum age included, until the visitor asks for something.
 */
export type GameFilter = {
  /** The text of the search field, as typed (spaces included: a visitor in the middle of a phrase). It stays in the page, never in the URL. */
  query: string
  /** The categories to keep, by name, in the order they were picked: a game stays when it has any of them. Empty for any. */
  categories: readonly string[]
  /** The number of players of the table, one of `PLAYER_COUNTS`; null for any (where the stepper starts, "Any"). */
  players: number | null
  /** The longest a game may take, in minutes, one of `DURATION_LIMITS`; null for no limit ("1h+", the last step of the slider, where it starts). */
  duration: number | null
  /** The most complex a game may be, one of `COMPLEXITY_LEVELS` but the last: a game stays when its level (its weight, rounded) is at most that; null for any (all the bars filled, where they start: the bars never go below level 1). */
  complexity: number | null
  /** The age of the youngest player, one of `AGE_LIMITS` but the last: a game stays when its minimum age is at most that; null for any ("All ages", where the menu starts). */
  age: number | null
}

/** Nothing typed, nothing picked: every game stays. */
export const NO_FILTER: GameFilter = { query: "", categories: [], players: null, duration: null, complexity: null, age: null }

/**
 * Where the search bar starts, and where it goes back to when it is reset: nothing typed and nothing picked, so every game is listed. The four controls under
 * the bar show it as their own end of no limit: the stepper says "Any", the slider is on "1h+", the bars are all filled and the menu says "All ages". It is
 * the filter of no pick at all (`NO_FILTER`), which a visitor narrows one control at a time.
 */
export const DEFAULT_FILTER: GameFilter = NO_FILTER

/** The pick that a bar of the complexity meter stands for: the last bar is no limit, so no pick (null). */
export function complexityPick(level: number): number | null {
  return level >= ANY_COMPLEXITY ? null : level
}

/** The pick that an age of the menu stands for: the last is "All ages", so no pick (null). */
export function agePick(age: number): number | null {
  return age >= ANY_AGE ? null : age
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
 * carries beside its index is kept. All criteria must hold. A pick that is null asks for nothing, so with none every game stays; a pick that is set
 * leaves out a game that does not say its players, its duration, its complexity or its minimum age, since the game cannot be said to fit. A game
 * with no category is left out too when a category is picked. A game has a picked
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
      (filter.complexity === null || (game.complexity !== null && complexityLevel(game.complexity) <= filter.complexity)) &&
      (filter.age === null || (game.age !== null && game.age <= filter.age)) &&
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

/** Whether the visitor has typed or picked anything beyond where the filter starts (`DEFAULT_FILTER`, nothing): whether there is something to reset. A query of blanks is nothing. */
export function isFiltered(filter: GameFilter): boolean {
  return (
    filter.query.trim() !== "" ||
    filter.categories.length > 0 ||
    filter.players !== null ||
    filter.duration !== null ||
    filter.complexity !== null ||
    filter.age !== null
  )
}

/** The option among `options` that the text spells exactly (no "04" for 4, no "4.0"), else null: the pick that a link or a chip stands for. */
export function optionOf<T extends number | string>(options: readonly T[], value: string | null): T | null {
  return options.find((option) => String(option) === value) ?? null
}

/**
 * Where a stepper goes from `current`: one place along `options` in the `direction` (1 for the next one, -1 for the one before). It stays on the last option
 * at the top end, and goes back to nothing (null) down from the first, since a stepper starts on no pick. While nothing is picked (`current` is null, or is
 * not one of the options) the first press picks `first`, whichever way it goes.
 */
export function stepOption(options: readonly number[], current: number | null, direction: 1 | -1, first: number): number | null {
  const index = current === null ? -1 : options.indexOf(current)
  if (index === -1) return first
  if (index === 0 && direction === -1) return null
  return options[Math.min(options.length - 1, index + direction)] ?? first
}

/** Whether a stepper can go `direction` from `current`: it always can while nothing is picked, then up to the last option, and down from every option, the first included (it goes back to nothing). */
export function canStep(options: readonly number[], current: number | null, direction: 1 | -1): boolean {
  const index = current === null ? -1 : options.indexOf(current)
  if (index === -1) return true
  return direction === -1 || index < options.length - 1
}

// ---------- In the URL ----------
// The picks, `category` (once for each category), `players`, `duration`, `complexity` and `age`, each left out when it is where the filter starts (on
// nothing: "Any" players, no limit on the duration, "1h+", all the bars, "All ages"), so that the link to the list as it opens is the hub's. The typed text
// is not in it: the address of the page goes to analytics with every event, and what a visitor types in a field is theirs, so it is neither written to the
// URL nor read from it. The order is in it, `sort`, apart from the picks since it is no filter (the filters can be put back where they start and keep the
// order), left out when it is where the list starts (`DEFAULT_SORT`).

/**
 * The picks a link holds, with no query. `offered` are the categories the filter offers (`categoriesOf`): a value the filters do not
 * offer, a category no game has included, is ignored, never an error, since a link is anything someone typed or kept for a long time.
 * The categories keep the order of the link, each one once.
 */
export function filterFromParams(
  params: { get(name: string): string | null; getAll(name: string): string[] },
  offered: readonly string[],
): GameFilter {
  const level = optionOf(COMPLEXITY_LEVELS, params.get("complexity"))
  const age = optionOf(AGE_LIMITS, params.get("age"))
  return {
    ...DEFAULT_FILTER,
    categories: [...new Set(params.getAll("category"))].filter((category) => offered.includes(category)),
    players: optionOf(PLAYER_COUNTS, params.get("players")),
    duration: optionOf(DURATION_LIMITS, params.get("duration")),
    // The last bar and the last age are no limit, so a link that holds them (as the links written before the filter started on nothing did) is no pick
    complexity: level === null ? null : complexityPick(level),
    age: age === null ? null : agePick(age),
  }
}

/** The parameters of the link to a filter: the picks that are set, in a fixed order, and never the query. */
export function filterToParams(filter: GameFilter): URLSearchParams {
  const params = new URLSearchParams()
  for (const category of filter.categories) params.append("category", category)
  if (filter.players !== null) params.set("players", String(filter.players))
  if (filter.duration !== null) params.set("duration", String(filter.duration))
  if (filter.complexity !== null) params.set("complexity", String(filter.complexity))
  if (filter.age !== null) params.set("age", String(filter.age))
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

import type { GameTournament } from "./game-activity"

// What the right column of the signed-in home says (`HomeAside`): what's new (the latest article of the platform) and the tournaments that are open. Neither has a source for a member yet (the hub reads no article, and no tournament is recorded: `getTournaments`
// lists none), so a member's column says so with an empty state, and the demo account of development has a made-up article and made-up tournaments, so that the column can be looked at with something in it. No React and nothing of the server in this file,
// so that it is tested as it is.

/** The latest article, as the card of the home says it: its title, its summary, the day it came out (`YYYY-MM-DD`), its cover when it has one, and where it opens. */
export type HomeArticle = { id: string; title: string; summary: string; date: string; picture?: string; href: string }

/** A game, as a row of the open tournaments says it: its slug, its name and the picture of its tile (`gameThumb`). */
export type AsideGame = { slug: string; name: string; picture?: string; logo?: string }

/** An open tournament with the game it is played on. */
export type HomeTournament = GameTournament & { game: AsideGame }

/** How many open tournaments the home lists, the ones that start first: they are shown as many to a page as the height of the column lets (`perPageFor`), and the pages are the dots under them. */
export const HOME_TOURNAMENTS = 12

/** The most rows on a page of the open tournaments: a column that is tall enough shows this many, one that is not shows fewer, never fewer than one. */
export const TOURNAMENTS_PER_PAGE_MAX = 4

/** The space between two rows of a page, in pixels, as the page draws it (`gap-3`). */
export const ROW_GAP = 12

/** What the dots under the rows take of the height, in pixels: their row (`h-5`) and the space above it (`gap-2`). The rows of a page are what is left of the height. */
export const PAGER_DOTS_ROOM = 28

/**
 * How many rows a page of the open tournaments holds: as many as fit in `available` pixels of height, rows of `rowHeight` with `gap` between them, between one and `TOURNAMENTS_PER_PAGE_MAX`. Where nothing is known yet (a column that is not laid out, a row that
 * is not drawn) it is the most.
 */
export function perPageFor(available: number, rowHeight: number, gap: number = ROW_GAP): number {
  if (!(available > 0) || !(rowHeight > 0)) return TOURNAMENTS_PER_PAGE_MAX
  return Math.max(1, Math.min(TOURNAMENTS_PER_PAGE_MAX, Math.floor((available + gap) / (rowHeight + gap))))
}

/** The items cut into pages of `perPage`, in order; the last page holds what is left. None for no item. */
export function pagesOf<T>(items: readonly T[], perPage: number): T[][] {
  const size = Math.max(1, Math.floor(perPage) || 1)
  return Array.from({ length: Math.ceil(items.length / size) }, (_, page) => items.slice(page * size, (page + 1) * size))
}

/** The fewest lines of its summary that the article of what's new shows: the tournaments never take them. */
export const ARTICLE_LINES_MIN = 3

/** The lines of its summary that the article is drawn with until the column has been measured and where the column has no height of its own (under `xl`). */
export const ARTICLE_LINES_DEFAULT = 4

/** How the right column shares its height: the rows of a page of open tournaments and the lines of the article's summary. */
export type AsideFit = { perPage: number; lines: number }

/** The column before it is measured, and wherever it has no height of its own: the most rows and the default lines. */
export const ASIDE_FIT: AsideFit = { perPage: TOURNAMENTS_PER_PAGE_MAX, lines: ARTICLE_LINES_DEFAULT }

/** How many lines of the summary the article shows when `free` pixels are left over its fewest lines, lines of `lineHeight` pixels: the fewest, and a line more for each one of room. */
export function summaryLinesFor(free: number, lineHeight: number): number {
  if (!(free > 0) || !(lineHeight > 0)) return ARTICLE_LINES_MIN
  return ARTICLE_LINES_MIN + Math.floor(free / lineHeight)
}

/**
 * What the column measured, in pixels: `area` is the height that the block of the tournaments has now (what is left of the column under the article), `lineHeight` and `shown` the line of the article's summary and how many lines of it are drawn (none when there is no article),
 * `rowHeight` the tallest row of the tournaments, `count` how many tournaments there are and `empty` the height of the empty state when there are none.
 */
export type AsideMeasure = { area: number; lineHeight: number; shown: number; rowHeight: number; count: number; empty: number }

/**
 * How the right column, beside the zone and as tall as it, shares its height: the tournaments come first, as many rows to a page as fit up to `TOURNAMENTS_PER_PAGE_MAX` while the article keeps its fewest lines, and the article takes everything that is left, its summary
 * showing as many lines as fit. What the article draws above its fewest lines is given back to the tournaments before they are counted, so that the answer is the same whatever the article is drawn with, and does not move when it grows into the room it was given. Where nothing is
 * known yet (a column that is not laid out, rows that are not drawn) it is `ASIDE_FIT`.
 */
export function fitAside({ area, lineHeight, shown, rowHeight, count, empty }: AsideMeasure): AsideFit {
  if (!(area > 0) || (count > 0 && !(rowHeight > 0))) return ASIDE_FIT
  const article = shown > 0 && lineHeight > 0
  const budget = area + (article ? Math.max(0, shown - ARTICLE_LINES_MIN) * lineHeight : 0)
  const perPage = perPageFor(budget - PAGER_DOTS_ROOM, rowHeight)
  if (!article) return { perPage, lines: ARTICLE_LINES_DEFAULT }
  const rows = Math.min(count, perPage)
  const used = count === 0 ? empty : rows * rowHeight + (rows - 1) * ROW_GAP + (count > perPage ? PAGER_DOTS_ROOM : 0)
  return { perPage, lines: summaryLinesFor(budget - used, lineHeight) }
}

/** The tournaments that are open for sign-ups, among the tournaments of each game, the ones that start first, each with its game. */
export function openTournaments(lists: readonly { game: AsideGame; tournaments: readonly GameTournament[] }[]): HomeTournament[] {
  return lists
    .flatMap(({ game, tournaments }) => tournaments.filter((tournament) => tournament.status === "upcoming").map((tournament) => ({ ...tournament, game })))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, HOME_TOURNAMENTS)
}

/** The article that the demo account of development shows in what's new: made up, and leading to a page that exists. */
export const DEMO_ARTICLE: HomeArticle = {
  id: "demo-article",
  title: "How a search finds your table",
  summary:
    "Normal and Ranked look for a table among players you do not know. Here is what each one asks of a table, and what your rank changes. A search sits you at the fullest public table of each game you picked that fits your speed, your expansions, your rank and your language, or opens one when there is none. The first table to fill begins by itself and takes you to its board. A ranked search always plays at the usual speed.",
  date: "2026-11-12",
  href: "/about#whats-new",
}

const DAY_MS = 24 * 60 * 60 * 1000

const PLANS = [
  { suffix: "Open", days: 3, hour: 19, places: 32, registered: 21 },
  { suffix: "Weekend Cup", days: 6, hour: 14, places: 16, registered: 16 },
  { suffix: "League, round 1", days: 9, hour: 18, places: 64, registered: 38 },
  { suffix: "Rookie Night", days: 12, hour: 20, places: 24, registered: 9 },
  { suffix: "Masters", days: 15, hour: 17, places: 8, registered: 5 },
  { suffix: "Friday Blitz", days: 18, hour: 21, places: 48, registered: 30 },
]

/** What the demo account of development shows as open tournaments: six, one after the other on the games it has in turn, in the days to come, the second one full, so that the list has pages to scroll. None when it has no game. */
export function demoTournaments(games: readonly AsideGame[], now: Date): HomeTournament[] {
  if (games.length === 0) return []
  const at = (days: number, hour: number) => {
    const day = new Date(now.getTime() + days * DAY_MS)
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour)).toISOString()
  }
  return PLANS.map((plan, index) => {
    const game = games[index % games.length]!
    return { id: `demo-${game.slug}-${index}`, name: `${game.name} ${plan.suffix}`, status: "upcoming", startsAt: at(plan.days, plan.hour), places: plan.places, registered: plan.registered, game }
  })
}

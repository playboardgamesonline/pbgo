/**
 * The figures under the title of the home (`Stats`): the players online, the members and the games. Pure and without any import, so that the page, the route that refreshes them and the browser all take it.
 */

/** The two figures that come from the database; `null` is one that could not be counted, which the page leaves out and never makes up. */
export type HubFigures = { online: number | null; members: number | null }

/** Where the browser asks for fresh figures (a `GET`, answered by `apps/web`), and how often it does while the home is in view. */
export const FIGURES_PATH = "/api/hub/figures"
export const FIGURES_REFRESH_MS = 30_000

/** A figure as it is written on the page: `12,480`. */
export const figure = (value: number) => new Intl.NumberFormat("en").format(value)

const noun = (count: number, one: string, many: string) => (count === 1 ? one : many)

/** One pill of `Stats`. */
export type StatsItem = { value: string; label: string; live?: boolean }

/**
 * The pills of the home in the order they are read: the players online (with the dot of what is happening now), the members and the games. A figure that could not be counted has no pill, and one reads
 * "1 member", not "1 members".
 */
export function statsItems(figures: HubFigures, games: number): StatsItem[] {
  return [
    ...(figures.online === null ? [] : [{ value: figure(figures.online), label: noun(figures.online, "player online", "players online"), live: true }]),
    ...(figures.members === null ? [] : [{ value: figure(figures.members), label: noun(figures.members, "member", "members") }]),
    { value: figure(games), label: noun(games, "game", "games") },
  ]
}

/** A count in what the figures route answered: a whole number of 0 or more, or `null` for a figure the server could not count. `undefined` for anything else. */
function countOf(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined
}

/** What the figures route answered, as the browser trusts it: both figures, each a count or `null`; anything else is not the figures and gives `null`. */
export function parseFigures(value: unknown): HubFigures | null {
  if (typeof value !== "object" || value === null) return null
  const { online, members } = value as Record<string, unknown>
  const parsed = { online: countOf(online), members: countOf(members) }
  return parsed.online === undefined || parsed.members === undefined ? null : { online: parsed.online, members: parsed.members }
}

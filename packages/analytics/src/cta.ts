import type { ClientEvents } from "./events"

/**
 * The buttons of a game's page that count themselves from their markup (`data-cta="create_table"` and `data-cta-game="<slug>"`): a link of a server component has no handler to count it with, so the page's listener
 * (`AnalyticsProvider`) reads these two attributes. They come from the page, but a page is only text to a script: what they say is checked before it is sent.
 */
export type GamePageClick = ClientEvents["game_page_clicked"]

const TARGETS: readonly GamePageClick["target"][] = ["create_table", "buy"]

/** What the registry's slugs look like: lower case, digits and dashes. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/

/** Whether a text is the slug of a game: what the page's addresses and attributes are checked against before one goes into an event. */
export const isGameSlug = (value: string | undefined): value is string => value !== undefined && SLUG.test(value)

/** The click that a link's attributes stand for, or null when they are not the two of a button that counts. */
export function gamePageClickOf(target: string | undefined, game: string | undefined): GamePageClick | null {
  const known = TARGETS.find((candidate) => candidate === target)
  if (!known || !isGameSlug(game)) return null
  return { game, target: known }
}

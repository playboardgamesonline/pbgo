import type { NotionGame } from "./types.ts"
import type { Rank } from "./types.ts"

// The order the hub lists the games in, as it was when the seed numbered them: the live games of the registry first, then the other
// games of the Games database by the Priority, Status and Effort of the Games Development database, then by name.

// "6 nimmt!" before "7 Wonders", "Skyjo" and "Skull King" in the order a reader expects
const NAMES = new Intl.Collator("en", { sensitivity: "base", numeric: true })

/** Two ranks in one direction (1: the first option first, -1: the last one first). A game with no value goes after every game that has one, whichever the direction. */
function compareRanks(a: Rank | null, b: Rank | null, direction: 1 | -1): number {
  if (a === null || b === null) return Number(a === null) - Number(b === null)
  return direction * (a.position - b.position)
}

/**
 * The order of the coming-soon games: the one of the "Table" view of the Games Development database in Notion, copied here (the
 * reader does not read the sort of a view). Priority first (P1 before P2), then Status (the last option first, so the game that is
 * furthest along comes first), then Effort (the lowest first), then the name, case and accents aside, numbers in their order.
 * A game with no value for a column comes after the games that have one.
 */
export function comparePlanned(a: NotionGame, b: NotionGame): number {
  return (
    compareRanks(a.development.priority, b.development.priority, 1) ||
    compareRanks(a.development.status, b.development.status, -1) ||
    compareRanks(a.development.effort, b.development.effort, 1) ||
    NAMES.compare(a.name, b.name)
  )
}

/** The games the registry does not list as live and that are not the template: the template is the demo of the shared base, not a game. */
const UNLISTED_SLUGS: ReadonlySet<string> = new Set(["template"])

/**
 * The rows in the order the hub listed them: the live games of the registry (`live`, their slugs in registry order) that have a row, then
 * the other rows by `comparePlanned`. The template is never listed.
 */
export function hubOrder(live: readonly string[], rows: readonly NotionGame[]): NotionGame[] {
  const liveRows = live.flatMap((slug) => (UNLISTED_SLUGS.has(slug) ? [] : (rows.find((row) => row.slug === slug) ?? [])))
  const taken = new Set(liveRows.map((row) => row.slug))
  return [...liveRows, ...rows.filter((row) => !UNLISTED_SLUGS.has(row.slug) && !taken.has(row.slug)).sort(comparePlanned)]
}

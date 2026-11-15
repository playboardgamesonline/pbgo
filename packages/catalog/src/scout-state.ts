import { printable, type ScoutCatalogEntry, type ScoutState } from "@pbgo/games/scout"
import { PLATFORM_DATASET, PLATFORM_PROJECT_ID, SANITY_API_VERSION, SanityError, isRecord } from "./sanity.ts"

// What `pnpm check:scout --online` and `--list` read of the platform's Sanity project (GAM-32): the published games and expansions, as far as a scouted game is compared with them (their slug,
// name, BoardGameGeek id, kind and base game). Run by Node itself (type stripping), like `scripts/list.ts`: a value import has its `.ts` extension. No token: the dataset is public, and a draft
// is not seen from outside, which `existing.catalog` says ("published").

/** The published `game` and `expansion` documents. */
export const SCOUT_STATE_QUERY = `*[_type in ["game", "expansion"] && defined(slug.current)]{ _type, "slug": slug.current, name, bggId, kind, "baseGame": baseGame->slug.current }`

export type ScoutStateRead = Omit<ScoutState, "registry">

export type ScoutStateOptions = {
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** 8 seconds by default. */
  timeoutMs?: number
  projectId?: string
  dataset?: string
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null)
const wholeNumber = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null)

/**
 * The published games and expansions of the platform's project, read from the API itself and not from its CDN, so that what was published a minute ago counts. A document with no
 * name or no slug is left out. Throws a `SanityError` when the project cannot be read, and never repeats the address of the request.
 */
export async function readScoutState(options: ScoutStateOptions = {}): Promise<ScoutStateRead> {
  const projectId = options.projectId ?? PLATFORM_PROJECT_ID
  const dataset = options.dataset ?? PLATFORM_DATASET
  const doFetch = options.fetch ?? fetch
  const url = `https://${projectId}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}?perspective=published&query=${encodeURIComponent(SCOUT_STATE_QUERY)}`

  let response: Response
  try {
    response = await doFetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? 8000) })
  } catch (error) {
    // Only the kind of failure (TimeoutError, TypeError…): nothing of the request is repeated
    throw new SanityError(`The platform's Sanity project could not be reached (${error instanceof Error ? error.name : "unknown error"})`, 0)
  }
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new SanityError(`Sanity answered ${response.status}`, response.status)
  const result = isRecord(payload) ? payload.result : null
  if (!Array.isArray(result)) throw new SanityError("Sanity answered with something that is not a list of documents", 200)

  const games: ScoutCatalogEntry[] = []
  const expansions: ScoutCatalogEntry[] = []
  for (const raw of result) {
    if (!isRecord(raw)) continue
    const slug = text(raw.slug)
    const name = text(raw.name)
    if (slug === null || name === null) continue
    const bggId = wholeNumber(raw.bggId)
    const baseGame = text(raw.baseGame)
    if (raw._type === "game") games.push({ slug, name, bggId, kind: raw.kind === "reimplementation" ? "reimplementation" : "game", baseGame })
    else if (raw._type === "expansion") expansions.push({ slug, name, bggId, kind: null, baseGame })
  }
  return { games, expansions }
}

/**
 * What `pnpm check:scout --list` prints: every game and expansion that a scouted game is compared with, one a line (its slug, its type, its BoardGameGeek id, its base game, whether it has a
 * folder in the repo and its name), then the games of the registry that the catalog does not have. It is what to read a game's slug and type from before scouting one.
 */
export function describeState(registry: readonly { slug: string; name: string }[], state: ScoutStateRead): string {
  const folders = new Set(registry.map((game) => game.slug))
  const rows = [
    ...state.games.map((entry) => ({ slug: entry.slug, type: entry.kind ?? "game", bgg: entry.bggId, base: entry.baseGame, name: entry.name })),
    ...state.expansions.map((entry) => ({ slug: entry.slug, type: "expansion", bgg: entry.bggId, base: entry.baseGame, name: entry.name })),
  ]
  const listed = new Set(rows.map((row) => row.slug))
  for (const game of registry) if (!listed.has(game.slug)) rows.push({ slug: game.slug, type: "folder only", bgg: null, base: null, name: game.name })
  rows.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))

  const cells = [["slug", "type", "bgg", "base", "folder", "name"], ...rows.map((row) => [row.slug, row.type, row.bgg === null ? "-" : String(row.bgg), row.base ?? "-", folders.has(row.slug) ? "yes" : "no", row.name])].map((line) =>
    line.map((cell) => printable(cell, 80)),
  )
  const widths = [0, 1, 2, 3, 4].map((column) => Math.max(...cells.map((line) => (line[column] ?? "").length)))
  const lines = cells.map((line) => line.map((cell, column) => (column === line.length - 1 ? cell : cell.padEnd(widths[column] ?? 0))).join("  "))
  return [`${state.games.length} games and ${state.expansions.length} expansions published in the platform's catalog, ${registry.length} games with a folder in the repo`, "", ...lines].join("\n")
}

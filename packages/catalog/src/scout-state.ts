import type { ScoutCatalogEntry, ScoutState } from "@pbgo/games/scout"
import { PLATFORM_DATASET, PLATFORM_PROJECT_ID, SANITY_API_VERSION, SanityError, isRecord } from "./sanity.ts"

// What `pnpm check:scout --online` reads of the platform's Sanity project (GAM-32): the published games and expansions, as far as a scouted game is compared with them (its slug, its
// name, its BoardGameGeek id, its kind and its base game). Run by Node itself (type stripping), like `scripts/list.ts`: a value import has its `.ts` extension. No token: the dataset is
// public, and a draft is not seen from outside, which `existing.catalog` says ("published").

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
  const expansions: (ScoutCatalogEntry & { baseGame: string | null })[] = []
  for (const raw of result) {
    if (!isRecord(raw)) continue
    const slug = text(raw.slug)
    const name = text(raw.name)
    if (slug === null || name === null) continue
    const bggId = wholeNumber(raw.bggId)
    if (raw._type === "game") games.push({ slug, name, bggId, kind: raw.kind === "reimplementation" ? "reimplementation" : "game" })
    else if (raw._type === "expansion") expansions.push({ slug, name, bggId, kind: null, baseGame: text(raw.baseGame) })
  }
  return { games, expansions }
}

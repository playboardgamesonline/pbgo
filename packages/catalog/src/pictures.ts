import { HUB_LANGUAGE, PLATFORM_DATASET, PLATFORM_PROJECT_ID, SANITY_API_VERSION, SanityError, isRecord } from "./sanity.ts"

// What `pnpm catalog:pictures <slug>` reads of the platform's Sanity project (PLT-99, `.claude/skills/platform-assets`): which of the five pictures a game's published entry has. The pictures step of
// `/add-game` asks it (`pnpm game-flow gate`) once the sub-agent has reported, so that nobody takes the skill's word for what is public. Run by Node itself (type stripping), like `scout-state.ts`: a value import has its
// `.ts` extension. No token: the dataset is public, and a draft is not seen from outside, which is the point ("published").

/** The pictures of a game of the catalog, in the order the Studio shows them: the platform's seed (`platform/content/data/art.ts`) places a file in each. */
export const PICTURE_NAMES = ["cover", "logo", "icon", "background", "boxFront"] as const
export type PictureName = (typeof PICTURE_NAMES)[number]

/** The three that can differ by language (a title written in it): the row of English is the one read. The icon and the background are the same in every language. */
export const TRANSLATED_PICTURES: readonly PictureName[] = ["cover", "logo", "boxFront"]

/** The published game of a slug, with whether each picture has its file. */
export const PICTURES_QUERY = `*[_type == "game" && slug.current == $slug][0]{ "id": _id, name, "cover": defined(cover[language == $language][0].value.asset), "logo": defined(logo[language == $language][0].value.asset), "icon": defined(icon.asset), "background": defined(background.asset), "boxFront": defined(boxFront[language == $language][0].value.asset) }`

export type PicturesRead = { id: string; name: string; pictures: Record<PictureName, boolean> }

export type PicturesOptions = {
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** 8 seconds by default. */
  timeoutMs?: number
  projectId?: string
  dataset?: string
}

/**
 * The pictures of the published game that has this slug, read from the API itself and not from its CDN, so that what was published a minute ago counts. `null` when the project holds no published game
 * of that slug. Throws a `SanityError` when the project cannot be read, and never repeats the address of the request.
 */
export async function readPictures(slug: string, options: PicturesOptions = {}): Promise<PicturesRead | null> {
  const projectId = options.projectId ?? PLATFORM_PROJECT_ID
  const dataset = options.dataset ?? PLATFORM_DATASET
  const doFetch = options.fetch ?? fetch
  const params = `&%24slug=${encodeURIComponent(JSON.stringify(slug))}&%24language=${encodeURIComponent(JSON.stringify(HUB_LANGUAGE))}`
  const url = `https://${projectId}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}?perspective=published&query=${encodeURIComponent(PICTURES_QUERY)}${params}`
  let response: Response
  try {
    response = await doFetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? 8000) })
  } catch (error) {
    // Only the kind of failure (TimeoutError, TypeError…): nothing of the request is repeated
    throw new SanityError(`The platform's Sanity project could not be reached (${error instanceof Error ? error.name : "unknown error"})`, 0)
  }
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new SanityError(`Sanity answered ${response.status}`, response.status)
  if (!isRecord(payload) || !("result" in payload)) throw new SanityError("Sanity answered with something that is not a result", 200)
  const found = payload.result
  if (found === null) return null
  if (!isRecord(found) || typeof found.id !== "string" || typeof found.name !== "string") throw new SanityError("Sanity answered with a game that has no id or no name", 200)
  return { id: found.id, name: found.name, pictures: Object.fromEntries(PICTURE_NAMES.map((name) => [name, found[name] === true])) as Record<PictureName, boolean> }
}

/** The lines `pnpm catalog:pictures` prints: the game, how many of the five it has, then each with its mark. */
export function describePictures(read: PicturesRead): string[] {
  const has = PICTURE_NAMES.filter((name) => read.pictures[name])
  return [`${read.name} (${read.id}), published: ${has.length} of ${PICTURE_NAMES.length} pictures`, ...PICTURE_NAMES.map((name) => `  ${read.pictures[name] ? "✓" : "✗"} ${name}`)]
}

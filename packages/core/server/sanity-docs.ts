import "server-only"
import type { SanityClient } from "next-sanity"

/**
 * The documents of a game that the gamemaster edits (each is a singleton whose `_id` is also its `_type`). The site reads the
 * published one (`settings`); the Studio shows and edits a draft of it (`drafts.settings`) when there is one, so the gamemaster
 * has to follow the Studio, not only the published document.
 */
export const DOCS = ["settings", "interface", "audio", "texts"] as const
export type DocName = (typeof DOCS)[number]

/** `_updatedAt` of the two versions of a document, null when that version does not exist. */
export type Version = { published: string | null; draft: string | null }
export type Versions = Record<string, Version>

/** What the gamemaster tells the owner about a draft it does not simply follow. */
export type DraftState = "stale" | "unpublished"

type Tx = ReturnType<SanityClient["transaction"]>

/** The clients read the `published` perspective, which hides every draft: `raw` shows both versions, by their own ids. */
export const RAW_PERSPECTIVE = { perspective: "raw" } as const

export const draftId = (id: string) => `drafts.${id}`

/** Which versions of each document exist, and when each was last written (one query). Drafts are only readable with a token. */
export async function readVersions(c: SanityClient, ids: readonly string[]): Promise<Versions> {
  const rows = await c.fetch<{ _id: string; _updatedAt: string }[]>(`*[_id in $ids]{ _id, _updatedAt }`, { ids: ids.flatMap((id) => [id, draftId(id)]) }, RAW_PERSPECTIVE)
  const versions: Versions = Object.fromEntries(ids.map((id) => [id, { published: null, draft: null }]))
  for (const row of rows) {
    const isDraft = row._id.startsWith("drafts.")
    const version = versions[isDraft ? row._id.slice("drafts.".length) : row._id]
    if (version) version[isDraft ? "draft" : "published"] = row._updatedAt
  }
  return versions
}

/**
 * One version of a document, by its own id (`drafts.<id>` is the draft). `projection` is a GROQ projection, such as
 * `{ music[]{ _key, key } }`; null when that version does not exist.
 */
export const fetchDoc = <T,>(c: SanityClient, id: string, projection: string) => c.fetch<T | null>(`*[_id == $id][0]${projection}`, { id }, RAW_PERSPECTIVE)

/**
 * A draft older than the published document is stale: the published one was written after the Studio last touched the draft
 * (the former gamemaster patched the published documents only), so the draft holds values the site no longer has. Following it
 * would show an outdated form, and a save or a publish would bring the old values back. Equal times are fresh (a save writes both).
 */
export const isStale = (v: Version) => !!v.published && !!v.draft && Date.parse(v.draft) < Date.parse(v.published)

/** What the Studio shows, unless that draft is stale: the draft, else the published document. */
export const readId = (id: string, v?: Version) => (v?.draft && !isStale(v) ? draftId(id) : id)

/**
 * Where a save goes. Published and fresh draft together, so the Studio and the site agree; the published one alone when the draft
 * is stale (it is never touched) or absent; the draft alone when nothing is published (the owner publishes). `create` is true only
 * when neither version exists. A draft is never created: it would bring back one the Studio just published.
 */
export function writeTargets(id: string, v?: Version): { ids: string[]; create: boolean } {
  if (!v?.published && !v?.draft) return { ids: [id], create: true }
  if (!v.published) return { ids: [draftId(id)], create: false }
  return { ids: v.draft && !isStale(v) ? [id, draftId(id)] : [id], create: false }
}

export function draftState(v?: Version): DraftState | null {
  if (!v?.draft) return null
  if (!v.published) return "unpublished"
  return isStale(v) ? "stale" : null
}

/**
 * Applies one edit to every version of a document that a save must reach, in ONE transaction: all of them change or none does, so
 * the Studio and the site can never disagree after a failure. `build` adds the patches for one target id (it may read that
 * version first). `create: false` for an edit that only removes things: with nothing to remove from, it does nothing instead of
 * creating an empty document. A `build` that adds no patch commits nothing.
 */
export async function eachVersion(c: SanityClient, id: DocName, build: (target: string, tx: Tx) => void | Promise<void>, { create = true }: { create?: boolean } = {}) {
  const { ids, create: missing } = writeTargets(id, (await readVersions(c, [id]))[id])
  if (missing && !create) return
  const tx = c.transaction()
  if (missing) tx.createIfNotExists({ _id: id, _type: id })
  const own = missing ? 1 : 0
  for (const target of ids) await build(target, tx)
  if (tx.serialize().length > own) await tx.commit()
}

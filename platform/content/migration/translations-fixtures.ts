import { translatedRowType } from "@pbgo/studio-kit/constants"
import type { Doc, PatchMutation, TranslationStore } from "./translations.ts"

// Documents of the catalog as the dataset holds them before PLT-104 (plain texts and pictures, a link to the rules per language), and an
// in-memory dataset with the contract of the real one for what the migration does: a transaction is all or nothing, and a patch that names
// a revision is refused if the document was saved since.

export const picture = (hash: string, extra: Record<string, unknown> = {}) => ({ _type: "image", asset: { _type: "reference", _ref: `image-${hash}-800x600-webp` }, ...extra })

const HOTSPOT = { _type: "sanity.imageHotspot", x: 0.4, y: 0.6, height: 0.5, width: 0.5 }
const CROP = { _type: "sanity.imageCrop", top: 0.1, bottom: 0.1, left: 0, right: 0 }

/** A published game as it is today: what the hub reads of it, and what the Studio kept besides. */
export const OLD_HANABI: Doc = {
  _id: "game-hanabi",
  _type: "game",
  _rev: "rev-hanabi",
  _createdAt: "2026-10-30T10:00:00Z",
  _updatedAt: "2026-10-30T10:00:00Z",
  name: "Hanabi",
  slug: { _type: "slug", current: "hanabi" },
  kind: "game",
  order: 30,
  playersMin: 2,
  playersMax: 5,
  description: "A cooperative card game in which nobody sees their own cards.",
  rulesFr: "https://example.com/hanabi-fr.pdf",
  rulesEn: "https://example.com/hanabi-en.pdf",
  logo: picture("logo"),
  cover: picture("cover", { hotspot: HOTSPOT, crop: CROP }),
  icon: picture("icon"),
  background: picture("background", { hotspot: HOTSPOT }),
  categories: [{ _key: "category-cooperation", _type: "reference", _ref: "category-cooperation" }],
}

/** A published game that has almost nothing: most of the 71 are like this. */
export const OLD_BARE: Doc = { _id: "game-bare", _type: "game", _rev: "rev-bare", name: "Bare", slug: { _type: "slug", current: "bare" }, kind: "game", order: 40 }

export const OLD_CATEGORY: Doc = { _id: "category-cooperation", _type: "category", _rev: "rev-category", name: "Cooperation", color: "#3366ff", description: "Win or lose together." }

/** An expansion, published, and its draft with a newer name (the owner was renaming it when this was written). */
export const OLD_EXPANSION: Doc = {
  _id: "expansion-courtisans-diplomats-confidants",
  _type: "expansion",
  _rev: "rev-expansion",
  name: "Courtisans: Diplomates & Confidents",
  slug: { _type: "slug", current: "courtisans-diplomats-confidants" },
  baseGame: { _type: "reference", _ref: "game-courtisans" },
  description: "New characters take a seat at the Queen's table.",
  playersMin: 2,
  playersMax: 6,
}
export const OLD_EXPANSION_DRAFT: Doc = { ...OLD_EXPANSION, _id: `drafts.${OLD_EXPANSION._id}`, _rev: "rev-expansion-draft", name: "Courtisans: Diplomates & Confidants" }

/** The documents of the other types the query never asks for, which a snapshot may hold. */
export const OTHERS: Doc[] = [
  { _id: "creator-antoine-bauza", _type: "creator", name: "Antoine Bauza" },
  { _id: "image-logo-800x600-webp", _type: "sanity.imageAsset", url: "https://cdn.sanity.io/images/mhgqs6fe/production/logo-800x600.webp" },
]

/** A row of a translated field as the plugin of the Studio writes it, its key one the Studio made up. */
export const studioRow = (kind: string, language: string, value?: unknown, key = `k-${language}`) => ({ _key: key, _type: translatedRowType(kind), language, ...(value === undefined ? {} : { value }) })

/** A copy of a document with changes, and fields taken away. */
export const changed = (doc: Doc, changes: Record<string, unknown> = {}, remove: string[] = []): Doc => {
  const copy: Doc = { ...structuredClone(doc), ...structuredClone(changes) }
  for (const field of remove) delete copy[field]
  return copy
}

/** An in-memory dataset. `commits` is every transaction asked for, whether it went through or not; `saved` makes a document change under the migration's feet. */
export class MemoryDataset implements TranslationStore {
  docs = new Map<string, Doc>()
  commits: PatchMutation[][] = []
  private serial = 0

  constructor(docs: readonly Doc[]) {
    for (const doc of docs) this.docs.set(doc._id, structuredClone(doc))
  }

  async documents() {
    return [...this.docs.values()].map((doc) => structuredClone(doc))
  }

  /** Somebody saves the document in the Studio: its revision changes. */
  saved(id: string, changes: Record<string, unknown> = {}) {
    const doc = this.docs.get(id)
    if (!doc) throw new Error(`No document ${id}`)
    this.docs.set(id, { ...doc, ...structuredClone(changes), _rev: `saved-${++this.serial}` })
  }

  async commit(mutations: PatchMutation[]) {
    this.commits.push(structuredClone(mutations))
    const next = new Map(this.docs)
    for (const { patch } of mutations) {
      const doc = next.get(patch.id)
      if (!doc) throw new Error(`Mutation failed: Document by ID "${patch.id}" does not exist.`)
      if (patch.ifRevisionID !== undefined && patch.ifRevisionID !== doc._rev) throw new Error(`Mutation failed: Document "${patch.id}" has revision "${doc._rev}", not "${patch.ifRevisionID}".`)
      const updated: Doc = { ...doc, ...structuredClone(patch.set ?? {}), _rev: `written-${++this.serial}` }
      for (const field of patch.unset ?? []) delete updated[field]
      next.set(patch.id, updated)
    }
    this.docs = next
  }
}

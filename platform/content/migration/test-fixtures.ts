import type { Doc, MigrationStore, Mutation } from "./expansions.ts"

/** A reference as the Studio, or a script that writes as it does, leaves it in a draft whose target is not published: weak, marked to be made strong. */
const weak = (id: string, type: string) => ({ _type: "reference", _ref: id, _weak: true, _strengthenOnPublish: { type } })

/**
 * The game draft that was made as an expansion on 2026-11-02, as the dataset held it before the migration was written (read from the
 * dataset, with its revision and dates). The one document the migration was written for.
 */
export const COURTISANS_DRAFT: Doc = {
  _createdAt: "2026-11-02T11:02:13Z",
  _id: "drafts.game-courtisans-diplomats-confidants",
  _rev: "MhnO5j0Xf0Gda41DlxZ1Hp",
  _type: "game",
  _updatedAt: "2026-11-02T11:02:13Z",
  baseGame: weak("game-courtisans", "game"),
  creators: [
    { _key: "creator-romaric-galonnier", _type: "gameCreator", creator: weak("creator-romaric-galonnier", "creator"), roles: ["designer"] },
    { _key: "creator-anthony-perone", _type: "gameCreator", creator: weak("creator-anthony-perone", "creator"), roles: ["designer"] },
    { _key: "creator-noemie-chevalier", _type: "gameCreator", creator: weak("creator-noemie-chevalier", "creator"), roles: ["artist"] },
  ],
  description:
    "New characters take a seat at the Queen's table. Diplomats and Confidents upset the balance, but also let you form new alliances. This expansion adds two new roles, the Diplomat and the Confident, each with new effects.",
  kind: "expansion",
  minAge: 8,
  name: "Courtisans: Diplomates & Confidents",
  playersMax: 6,
  playersMin: 2,
  publishers: [{ _key: "publisher-catch-up-games", ...weak("publisher-catch-up-games", "publisher") }],
  slug: { _type: "slug", current: "courtisans-diplomats-confidants" },
}

/** The published documents it points at, as the dataset held them (names and types only, which is what the migration looks at). */
export const PUBLISHED_AROUND: Doc[] = [
  { _id: "game-courtisans", _type: "game", name: "Courtisans", kind: "game", slug: { _type: "slug", current: "courtisans" } },
  { _id: "creator-romaric-galonnier", _type: "creator", name: "Romaric Galonnier" },
  { _id: "creator-anthony-perone", _type: "creator", name: "Anthony Perone" },
  { _id: "creator-noemie-chevalier", _type: "creator", name: "Noëmie Chevalier" },
  { _id: "publisher-catch-up-games", _type: "publisher", name: "Catch up Games" },
]

/** A copy of the Courtisans draft with changes, for the cases the migration refuses. */
export const draftWith = (changes: Record<string, unknown>, remove: string[] = []): Doc => {
  const doc: Doc = { ...structuredClone(COURTISANS_DRAFT), ...structuredClone(changes) }
  for (const field of remove) delete doc[field]
  return doc
}

/** The ids of the strong references a document holds (the assets of an image or a file apart): the dataset refuses one to a document that is not published. */
function strongTargets(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(strongTargets)
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._type === "reference" && typeof record._ref === "string") return record._weak === true || /^(image|file)-/.test(record._ref) ? [] : [record._ref]
    return Object.values(record).flatMap(strongTargets)
  }
  return []
}

/** An in-memory dataset with the contract of the real one for what the migration does: a transaction is all or nothing, `create` refuses an id that exists, a strong reference needs a published target. */
export class MemoryDataset implements MigrationStore {
  docs = new Map<string, Doc>()
  /** Every transaction asked for, in order, whether it went through or not. */
  commits: Mutation[][] = []

  constructor(docs: readonly Doc[]) {
    for (const doc of docs) this.docs.set(doc._id, structuredClone(doc))
  }

  async expansionGames() {
    return [...this.docs.values()].filter((doc) => doc._type === "game" && doc.kind === "expansion").map((doc) => structuredClone(doc))
  }

  async getDocuments(ids: string[]) {
    const found = new Map<string, Doc>()
    for (const id of ids) {
      const doc = this.docs.get(id)
      if (doc) found.set(id, structuredClone(doc))
    }
    return found
  }

  async commit(mutations: Mutation[]) {
    this.commits.push(structuredClone(mutations))
    const next = new Map(this.docs)
    for (const mutation of mutations) {
      if ("create" in mutation) {
        const { create } = mutation
        if (next.has(create._id)) throw new Error(`Mutation failed: Document by ID "${create._id}" already exists.`)
        for (const target of strongTargets(create)) {
          if (!next.has(target)) throw new Error(`Mutation failed: Document "${create._id}" references non-existent document "${target}"`)
        }
        next.set(create._id, structuredClone(create))
      } else {
        next.delete(mutation.delete.id)
      }
    }
    this.docs = next
  }
}

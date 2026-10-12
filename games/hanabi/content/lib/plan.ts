import { hasEffect, mergeFill } from "./merge.ts"
import type { Change, DraftOp, PlanItem, SeedDoc, StoredDoc } from "./types.ts"

const DRAFT_PREFIX = "drafts."
const ID_PATTERN = /^[A-Za-z0-9_-]+$/
const SYSTEM_FIELDS = new Set(["_id", "_type", "_rev", "_createdAt", "_updatedAt"])

export const draftIdOf = (id: string) => `${DRAFT_PREFIX}${id}`

/** A seed id is a plain document id. A dot would make it a draft, a release version or a private path. */
export function assertSeedId(id: string): void {
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid seed document id "${id}" (letters, digits, "-" and "_" only)`)
}

/** The only ids the seed may write. */
export function assertDraftId(id: string): void {
  if (!id.startsWith(DRAFT_PREFIX)) throw new Error(`Refusing to write "${id}": only drafts may be written`)
  assertSeedId(id.slice(DRAFT_PREFIX.length))
}

const withoutSystemFields = (doc: StoredDoc): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...doc }
  for (const field of ["_rev", "_createdAt", "_updatedAt"]) delete copy[field]
  return copy
}

/**
 * What to do with one seed document, given what the dataset holds:
 * - nothing there: create the draft
 * - a draft: fill its gaps (the draft is what the Studio shows, so it wins over the published document)
 * - only a published document: fill its gaps in a new draft made from it, and leave the published document alone
 * Values that differ in Sanity are kept and reported, unless `overwrite` is set.
 */
function planDoc(seed: SeedDoc, draft: StoredDoc | undefined, published: StoredDoc | undefined, options: { overwrite: boolean }): PlanItem {
  assertSeedId(seed._id)
  const item = { id: seed._id, draftId: draftIdOf(seed._id), type: seed._type }
  const base = draft ?? published
  if (!base) return { ...item, action: "create", changes: [], doc: { ...seed, _id: item.draftId } }
  if (base._type !== seed._type) throw new Error(`"${base._id}" is a "${base._type}" in the dataset but the seed expects a "${seed._type}"`)

  const fields: Record<string, unknown> = {}
  const changes: Change[] = []
  for (const [key, value] of Object.entries(seed)) {
    if (SYSTEM_FIELDS.has(key)) continue
    const merged = mergeFill(value, base[key], key, options)
    changes.push(...merged.changes)
    if (hasEffect(merged.changes)) fields[key] = merged.value
  }
  if (!hasEffect(changes)) return { ...item, action: "unchanged", changes }
  if (draft) return { ...item, action: "update", changes, set: fields, rev: draft._rev }
  return { ...item, action: "create-from-published", changes, doc: { ...withoutSystemFields(base), ...fields, _id: item.draftId, _type: seed._type } }
}

/** `existing` holds the documents found among the seed ids and their `drafts.` ids. */
export function planDocs(seeds: SeedDoc[], existing: Map<string, StoredDoc>, options: { overwrite: boolean }): PlanItem[] {
  return seeds.map((seed) => planDoc(seed, existing.get(draftIdOf(seed._id)), existing.get(seed._id), options))
}

/** Every id to read for these seeds: the published document and its draft. */
export const idsToRead = (seeds: SeedDoc[]) => seeds.flatMap((seed) => [seed._id, draftIdOf(seed._id)])

/** The writes of a plan. `createIfNotExists` never replaces a draft that appeared since the plan was made; `ifRevisionID` refuses to patch one that was edited since. */
export function toOps(plan: PlanItem[]): DraftOp[] {
  const ops: DraftOp[] = []
  for (const item of plan) {
    if (item.action === "create" || item.action === "create-from-published") {
      if (!item.doc) throw new Error(`Plan for "${item.id}" has no document`)
      ops.push({ type: "createIfNotExists", doc: item.doc })
    } else if (item.action === "update") {
      if (!item.set || !item.rev) throw new Error(`Plan for "${item.id}" has no fields or revision to patch`)
      ops.push({ type: "patch", id: item.draftId, ifRevisionID: item.rev, set: item.set })
    }
  }
  return ops
}

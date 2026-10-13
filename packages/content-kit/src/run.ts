import { loadArt, placeArt, uploadArt } from "./art.ts"
import type { ArtSlot, LoadedArt } from "./art.ts"
import { assertSeedId, idsToRead, planDocs, toOps } from "./plan.ts"
import type { PlanItem, SeedDoc, SeedStore } from "./types.ts"

export type RunOptions = {
  /** Write the drafts. Without it nothing is written or uploaded (dry run). */
  apply: boolean
  /** Replace the values that differ in Sanity instead of keeping them; needs `only` */
  overwrite: boolean
  /** Document ids or types to limit the run to; empty = every document of the seed */
  only: string[]
  /** Folder of art files to normalize and place; without it the art is left alone */
  artDir?: string
}

export type RunResult = {
  mode: "dry-run" | "apply"
  /** Documents in the seed, selected or not */
  seedCount: number
  plan: PlanItem[]
  art?: { dir: string; slotCount: number; loaded: LoadedArt; uploaded: number }
  /** In the dataset, of a type the seed manages, but not in the seed: reported, never touched */
  orphans: string[]
  /** Documents created or patched (apply only) */
  written: number
}

function validate(docs: SeedDoc[], slots: ArtSlot[]): void {
  const ids = new Set<string>()
  for (const doc of docs) {
    assertSeedId(doc._id)
    if (!doc._type) throw new Error(`Seed document "${doc._id}" has no _type`)
    if (ids.has(doc._id)) throw new Error(`Seed document id "${doc._id}" is used twice`)
    ids.add(doc._id)
  }
  for (const slot of slots) {
    if (!ids.has(slot.docId)) throw new Error(`Art slot "${slot.name}" points at "${slot.docId}", which is not in the seed`)
  }
}

function select(docs: SeedDoc[], only: string[]): SeedDoc[] {
  if (!only.length) return docs
  const unknown = only.filter((token) => !docs.some((doc) => doc._id === token || doc._type === token))
  if (unknown.length) {
    const types = [...new Set(docs.map((doc) => doc._type))].join(", ")
    throw new Error(`--only matches nothing: ${unknown.join(", ")} (a document id or one of the types: ${types})`)
  }
  return docs.filter((doc) => only.includes(doc._id) || only.includes(doc._type))
}

/**
 * One run of the seed: plan, and with `apply` write.
 * - Reads only, until `apply`; then it uploads the art, writes the drafts in one transaction, and reads everything back:
 *   a second plan against the written dataset must find nothing to do, or the run fails (idempotency check).
 * - Writes drafts only (`SeedStore.writeDrafts` refuses any other id). A published document is never touched.
 */
export async function run({ store, docs, slots, options }: { store: SeedStore; docs: SeedDoc[]; slots: ArtSlot[]; options: RunOptions }): Promise<RunResult> {
  if (options.overwrite && !options.only.length) throw new Error("--overwrite replaces what was edited in the Studio: say which documents with --only")
  validate(docs, slots)

  const selected = structuredClone(select(docs, options.only))
  const readPlan = async () => planDocs(selected, await store.getDocuments(idsToRead(selected)), { overwrite: options.overwrite })

  let art: LoadedArt | undefined
  if (options.artDir) {
    art = await loadArt({ dir: options.artDir, slots, store, docIds: new Set(selected.map((doc) => doc._id)) })
    placeArt(art, selected)
  }

  const seedIds = new Set(docs.map((doc) => doc._id))
  const managedTypes = [...new Set(docs.map((doc) => doc._type))]
  const orphans = (await store.listDocumentIds(managedTypes)).filter((id) => !seedIds.has(id)).sort()

  let plan = await readPlan()
  const result = (uploaded: number, written: number): RunResult => ({
    mode: options.apply ? "apply" : "dry-run",
    seedCount: docs.length,
    plan,
    art: art && options.artDir ? { dir: options.artDir, slotCount: slots.length, loaded: art, uploaded } : undefined,
    orphans,
    written,
  })
  if (!options.apply) return result(0, 0)

  let uploaded = 0
  if (art) {
    uploaded = await uploadArt(art, store)
    placeArt(art, selected)
    plan = await readPlan()
  }
  const ops = toOps(plan)
  if (ops.length) await store.writeDrafts(ops)

  const pending = (await readPlan()).filter((item) => item.action !== "unchanged")
  if (pending.length) {
    throw new Error(`Idempotency check failed: planning again after the write still finds work to do (${pending.map((item) => `${item.id}: ${item.action}`).join(", ")})`)
  }
  return result(uploaded, ops.length)
}

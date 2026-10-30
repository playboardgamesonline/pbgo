import { createHash } from "node:crypto"
import sharp from "sharp"
import { assetIdOf } from "./art.ts"
import { assertDraftId } from "./plan.ts"
import type { AssetFile, DraftOp, ImageFile, SeedDoc, SeedStore, StoredDoc } from "./types.ts"

/** `Rules.PDF` → `pdf`, as Sanity names the file assets: `file-<sha1>-<extension>`. */
const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf(".")
  return dot > 0 && dot < filename.length - 1 ? filename.slice(dot + 1).toLowerCase() : "bin"
}

/**
 * The targets of the strong references a value holds: a reference that is not weak, and is not the asset of an image or of a file (an
 * upload makes those exist). The dataset refuses a strong reference to a document that is not published, a draft's own included.
 */
function strongTargets(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(strongTargets)
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._type === "reference" && typeof record._ref === "string") return record._weak === true || /^(image|file)-/.test(record._ref) ? [] : [record._ref]
    return Object.values(record).flatMap(strongTargets)
  }
  return []
}

/**
 * An in-memory dataset for the tests: the same contract as the Sanity adapter (`store.ts`), plus helpers that play the Studio
 * (`edit`, `publish`). Writes are atomic and enforce the same rules: drafts only, `createIfNotExists`, `ifRevisionID`.
 */
export class MemoryStore implements SeedStore {
  docs = new Map<string, StoredDoc>()
  /** Content hash → asset id, like the image assets of a dataset */
  assets = new Map<string, string>()
  /** Content hash → asset id, like the file assets of a dataset */
  fileAssets = new Map<string, string>()
  /** Every call of `writeDrafts`, in order */
  writes: DraftOp[][] = []
  uploads: ImageFile[] = []
  fileUploads: AssetFile[] = []
  private revision = 0

  private nextRev() {
    this.revision += 1
    return `rev-${this.revision}`
  }

  /** Puts a document in the dataset as it is (a draft, a published document, anything). */
  put(doc: SeedDoc): StoredDoc {
    const stored: StoredDoc = { ...doc, _rev: this.nextRev() }
    this.docs.set(stored._id, stored)
    return stored
  }

  /** What an editor does in the Studio: changes a document, which gets a new revision. */
  edit(id: string, change: (doc: StoredDoc) => void): void {
    const doc = this.docs.get(id)
    if (!doc) throw new Error(`No document ${id}`)
    const copy = structuredClone(doc)
    change(copy)
    this.docs.set(id, { ...copy, _rev: this.nextRev() })
  }

  /** What "Publish" does: the draft becomes the published document and disappears. */
  publish(id: string): void {
    const draftId = `drafts.${id}`
    const draft = this.docs.get(draftId)
    if (!draft) throw new Error(`No draft ${draftId}`)
    this.docs.delete(draftId)
    this.docs.set(id, { ...draft, _id: id, _rev: this.nextRev() })
  }

  async getDocuments(ids: string[]) {
    const found = new Map<string, StoredDoc>()
    for (const id of ids) {
      const doc = this.docs.get(id)
      if (doc) found.set(id, structuredClone(doc))
    }
    return found
  }

  async listDocumentIds(types: string[]) {
    const ids = [...this.docs.values()].filter((doc) => types.includes(doc._type)).map((doc) => doc._id.replace(/^drafts\./, ""))
    return [...new Set(ids)]
  }

  async findImageAssets(sha1s: string[]) {
    const found = new Map<string, string>()
    for (const sha1 of sha1s) {
      const id = this.assets.get(sha1)
      if (id) found.set(sha1, id)
    }
    return found
  }

  async uploadImage(file: ImageFile) {
    this.uploads.push(file)
    const sha1 = createHash("sha1").update(file.data).digest("hex")
    const known = this.assets.get(sha1)
    if (known) return { _id: known }
    const svg = file.contentType === "image/svg+xml"
    const size = svg ? undefined : await sharp(file.data).metadata()
    const id = assetIdOf({ sha1, ext: svg ? "svg" : "webp", width: size?.width ?? 0, height: size?.height ?? 0 })
    this.assets.set(sha1, id)
    return { _id: id }
  }

  async findFileAssets(sha1s: string[]) {
    const found = new Map<string, string>()
    for (const sha1 of sha1s) {
      const id = this.fileAssets.get(sha1)
      if (id) found.set(sha1, id)
    }
    return found
  }

  async uploadFile(file: AssetFile) {
    this.fileUploads.push(file)
    const sha1 = createHash("sha1").update(file.data).digest("hex")
    const known = this.fileAssets.get(sha1)
    if (known) return { _id: known }
    const id = `file-${sha1}-${extensionOf(file.filename)}`
    this.fileAssets.set(sha1, id)
    return { _id: id }
  }

  async writeDrafts(ops: DraftOp[]) {
    this.writes.push(structuredClone(ops))
    // Check everything first: a transaction is all or nothing
    for (const op of ops) {
      const id = op.type === "createIfNotExists" ? op.doc._id : op.id
      assertDraftId(id)
      if (op.type === "patch") {
        const doc = this.docs.get(op.id)
        if (!doc) throw new Error(`Cannot patch ${op.id}: it does not exist`)
        if (doc._rev !== op.ifRevisionID) throw new Error(`Revision mismatch on ${op.id}`)
      }
      // What is written: a draft that exists is left as it is, a patch writes its fields
      const written = op.type === "createIfNotExists" ? (this.docs.has(id) ? {} : op.doc) : op.set
      for (const target of strongTargets(written)) {
        if (!this.docs.has(target)) throw new Error(`Mutation failed: Document "${id}" references non-existent document "${target}"`)
      }
    }
    for (const op of ops) {
      if (op.type === "createIfNotExists") {
        if (!this.docs.has(op.doc._id)) this.put(structuredClone(op.doc))
      } else {
        const doc = this.docs.get(op.id)
        if (doc) this.docs.set(op.id, { ...doc, ...structuredClone(op.set), _rev: this.nextRev() })
      }
    }
  }
}

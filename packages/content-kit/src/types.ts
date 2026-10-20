/** A Sanity document managed by the seed. `_id` is the published id: the seed only ever writes `drafts.<_id>`. */
export type SeedDoc = { _id: string; _type: string; [field: string]: unknown }

/** A document as read from the dataset, system fields included. */
export type StoredDoc = SeedDoc & { _rev?: string; _createdAt?: string; _updatedAt?: string }

export type ImageValue = { _type: "image"; asset: { _type: "reference"; _ref: string } }

/** What a `file` field holds: a PDF rulebook, a sound… */
export type FileValue = { _type: "file"; asset: { _type: "reference"; _ref: string } }

/**
 * What the seed does with one document:
 * - `create`: no draft and no published document yet
 * - `create-from-published`: a published document exists and gets gaps to fill, so a draft is made from it
 * - `update`: a draft exists and gets gaps to fill
 * - `unchanged`: nothing to add
 */
export type PlanAction = "create" | "create-from-published" | "update" | "unchanged"

export type Change =
  /** The seed value is missing in Sanity and gets added */
  | { kind: "fill"; path: string }
  /** Sanity holds another value: kept (default) */
  | { kind: "diverged"; path: string; seed: unknown; current: unknown }
  /** Sanity holds another value: replaced (`--overwrite`) */
  | { kind: "overwrite"; path: string; seed: unknown; current: unknown }

export type PlanItem = {
  /** Published id */
  id: string
  draftId: string
  type: string
  action: PlanAction
  changes: Change[]
  /** `create` and `create-from-published`: the whole draft */
  doc?: SeedDoc
  /** `update`: the top-level fields to set on the draft */
  set?: Record<string, unknown>
  /** `update`: revision of the draft the plan was made against */
  rev?: string
}

export type DraftOp =
  | { type: "createIfNotExists"; doc: SeedDoc }
  | { type: "patch"; id: string; ifRevisionID: string; set: Record<string, unknown> }

export type AssetFile = { data: Buffer; filename: string; contentType: string }
export type ImageFile = AssetFile

/**
 * Everything the seed asks of a dataset. The real adapter talks to Sanity (`store.ts`), the tests use an in-memory one.
 * Writes only go through `writeDrafts`, which refuses any id that is not a draft.
 */
export interface SeedStore {
  /** The documents found among `ids` (published and `drafts.` ids), keyed by `_id` */
  getDocuments(ids: string[]): Promise<Map<string, StoredDoc>>
  /** Published ids of every document of these types, whatever its state (published, draft, version) */
  listDocumentIds(types: string[]): Promise<string[]>
  /** The image assets whose content hash is in `sha1s`: hash → asset id */
  findImageAssets(sha1s: string[]): Promise<Map<string, string>>
  /** Assets have no draft state: an upload is visible at once, but nothing uses it until a document points at it */
  uploadImage(file: ImageFile): Promise<{ _id: string }>
  /** The file assets (a PDF, not an image) whose content hash is in `sha1s`: hash → asset id */
  findFileAssets(sha1s: string[]): Promise<Map<string, string>>
  /** Same as `uploadImage`, for a file that is not a picture: a rulebook PDF */
  uploadFile(file: AssetFile): Promise<{ _id: string }>
  writeDrafts(ops: DraftOp[]): Promise<void>
}

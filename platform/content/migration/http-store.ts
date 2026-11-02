import type { Doc, MigrationStore, Mutation } from "./expansions.ts"
import type { Doc as CatalogDoc, PatchMutation, TranslationStore } from "./translations.ts"

// The migration's view of the dataset: the project's HTTP API with the write token, a plain `fetch` (no SDK, as the hub's reader), so that
// a test can hand in its own. The token travels in a header only: it is in no address, and no message here repeats it.

/** The API version of the platform's own code (the Studio's tabs and the hub's reader use it too). */
export const API_VERSION = "2025-02-19"

const TIMEOUT_MS = 15_000

/** Ids per request: they travel in the address. */
const CHUNK = 40

export type HttpStoreOptions = {
  projectId: string
  dataset: string
  token: string
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

/** A call the dataset refused or could not answer. The message holds what Sanity says, never the token. */
export class DatasetError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "DatasetError"
    this.status = status
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** What Sanity says went wrong, in a line: its `error.description` or `message`, else the status. */
async function reasonOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    const error = isRecord(body) && isRecord(body.error) ? body.error : isRecord(body) ? body : {}
    const text = [error.description, error.message].find((candidate) => typeof candidate === "string" && candidate !== "")
    if (typeof text === "string") return text.replace(/\p{Cc}/gu, " ").slice(0, 300)
  } catch {
    // not JSON: the status says enough
  }
  return response.statusText || "no reason given"
}

/** The calls of the dataset's HTTP API with the token in a header: what both stores below are made of. */
function connect({ projectId, dataset, token, fetch: send = fetch }: HttpStoreOptions) {
  const base = `https://${projectId}.api.sanity.io/v${API_VERSION}/data`

  async function call(url: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response
    try {
      response = await send(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (error) {
      // Only the kind of failure (TimeoutError, TypeError…): the request holds the token
      throw new DatasetError(`The dataset could not be reached (${error instanceof Error ? error.name : "unknown error"})`, 0)
    }
    if (!response.ok) throw new DatasetError(`The dataset answered ${response.status}: ${await reasonOf(response)}`, response.status)
    return response.json()
  }

  return { base, dataset, call }
}

/** The documents of the types that have translated fields, in every state: the drafts and the versions of a release are there with the published ones. */
export const CATALOG_DOCUMENTS_QUERY = '*[_type in ["game", "expansion", "category"]]'

/** The dataset as the migration of the translated fields (PLT-104) sees it: all the documents of the catalog types, and patches in one transaction. */
export function createTranslationStore(options: HttpStoreOptions): TranslationStore {
  const { base, dataset, call } = connect(options)
  return {
    async documents() {
      // `raw` is the perspective that shows drafts and the versions of a release next to the published documents
      const query = new URLSearchParams({ query: CATALOG_DOCUMENTS_QUERY, perspective: "raw" })
      const body = await call(`${base}/query/${dataset}?${query}`)
      return isRecord(body) && Array.isArray(body.result) ? (body.result as CatalogDoc[]) : []
    },

    async commit(mutations: PatchMutation[]) {
      if (mutations.length === 0) return
      // One request is one transaction: every mutation is applied or none is
      await call(`${base}/mutate/${dataset}?returnIds=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutations }) })
    },
  }
}

export function createHttpStore(options: HttpStoreOptions): MigrationStore {
  const { base, dataset, call } = connect(options)

  return {
    async expansionGames() {
      // `raw` is the perspective that shows drafts and the versions of a release next to the published documents
      const query = new URLSearchParams({ query: '*[_type == "game" && kind == "expansion"]', perspective: "raw" })
      const body = await call(`${base}/query/${dataset}?${query}`)
      return isRecord(body) && Array.isArray(body.result) ? (body.result as Doc[]) : []
    },

    async getDocuments(ids) {
      const found = new Map<string, Doc>()
      for (let i = 0; i < ids.length; i += CHUNK) {
        const body = await call(`${base}/doc/${dataset}/${ids.slice(i, i + CHUNK).map(encodeURIComponent).join(",")}`)
        for (const doc of isRecord(body) && Array.isArray(body.documents) ? body.documents : []) if (isRecord(doc) && typeof doc._id === "string") found.set(doc._id, doc as Doc)
      }
      return found
    },

    async commit(mutations: Mutation[]) {
      if (mutations.length === 0) return
      // One request is one transaction: every mutation is applied or none is
      await call(`${base}/mutate/${dataset}?returnIds=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutations }) })
    },
  }
}

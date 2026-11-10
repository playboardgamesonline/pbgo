import { connect, DatasetError, type HttpStoreOptions } from "../migration/http-store.ts"
import type { Doc, FiguresStore, Mutation } from "./figures.ts"

// The dataset as the figures from BoardGameGeek (PLT-78) see it: the games in every state, and mutations in one transaction. The same HTTP API with the write token as the
// migrations (`migration/http-store.ts`): the token is in a header only, in no address and no message.

/** The games of the catalog in every state: the `raw` perspective shows the drafts and the versions of a release next to the published ones. */
export const GAMES_QUERY = '*[_type == "game"]'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

export function createFiguresStore(options: HttpStoreOptions): FiguresStore {
  const { base, dataset, call } = connect(options)
  return {
    async documents() {
      const query = new URLSearchParams({ query: GAMES_QUERY, perspective: "raw" })
      const body = await call(`${base}/query/${dataset}?${query}`)
      // an answer that is not a list is not an empty dataset: the run would say there is nothing to add
      if (!isRecord(body) || !Array.isArray(body.result)) throw new DatasetError("The dataset answered with something that is not a list of documents", 200)
      return body.result as Doc[]
    },

    async commit(mutations: Mutation[]) {
      if (mutations.length === 0) return
      // One request is one transaction: every mutation is applied or none is
      await call(`${base}/mutate/${dataset}?returnIds=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutations }) })
    },
  }
}

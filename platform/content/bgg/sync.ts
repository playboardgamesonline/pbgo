import type { Doc, Mutation } from "./figures.ts"

// Which complexity is BoardGameGeek's (PLT-78). The weight of a game moves as people vote on BGG, so `content:bgg --refresh` brings it up to date, and it must never undo what the owner
// set by hand. Every weight the script writes, or finds the Studio holding exactly as BGG gave it, is recorded here with the day: a document whose complexity still equals the
// recorded weight is BGG's and is refreshed, one that differs was set by hand and is left alone. The record is one document of the dataset (`bgg-sync`, type `bggSync`) that the
// Studio does not show, not a field of each game: a field would be a draft and a published copy that can disagree, and an "unknown field" in every form until the Studio is redeployed.

export const SYNC_ID = "bgg-sync"
export const SYNC_TYPE = "bggSync"

/** The weight BGG gave a game the last time, and the day (`YYYY-MM-DD`). */
export type SyncRecord = { weight: number; at: string }

export type Sync = { doc: Doc | undefined; games: Readonly<Record<string, SyncRecord>> }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The record in a set of documents, by the id of the game (without the prefix of a draft). A malformed entry is no record. */
export function readSync(docs: readonly Doc[]): Sync {
  const doc = docs.find((candidate) => candidate._id === SYNC_ID && candidate._type === SYNC_TYPE)
  const games: Record<string, SyncRecord> = {}
  if (doc && isRecord(doc.games)) {
    for (const [id, value] of Object.entries(doc.games)) {
      if (isRecord(value) && typeof value.weight === "number" && Number.isFinite(value.weight) && typeof value.at === "string") games[id] = { weight: value.weight, at: value.at }
    }
  }
  return { doc, games }
}

/**
 * The mutations that record these weights: the document made when there is none, then the whole map set in one patch (the keys in order, so that a write is the same text
 * whatever the order it came in), guarded by the revision read when the document exists. Nothing for no update.
 */
export function syncMutations(sync: Sync, updates: Readonly<Record<string, SyncRecord>>): Mutation[] {
  if (Object.keys(updates).length === 0) return []
  const merged = { ...sync.games, ...updates }
  const games = Object.fromEntries(Object.keys(merged).sort().map((id) => [id, merged[id]]))
  return [
    ...(sync.doc ? [] : [{ createIfNotExists: { _id: SYNC_ID, _type: SYNC_TYPE, games: {} } } satisfies Mutation]),
    { patch: { id: SYNC_ID, ...(sync.doc?._rev ? { ifRevisionID: sync.doc._rev } : {}), set: { games } } },
  ]
}

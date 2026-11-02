import { readFileSync } from "node:fs"
import type { Doc, PatchMutation, TranslationStore } from "./translations.ts"

// A file of documents as the dataset the migration reads, so that it can be tried on a backup, or on documents fetched some other way,
// with no token. It is read only: what it is for is a dry run.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const isDoc = (value: unknown): value is Doc => isRecord(value) && typeof value._id === "string" && typeof value._type === "string"

/**
 * The documents of a file: a JSON array of them, the answer of the query API (`{ "result": [ … ] }`), or one document per line (the
 * `data.ndjson` of `sanity dataset export`, the backup). Anything in it that is not a document is an error that says where.
 */
export function parseSnapshot(text: string): Doc[] {
  const trimmed = text.trim()
  if (trimmed === "") return []
  let list: unknown[]
  try {
    const whole: unknown = JSON.parse(trimmed)
    list = Array.isArray(whole) ? whole : isRecord(whole) && Array.isArray(whole.result) ? whole.result : [whole]
  } catch {
    // not one JSON value: one document per line
    list = trimmed.split("\n").flatMap((line, index) => {
      if (line.trim() === "") return []
      try {
        return [JSON.parse(line) as unknown]
      } catch {
        throw new Error(`Line ${index + 1} is not JSON`)
      }
    })
  }
  return list.map((entry, index) => {
    if (!isDoc(entry)) throw new Error(`Entry ${index + 1} is not a document (it needs an _id and a _type)`)
    return entry
  })
}

export function createSnapshotStore(path: string): TranslationStore {
  return {
    async documents() {
      return parseSnapshot(readFileSync(path, "utf8"))
    },
    async commit(_mutations: PatchMutation[]) {
      throw new Error("A snapshot is read only: it makes a dry run")
    },
  }
}

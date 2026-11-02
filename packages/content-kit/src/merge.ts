import type { Change } from "./types.ts"

export type MergeOptions = { overwrite: boolean }
export type MergeResult = { value: unknown; changes: Change[] }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0)

/** Arrays of objects that all carry a `_key` are merged item by item, like Sanity does. */
const isKeyed = (value: unknown[]): value is Record<string, unknown>[] => value.length > 0 && value.every((item) => isObject(item) && typeof item._key === "string")

/**
 * A row of a translated field (`sanity-plugin-internationalized-array`, PLT-104): one per language, `{ _key, _type, language, value }`. The
 * Studio makes up the `_key` of a row it adds, so a row is the same row when it holds the same language, whatever its key.
 */
const isRow = (item: Record<string, unknown>) => typeof item.language === "string" && typeof item._type === "string" && /^internationalizedArray.+Value$/.test(item._type)

/** The place in `items` of the item that `item` stands for: the one that has its `_key`, else, for a row, the row of its language (one row per language in a field, whatever the type of its rows). */
function findItem(items: Record<string, unknown>[], item: Record<string, unknown>): number {
  const byKey = items.findIndex((candidate) => candidate._key === item._key)
  if (byKey >= 0 || !isRow(item)) return byKey
  return items.findIndex((candidate) => isRow(candidate) && candidate.language === item.language)
}

/** Structural equality, blind to the order of object keys (the dataset does not keep it). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && deepEqual(a[key], b[key]))
  }
  return false
}

/** Does at least one change alter the document? A `diverged` value is reported but left as it is. */
export const hasEffect = (changes: Change[]) => changes.some((change) => change.kind !== "diverged")

const join = (path: string, key: string) => (path ? `${path}.${key}` : key)

/**
 * Adds what the seed has and Sanity lacks, and leaves the rest alone:
 * - an empty value (missing, `null`, blank text, empty list) takes the seed value
 * - objects are merged key by key, so what only Sanity has (hotspot, crop, a language added later) survives
 * - arrays of keyed items are merged by `_key` (the rows of a translated field by language); a missing item is inserted after the seed item that precedes it
 * - any other difference is `diverged` and kept, or replaced when `overwrite` is set
 */
export function mergeFill(seed: unknown, base: unknown, path: string, options: MergeOptions): MergeResult {
  if (isEmpty(seed)) return { value: base, changes: [] }
  if (isEmpty(base)) return { value: seed, changes: [{ kind: "fill", path }] }

  if (isObject(seed) && isObject(base)) {
    const value: Record<string, unknown> = { ...base }
    const changes: Change[] = []
    for (const [key, seedValue] of Object.entries(seed)) {
      const merged = mergeFill(seedValue, base[key], join(path, key), options)
      if (merged.changes.length) {
        value[key] = merged.value
        changes.push(...merged.changes)
      }
    }
    return { value: changes.length ? value : base, changes }
  }

  if (Array.isArray(seed) && Array.isArray(base) && isKeyed(seed) && isKeyed(base)) {
    const items = [...base]
    const changes: Change[] = []
    let previous: string | undefined
    for (const item of seed) {
      const at = findItem(items, item)
      if (at >= 0) {
        // the seed item stands for the one that is there, so it has that one's key: a key is not a difference
        const key = items[at]?._key as string
        const merged = mergeFill({ ...item, _key: key }, items[at], `${path}[_key=="${key}"]`, options)
        if (merged.changes.length) {
          items[at] = merged.value as Record<string, unknown>
          changes.push(...merged.changes)
        }
        previous = key
      } else {
        const key = item._key as string
        const after = previous === undefined ? -1 : items.findIndex((candidate) => candidate._key === previous)
        items.splice(after + 1, 0, item)
        changes.push({ kind: "fill", path: `${path}[_key=="${key}"]` })
        previous = key
      }
    }
    return { value: changes.length ? items : base, changes }
  }

  if (deepEqual(seed, base)) return { value: base, changes: [] }
  return options.overwrite
    ? { value: seed, changes: [{ kind: "overwrite", path, seed, current: base }] }
    : { value: base, changes: [{ kind: "diverged", path, seed, current: base }] }
}

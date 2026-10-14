import type { Change } from "./types.ts"

export type MergeOptions = { overwrite: boolean }
export type MergeResult = { value: unknown; changes: Change[] }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0)

/** Arrays of objects that all carry a `_key` are merged item by item, like Sanity does. */
const isKeyed = (value: unknown[]): value is Record<string, unknown>[] => value.length > 0 && value.every((item) => isObject(item) && typeof item._key === "string")

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
 * - arrays of keyed items are merged by `_key`; a missing item is inserted after the seed item that precedes it
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
      const key = item._key as string
      const itemPath = `${path}[_key=="${key}"]`
      const at = items.findIndex((candidate) => candidate._key === key)
      if (at >= 0) {
        const merged = mergeFill(item, items[at], itemPath, options)
        if (merged.changes.length) {
          items[at] = merged.value as Record<string, unknown>
          changes.push(...merged.changes)
        }
      } else {
        const after = previous === undefined ? -1 : items.findIndex((candidate) => candidate._key === previous)
        items.splice(after + 1, 0, item)
        changes.push({ kind: "fill", path: itemPath })
      }
      previous = key
    }
    return { value: changes.length ? items : base, changes }
  }

  if (deepEqual(seed, base)) return { value: base, changes: [] }
  return options.overwrite
    ? { value: seed, changes: [{ kind: "overwrite", path, seed, current: base }] }
    : { value: base, changes: [{ kind: "diverged", path, seed, current: base }] }
}

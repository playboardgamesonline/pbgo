import type { SanityClient } from "next-sanity"

/**
 * An in-memory stand-in for the Sanity client, for the tests of what the gamemaster reads and writes.
 *
 * It does what the real transaction does where the gamemaster depends on it, and refuses (throws) what it does not know, so a
 * test can never pass on a query or a path it silently ignored. Each behaviour below was observed on a throwaway document of a
 * real dataset, and `test-sanity.test.ts` pins them:
 * - the operations of one patch apply in the order `setIfMissing`, `set`, `unset`, `insert`, and the patches of a transaction
 *   apply one after the other, each seeing the ones before;
 * - `set` and `setIfMissing` create the plain objects a path goes through (`a.b.c` on an empty document), but never a list entry:
 *   on `list[_key=="k"].field` with no such entry they do nothing, as `unset` does on a parent or an entry that is missing;
 * - an insert into a list that is not there does nothing, it does not fail;
 * - a patch on a document that does not exist fails the whole transaction, which then writes nothing;
 * - every document a commit touches gets the same `_updatedAt`, a minute later than the previous commit.
 *
 * Queries are matched by shape, and the projection of a query is ignored: a read returns the stored document whole.
 */

export type FakeDoc = { _id: string; _type: string; _updatedAt?: string; [field: string]: unknown }

export type Mutation = {
  createIfNotExists?: FakeDoc
  patch?: {
    id: string
    setIfMissing?: Record<string, unknown>
    set?: Record<string, unknown>
    unset?: string[]
    insert?: { after: string; items: unknown[] }
  }
}

type Fetch = { query: string; params: Record<string, unknown>; options: Record<string, unknown> | undefined }
type Upload = { kind: string; filename?: string; contentType?: string; bytes: number }

/** `_updatedAt` of the documents a test starts with, unless it says otherwise. */
export const T0 = "2026-10-01T10:00:00Z"
/** A moment `seconds` after `T0`, in the format Sanity uses. */
export const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString().replace(".000Z", "Z")

const clone = <T,>(value: T): T => structuredClone(value)

/* ------------------------------------------------------------------ paths: `a.b`, `list[_key=="k"]`, `list[_key=="k"].field` */

type Step = { field: string } | { field: string; key: string }

function parsePath(path: string): Step[] {
  return path.split(".").map((part): Step => {
    const keyed = /^([A-Za-z_][A-Za-z0-9_]*)\[_key=="([^"]+)"\]$/.exec(part)
    if (keyed) return { field: keyed[1]!, key: keyed[2]! }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) return { field: part }
    throw new Error(`test-sanity: unsupported path "${path}"`)
  })
}

type Bag = Record<string, unknown>
const isBag = (v: unknown): v is Bag => !!v && typeof v === "object" && !Array.isArray(v)

/**
 * The object (or list entry) that holds the last step of the path, or null when the path leads nowhere. With `create`, a plain
 * object that is missing along the way is created, as `set` and `setIfMissing` do; a list entry that is not there never is.
 */
function holderOf(doc: Bag, steps: Step[], create: boolean): Bag | null {
  let holder: Bag = doc
  for (const [i, step] of steps.slice(0, -1).entries()) {
    let next: unknown
    if ("key" in step) {
      const list = holder[step.field]
      next = Array.isArray(list) ? (list as Bag[]).find((e) => e._key === step.key) : undefined
    } else {
      next = holder[step.field]
      if (next === undefined && create) {
        // only observed on plain paths: a list entry further down a missing object is not modelled
        if (steps.slice(i + 1).some((s) => "key" in s)) throw new Error(`test-sanity: unsupported path, "${step.field}" is missing and a list entry follows it`)
        next = holder[step.field] = {}
      }
    }
    if (next === undefined) return null
    if (!isBag(next)) {
      if (create) throw new Error(`test-sanity: unsupported path, "${step.field}" holds a value that is not an object`)
      return null
    }
    holder = next
  }
  return holder
}

function setAt(doc: Bag, path: string, value: unknown, onlyIfMissing: boolean) {
  const steps = parsePath(path)
  const last = steps[steps.length - 1]!
  // the gamemaster never sets a whole list entry, and what the real API does with it was not observed
  if ("key" in last) throw new Error(`test-sanity: unsupported path "${path}", a whole list entry cannot be set`)
  const holder = holderOf(doc, steps, true)
  if (!holder) return
  if (onlyIfMissing && last.field in holder) return
  holder[last.field] = clone(value)
}

function unsetAt(doc: Bag, path: string) {
  const steps = parsePath(path)
  const holder = holderOf(doc, steps, false)
  if (!holder) return
  const last = steps[steps.length - 1]!
  if ("key" in last) {
    const list = holder[last.field]
    if (Array.isArray(list)) holder[last.field] = list.filter((e: Bag) => e._key !== last.key)
    return
  }
  delete holder[last.field]
}

function insertInto(doc: Bag, after: string, items: unknown[]) {
  const match = /^([A-Za-z_][A-Za-z0-9_.]*)\[-1\]$/.exec(after)
  if (!match) throw new Error(`test-sanity: unsupported insert position "${after}"`)
  const steps = parsePath(match[1]!)
  const holder = holderOf(doc, steps, false)
  const list = holder?.[steps[steps.length - 1]!.field]
  // a list that is not there is not an error: nothing is inserted
  if (list === undefined) return
  if (!Array.isArray(list)) throw new Error(`test-sanity: cannot insert into "${match[1]}", it is not a list`)
  list.push(...clone(items))
}

/* ------------------------------------------------------------------ the patch builder of the real client */

class FakePatch {
  readonly ops: NonNullable<Mutation["patch"]>
  constructor(id: string) {
    this.ops = { id }
  }
  set(values: Record<string, unknown>) {
    this.ops.set = { ...this.ops.set, ...values }
    return this
  }
  setIfMissing(values: Record<string, unknown>) {
    this.ops.setIfMissing = { ...this.ops.setIfMissing, ...values }
    return this
  }
  /** Replaces the list, like the real builder. */
  unset(paths: string[]) {
    this.ops.unset = paths
    return this
  }
  append(selector: string, items: unknown[]) {
    this.ops.insert = { after: `${selector}[-1]`, items }
    return this
  }
}

/* ------------------------------------------------------------------ the client */

export type FakeSanity = ReturnType<typeof fakeSanity>

/** `initial`: the documents the dataset starts with (published ones and `drafts.` ones), `_updatedAt` defaulting to `T0`. */
export function fakeSanity(initial: FakeDoc[] = []) {
  const docs = new Map<string, FakeDoc>(initial.map((d) => [d._id, { _updatedAt: T0, ...clone(d) }]))
  const fetches: Fetch[] = []
  /** The mutations of each commit, in order. */
  const commits: Mutation[][] = []
  const uploads: Upload[] = []
  let clock = 0

  const readable = (perspective: unknown) => [...docs.values()].filter((d) => perspective === "raw" || !d._id.startsWith("drafts."))

  function fetch(query: string, params: Record<string, unknown> = {}, options?: Record<string, unknown>): Promise<unknown> {
    fetches.push({ query, params, options })
    const perspective = options?.perspective
    const find = (id: string) => readable(perspective).find((d) => d._id === id) ?? null
    const compact = query.replace(/\s+/g, " ").trim()

    if (compact === "*[_id in $ids]{ _id, _updatedAt }") {
      const ids = params.ids as string[]
      return Promise.resolve(readable(perspective).filter((d) => ids.includes(d._id)).map((d) => ({ _id: d._id, _updatedAt: d._updatedAt })))
    }
    // `*[_id == $id][0]{ … }` and `*[_id == "settings"][0]{ … }`: the document, whole (the projections only reshape what is stored)
    const byParam = /^\*\[_id == \$id\]\[0\]/.exec(compact)
    if (byParam) return Promise.resolve(clone(find(params.id as string)))
    const byLiteral = /^\*\[_id == "([^"]+)"\]\[0\]/.exec(compact)
    if (byLiteral) return Promise.resolve(clone(find(byLiteral[1]!)))
    // the skin: `{ "interface": *[_id == "…"][0]{…}, "texts": *[_id == "…"][0]{…} }`
    const skin = /^\{ "interface": \*\[_id == "([^"]+)"\]\[0\].*"texts": \*\[_id == "([^"]+)"\]\[0\]/.exec(compact)
    if (skin) return Promise.resolve({ interface: clone(find(skin[1]!)), texts: clone(find(skin[2]!)) })
    return Promise.reject(new Error(`test-sanity: unsupported query ${compact.slice(0, 120)}`))
  }

  function transaction() {
    const mutations: Mutation[] = []
    const tx = {
      createIfNotExists(doc: FakeDoc) {
        mutations.push({ createIfNotExists: clone(doc) })
        return tx
      },
      patch(id: string, ops: ((patch: FakePatch) => FakePatch) | Record<string, unknown>) {
        const built = typeof ops === "function" ? ops(new FakePatch(id)) : Object.assign(new FakePatch(id), { ops: { id, ...ops } })
        mutations.push({ patch: clone(built.ops) })
        return tx
      },
      serialize: () => clone(mutations),
      async commit() {
        // Atomic: applied to a copy, which replaces the dataset only when every mutation went through
        const next = new Map([...docs].map(([id, d]) => [id, clone(d)]))
        const touched = new Set<string>()
        for (const m of mutations) {
          if (m.createIfNotExists) {
            const doc = m.createIfNotExists
            if (!next.has(doc._id)) next.set(doc._id, clone(doc))
            touched.add(doc._id)
            continue
          }
          const { id, setIfMissing, set, unset, insert } = m.patch!
          const doc = next.get(id)
          if (!doc) throw new Error(`test-sanity: document "${id}" not found`)
          for (const [path, value] of Object.entries(setIfMissing ?? {})) setAt(doc, path, value, true)
          for (const [path, value] of Object.entries(set ?? {})) setAt(doc, path, value, false)
          for (const path of unset ?? []) unsetAt(doc, path)
          if (insert) insertInto(doc, insert.after, insert.items)
          touched.add(id)
        }
        clock += 1
        for (const id of touched) next.get(id)!._updatedAt = at(clock * 60)
        docs.clear()
        for (const [id, d] of next) docs.set(id, d)
        commits.push(clone(mutations))
        return { transactionId: `tx-${commits.length}`, results: [] }
      },
    }
    return tx
  }

  const assets = {
    async upload(kind: string, body: Buffer, options: { filename?: string; contentType?: string } = {}) {
      uploads.push({ kind, filename: options.filename, contentType: options.contentType, bytes: body.length })
      return { _id: `${kind}-${uploads.length}` }
    },
  }

  return {
    client: { fetch, transaction, assets } as unknown as SanityClient,
    docs,
    fetches,
    commits,
    uploads,
    /** The stored document, or undefined. */
    doc: (id: string) => docs.get(id),
    /** The ids of every stored document. */
    ids: () => [...docs.keys()].sort(),
    /** The document ids each commit patched, in order (`createIfNotExists` marked with `+`). */
    touched: () => commits.map((c) => c.map((m) => (m.patch ? m.patch.id : `+${m.createIfNotExists!._id}`))),
  }
}

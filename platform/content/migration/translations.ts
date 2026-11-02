import { PLATFORM_LANGUAGES, translatedRowType } from "@pbgo/studio-kit/constants"
import { TRANSLATED_FIELDS, type TranslatedDocumentType, type TranslatedKind } from "../../apps/studio/schemaTypes/constants.ts"
import { checkRows } from "../../apps/studio/schemaTypes/rules.ts"

// PLT-104: the texts and pictures of the catalog were plain values (a text, a picture) with one field per language for the links to the
// rules; they are now translated field by field, an array of rows `{ language, value }` (`TRANSLATED_FIELDS`). This converts the documents
// that hold the old shape, the published ones and the drafts alike, since the hub reads the published ones and an editor works on the drafts:
// a text becomes the row of English, a picture too, and `rulesFr`, `rulesEn`, `rulesEs` and `rulesDe` become the rows of `rules`.
//
// It also gives every translated field its row of English, empty if need be. The plugin of the Studio puts a missing row of English back when
// a document is opened, which makes a draft of a published document just by opening it: a document that already has the row is left alone.
// So the script is also what a document needs after a translated field is added to the schema, and running it again does nothing more.
//
// `planTranslations` decides what happens and refuses what it cannot convert without losing something or guessing; the rest of this file
// words the plan and runs it against a `TranslationStore` (the dataset, a snapshot of it, or an in-memory one in the tests).

export type Doc = { _id: string; _type: string; _rev?: string; [field: string]: unknown }

/** A document is changed in place: `ifRevisionID` makes the whole transaction fail if somebody saved it since it was read. */
export type PatchMutation = { patch: { id: string; ifRevisionID?: string; set?: Record<string, unknown>; unset?: string[] } }

/** What the migration asks of a dataset. The real one is `http-store.ts`; a snapshot (`snapshot-store.ts`) and the tests' in-memory one stand in for it. */
export interface TranslationStore {
  /** Every document of the types that have translated fields, whatever its state (published, draft, version). Others may be there: they are ignored. */
  documents(): Promise<Doc[]>
  /** All the mutations in one transaction: every one is applied or none is. */
  commit(mutations: PatchMutation[]): Promise<void>
}

type Row = Record<string, unknown>

/** The four fields that held the link to the rules before: one per language of the games, which `rules` replaces (in the order of the platform's languages). */
export const LEGACY_RULES_FIELDS: Readonly<Record<string, string>> = { en: "rulesEn", fr: "rulesFr", es: "rulesEs", de: "rulesDe" }

const ENGLISH = PLATFORM_LANGUAGES[0].id
const ORDER: readonly string[] = PLATFORM_LANGUAGES.map((language) => language.id)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** What nobody wrote: no value, or an empty text. A blank text is a text, and is kept as it is. */
const isNothing = (value: unknown): boolean => value === undefined || value === null || value === ""

const DRAFT = "drafts."
const VERSION = "versions."

const show = (value: unknown): string => {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 40 ? `${text.slice(0, 37)}…` : text
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && deepEqual(a[key], b[key]))
  }
  return false
}

/** A row of a translated field of this kind: its key is its language, which a row the Studio adds does not need to be. */
const rowOf = (kind: TranslatedKind, language: string, value?: unknown): Row => ({ _key: language, _type: translatedRowType(kind), language, ...(value === undefined ? {} : { value }) })

/** Puts a row where the plugin puts it: before the first row of a language that comes after its own in the platform's order, else at the end. */
function insert(rows: Row[], row: Row): void {
  const place = ORDER.indexOf(String(row.language))
  const next = rows.findIndex((candidate) => ORDER.indexOf(String(candidate.language)) > place)
  rows.splice(next < 0 ? rows.length : next, 0, row)
}

/** What a translated field needs: its rows after, what to take away, and how it is said in the dry run (in short, and for the one document). A field that needs nothing has `rows` equal to what it holds. */
type FieldResult = { rows: Row[]; unset: string[]; summary: string; detail: string }

/**
 * The rows of one translated field of a document, from what the document holds: rows already (kept, the missing row of English added), the
 * old plain value (the row of English), the old fields of the rules (a row per language), or nothing (the empty row of English). Pushes to
 * `problems` and answers nothing for what it cannot convert without losing it or guessing.
 */
function convertField(doc: Doc, name: string, kind: TranslatedKind, problems: string[]): FieldResult | undefined {
  const at = `${doc._id}: ${name}`
  const current = doc[name]
  const rows: Row[] = []
  const unset: string[] = []
  const notes: string[] = []
  // what is said of the one document when it says more than the summary
  const details: string[] = []

  if (Array.isArray(current)) {
    const wrong = checkRows(current)
    if (wrong !== true) {
      problems.push(`${at}: ${wrong.message}`)
      return undefined
    }
    for (const row of current) {
      if (!isRecord(row) || typeof row._key !== "string" || row._key === "") {
        problems.push(`${at}: a row has no _key (${show(row)})`)
        return undefined
      }
      rows.push(structuredClone(row))
    }
  } else if (!isNothing(current)) {
    // the old shape: a plain value that was the English one
    const held = kind === "image" ? "a picture" : "a text"
    // `names` and `rules` held no plain value before: the first is new, the second was four fields
    const neverPlain = kind === "localizedName" || name === "rules"
    if (neverPlain || !(kind === "image" ? isRecord(current) : typeof current === "string")) {
      problems.push(`${at}: it holds ${show(current)}, which is not ${neverPlain ? "rows of a language" : `rows of a language, nor ${held}, what it held before`}`)
      return undefined
    }
    rows.push(rowOf(kind, ENGLISH, structuredClone(current)))
    notes.push(kind === "image" ? "a picture → English" : "a text → English")
  }

  if (name === "rules") {
    const converted: string[] = []
    for (const [language, field] of Object.entries(LEGACY_RULES_FIELDS)) {
      if (!(field in doc)) continue
      const link = doc[field]
      unset.push(field)
      if (isNothing(link)) continue
      if (typeof link !== "string") {
        problems.push(`${doc._id}: ${field} holds ${show(link)}, which is not a link`)
        return undefined
      }
      const row = rows.find((candidate) => candidate.language === language)
      if (!row) insert(rows, rowOf("url", language, link))
      else if (isNothing(row.value)) row.value = link
      else if (row.value !== link) {
        problems.push(`${doc._id}: ${field} is ${show(link)} and the row of ${language} in rules is ${show(row.value)}: it holds two links for one language, settle it in the Studio`)
        return undefined
      }
      converted.push(language)
    }
    if (converted.length > 0) {
      notes.push("the old links → rows")
      details.push(`${unset.filter((field) => !isNothing(doc[field])).join(", ")} → ${converted.join(", ")}`)
    }
  }

  // the row of English every translated field has, empty when nothing is there: the plugin would write it when the document is opened
  if (!rows.some((row) => row.language === ENGLISH)) {
    insert(rows, rowOf(kind, ENGLISH))
    if (notes.length === 0) notes.push(Array.isArray(current) ? "no English row → an empty one" : "nothing → an empty English row")
  }
  const summary = notes.length > 0 ? notes.join("; ") : "rows (kept)"
  return { rows, unset, summary, detail: details.length > 0 ? details.join("; ") : summary }
}

/** What happens to one document: the translated fields it needs written, the old ones taken away, and a line for each field for the dry run. */
export type Conversion = {
  id: string
  type: TranslatedDocumentType
  state: "published" | "draft"
  rev: string | undefined
  /** The fields to write, each as the whole array of its rows. */
  set: Record<string, unknown>
  /** The fields of the old model to take away. */
  unset: string[]
  /** `[field, what it was and becomes in short, the same for this document]` for each field that changes. */
  notes: [string, string, string][]
}

export type Plan = {
  /** How many documents of each type the dataset holds, published and drafts: what was looked at. */
  found: Record<string, { published: number; drafts: number }>
  conversions: Conversion[]
  /** The documents that have what they need already. */
  unchanged: number
  /** Why the plan cannot be run: when there is one, nothing is written. */
  problems: string[]
}

const isCatalogType = (type: unknown): type is TranslatedDocumentType => typeof type === "string" && Object.prototype.hasOwnProperty.call(TRANSLATED_FIELDS, type)

/**
 * What to do with the documents of the dataset. A document of a type that has translated fields is converted wherever it stands, published
 * or draft; one in a release (a version) has a state the migration does not guess at, and stops it. So does anything it would have to lose or
 * guess: a field that is neither rows nor the old value, a row that is not of a language of the platform, a language twice, two links for
 * one language (a row of `rules` and the old field of the language that differ). When there is a problem, nothing is written at all.
 */
export function planTranslations(docs: readonly Doc[]): Plan {
  const problems: string[] = []
  const conversions: Conversion[] = []
  const found: Plan["found"] = Object.fromEntries(Object.keys(TRANSLATED_FIELDS).map((type) => [type, { published: 0, drafts: 0 }]))
  let unchanged = 0

  for (const doc of docs) {
    if (!isCatalogType(doc._type)) continue
    if (doc._id.startsWith(VERSION)) {
      problems.push(`${doc._id}: it is a version in a release: the migration converts published documents and drafts only. Publish or discard it first`)
      continue
    }
    const state = doc._id.startsWith(DRAFT) ? "draft" : "published"
    const count = found[doc._type]
    if (count) count[state === "draft" ? "drafts" : "published"] += 1

    const set: Record<string, unknown> = {}
    const unset: string[] = []
    const notes: [string, string, string][] = []
    const before = problems.length
    for (const [name, kind] of Object.entries(TRANSLATED_FIELDS[doc._type] as Record<string, TranslatedKind>)) {
      const result = convertField(doc, name, kind, problems)
      if (!result) continue
      const changes = result.unset.length > 0 || !deepEqual(result.rows, doc[name])
      if (changes) {
        set[name] = result.rows
        notes.push([name, result.summary, result.detail])
      }
      unset.push(...result.unset)
    }
    if (problems.length > before) continue
    if (Object.keys(set).length === 0 && unset.length === 0) unchanged += 1
    else conversions.push({ id: doc._id, type: doc._type, state, rev: doc._rev, set, unset, notes })
  }

  return { found, conversions, unchanged, problems }
}

/** The transaction of a plan: one patch for each document, which refuses the document if it was saved since it was read. */
export const mutationsOf = (plan: Plan): PatchMutation[] =>
  plan.conversions.map(({ id, rev, set, unset }) => ({ patch: { id, ...(rev ? { ifRevisionID: rev } : {}), ...(Object.keys(set).length > 0 ? { set } : {}), ...(unset.length > 0 ? { unset } : {}) } }))

/** The document as it will be, from the one that was read: what the patch does to it. */
export function applied(doc: Doc, conversion: Conversion): Doc {
  const next: Doc = { ...doc, ...structuredClone(conversion.set) }
  for (const field of conversion.unset) delete next[field]
  return next
}

/** What a run did: `dry-run` wrote nothing because it was not asked to, `stopped` was asked to write and did not (a problem to settle, or nothing to convert), `applied` wrote. */
export type Mode = "dry-run" | "applied" | "stopped"

export type Words = {
  projectId: string
  dataset: string
  mode: Mode
  /** Where the documents came from, when it is not the dataset. */
  source?: string
  /** A line for each document. */
  verbose?: boolean
  /** The id of a document whose patch is printed in full. */
  show?: string
}

const HEADERS: Record<Mode, string> = { "dry-run": ": DRY RUN, nothing is written", stopped: ": NOTHING WRITTEN", applied: ": WRITTEN" }

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** The plan in words, for a terminal: what was looked at, what is converted field by field, then a line for each document, and what stops it. */
export function describePlan(plan: Plan, { projectId, dataset, mode, source, verbose = false, show }: Words): string {
  const lines = [`Translated fields (PLT-104) on ${projectId}/${dataset}${HEADERS[mode]}`]
  if (source) lines.push(`Read from ${source}, not from the dataset.`)
  lines.push("")
  for (const [type, { published, drafts }] of Object.entries(plan.found)) {
    lines.push(`${type.padEnd(10)} ${plural(published, "published document")}, ${plural(drafts, "draft")}`)
  }
  lines.push("", `${plural(plan.conversions.length, "document")} to convert, ${plan.unchanged} already as they should be.`)

  // field by field: how many documents of a type change it, and how
  const tally = new Map<string, number>()
  for (const conversion of plan.conversions) for (const [field, summary] of conversion.notes) tally.set(`${conversion.type}.${field}  ${summary}`, (tally.get(`${conversion.type}.${field}  ${summary}`) ?? 0) + 1)
  if (tally.size > 0) {
    lines.push("", "What changes, field by field:")
    const rows = [...tally].sort(([a], [b]) => a.localeCompare(b))
    const width = Math.max(...rows.map(([key]) => key.length))
    for (const [key, count] of rows) lines.push(`  ${key.padEnd(width)}  ${String(count).padStart(4)}`)
  }
  const taken = new Set(plan.conversions.flatMap((conversion) => conversion.unset))
  if (taken.size > 0) lines.push("", `Taken away, once their links are rows of rules: ${[...taken].sort().join(", ")}.`)
  // the links the rows of rules will hold, by language: what the old fields held, to check against the Studio
  const links = new Map<string, number>()
  for (const conversion of plan.conversions) {
    for (const entry of (conversion.set.rules as Row[] | undefined) ?? []) if (!isNothing(entry.value)) links.set(String(entry.language), (links.get(String(entry.language)) ?? 0) + 1)
  }
  if (links.size > 0) lines.push(`Links to the rules, by language: ${ORDER.filter((language) => links.has(language)).map((language) => `${language} ${links.get(language)}`).join(", ")}.`)

  if (verbose) {
    lines.push("")
    for (const conversion of plan.conversions) {
      lines.push(`${conversion.id}  (${conversion.type}, ${conversion.state}${conversion.rev ? `, revision ${conversion.rev}` : ""})`)
      for (const [field, , detail] of conversion.notes) lines.push(`  ${field}: ${detail}`)
      if (conversion.unset.length > 0) lines.push(`  unset: ${conversion.unset.join(", ")}`)
    }
  }

  if (show !== undefined) {
    const conversion = plan.conversions.find((candidate) => candidate.id === show)
    const mutation = conversion ? mutationsOf({ ...plan, conversions: [conversion] })[0] : undefined
    lines.push("", mutation ? `The patch of ${show}, as it is sent:` : `${show} is not a document to convert.`)
    if (mutation) lines.push(JSON.stringify(mutation, null, 2).replace(/^/gm, "  "))
  }

  if (plan.problems.length > 0) {
    lines.push("", "Nothing can be converted until this is settled:", ...plan.problems.map((problem) => `  - ${problem}`))
  } else if (plan.conversions.length === 0) {
    lines.push("", "Nothing to convert.")
  } else {
    lines.push(
      "",
      mode === "applied"
        ? "Written in one transaction, then read back."
        : "Nothing was written. Run again with --apply to write it, in one transaction: each document is patched in place, and refused if it was saved since it was read.",
    )
  }
  return lines.join("\n")
}

export type Outcome = {
  plan: Plan
  mode: Mode
  /** What the dataset holds after a write that is not what the plan said: empty when it was read back right. */
  afterProblems: string[]
}

/**
 * Plans the migration against the dataset and, with `apply`, runs it in one transaction. Nothing is written when there is nothing to
 * convert or a problem to settle. After a write the dataset is read back: every document is as planned, and planning again finds nothing.
 */
export async function migrate(store: TranslationStore, { apply }: { apply: boolean }): Promise<Outcome> {
  const docs = await store.documents()
  const plan = planTranslations(docs)
  if (!apply) return { plan, mode: "dry-run", afterProblems: [] }
  // a patch without its revision would overwrite whatever was saved since the document was read
  const unguarded = plan.conversions.filter((conversion) => !conversion.rev).map((conversion) => `${conversion.id}: it has no revision, which the dataset always sends: refusing to patch it unguarded`)
  if (unguarded.length > 0) plan.problems.push(...unguarded)
  if (plan.problems.length > 0 || plan.conversions.length === 0) return { plan, mode: "stopped", afterProblems: [] }

  await store.commit(mutationsOf(plan))
  const after = await store.documents()
  const byId = new Map(after.map((doc) => [doc._id, doc]))
  const afterProblems: string[] = []
  for (const conversion of plan.conversions) {
    const doc = byId.get(conversion.id)
    if (!doc) {
      afterProblems.push(`${conversion.id} is not in the dataset after the write`)
      continue
    }
    for (const [field, value] of Object.entries(conversion.set)) if (!deepEqual(doc[field], value)) afterProblems.push(`${conversion.id}.${field} is not what the plan said after the write`)
    for (const field of conversion.unset) if (field in doc) afterProblems.push(`${conversion.id}.${field} is still there after the write`)
  }
  const again = planTranslations(after)
  if (again.conversions.length > 0) afterProblems.push(`Planning again after the write still finds ${plural(again.conversions.length, "document")} to convert: ${again.conversions.map((conversion) => conversion.id).slice(0, 5).join(", ")}`)
  return { plan, mode: "applied", afterProblems }
}


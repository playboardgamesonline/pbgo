import { createHash } from "node:crypto"
import type { Stats } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, extname, join, resolve } from "node:path"
import { LANGUAGE_IDS } from "./locale.ts"
import type { LanguageId } from "./locale.ts"
import { run } from "./run.ts"
import type { FileValue, PlanAction, PlanItem, SeedDoc, SeedStore } from "./types.ts"

// A game's rulebooks: the PDF of the rules, one per language, placed in the `file` fields of the `settings` singleton as a DRAFT.
// It goes through the same pipeline as the seed (`run`): drafts only, a field that is empty gets filled, a value edited in the
// Studio is kept unless `--overwrite` says otherwise, and planning again after the write must find nothing to do.

/** The singleton that holds the rulebooks: its type and its id are both `settings`. */
export const SETTINGS_ID = "settings"

/** The language of a rulebook given without one (`--rules rules.pdf`). */
export const DEFAULT_RULEBOOK_LANGUAGE: LanguageId = "en"

/** A rules PDF weighs a few megabytes: far more is probably the wrong file. */
export const MAX_RULEBOOK_BYTES = 50 * 1024 * 1024

/**
 * The `file` field of `settings` for each language (`packages/studio-kit/src/documents/settings.ts`; `rulebook.test.ts` pins the names
 * against the Studio schema). A language added to `LANGUAGES` makes this record fail to typecheck until it has its field.
 */
const FIELDS: Record<LanguageId, string> = {
  fr: "rulesPdfFrFile",
  en: "rulesPdfEnFile",
  es: "rulesPdfEsFile",
  de: "rulesPdfDeFile",
}

export const rulebookField = (language: LanguageId) => FIELDS[language]

/** The title of the field in the Studio, which is how the report names it. */
export const rulebookTitle = (language: LanguageId) => `Rules PDF (${language.toUpperCase()})`

/** A rulebook that cannot be used, or a command line that names none: the message says what to fix. */
export class RulebookError extends Error {}

/** A rulebook as asked for: a language and where the file is. */
export type RulebookInput = { language: LanguageId; path: string }

/** A rulebook that was read and checked. */
export type Rulebook = {
  language: LanguageId
  /** The `file` field of `settings` it fills */
  field: string
  /** Where it was read from (absolute) */
  path: string
  /** Its name in Sanity: the name on disk, with a lowercase `.pdf` */
  filename: string
  data: Buffer
  /** Content hash, which is how Sanity recognizes a file it already holds */
  sha1: string
}

const isLanguage = (value: string): value is LanguageId => (LANGUAGE_IDS as string[]).includes(value)

/** `1.9 MB`, `640 KB`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** What a person types or drops into a terminal for a path: quotes, escaped spaces (`My\ Rules.pdf`) and a leading `~` are understood. */
export function cleanPath(raw: string, home: string = homedir()): string {
  let text = raw.trim()
  const quote = text[0]
  if ((quote === '"' || quote === "'") && text.length > 1 && text.endsWith(quote)) text = text.slice(1, -1)
  else text = text.replace(/\\(.)/g, "$1")
  if (text === "~") return home
  if (text.startsWith("~/")) return join(home, text.slice(2))
  return text
}

const LANGUAGE_PREFIX = /^([A-Za-z]{2,3})=(.*)$/s

/**
 * `fr=./regles.pdf` is the French rulebook; a path alone is the English one (`DEFAULT_RULEBOOK_LANGUAGE`).
 * A short word before `=` that is not a language of the site is refused, not read as the start of a file name.
 */
export function parseRulebookArg(arg: string): RulebookInput {
  const text = arg.trim()
  const match = LANGUAGE_PREFIX.exec(text)
  if (!match) {
    if (!text) throw new RulebookError("A rulebook needs a file: --rules [<language>=]<file.pdf>")
    return { language: DEFAULT_RULEBOOK_LANGUAGE, path: text }
  }
  const prefix = (match[1] ?? "").toLowerCase()
  if (!isLanguage(prefix)) {
    throw new RulebookError(`"${match[1]}" is not a language of the site (${LANGUAGE_IDS.join(", ")}) in "${text}". If the file really is named like that, write ./${text}`)
  }
  const path = (match[2] ?? "").trim()
  if (!path) throw new RulebookError(`The ${prefix} rulebook needs a file: --rules ${prefix}=<file.pdf>`)
  return { language: prefix, path }
}

/** Every `--rules` value, one rulebook per language. */
export function parseRulebookArgs(args: string[]): RulebookInput[] {
  const inputs: RulebookInput[] = []
  for (const arg of args) {
    const input = parseRulebookArg(arg)
    const same = inputs.find((other) => other.language === input.language)
    if (same) {
      throw new RulebookError(`Two rulebooks for "${input.language}": ${same.path} and ${input.path}. A game has one per language, so name the language of each: --rules fr=… --rules en=…`)
    }
    inputs.push(input)
  }
  return inputs
}

/** The name a file gets in Sanity: the one it has on disk, with a lowercase `.pdf` whatever it was called. */
const pdfName = (file: string) => `${basename(file, extname(file)).replace(/^\.+/, "") || "rulebook"}.pdf`

/** Reads a rulebook and checks it is what it says: a file, not empty, not huge, and a PDF. */
export async function loadRulebook(input: RulebookInput, { cwd = process.cwd(), maxBytes = MAX_RULEBOOK_BYTES }: { cwd?: string; maxBytes?: number } = {}): Promise<Rulebook> {
  const file = resolve(cwd, cleanPath(input.path))
  const fail = (reason: string) => new RulebookError(`Rulebook ${input.language}: ${reason}`)

  let info: Stats
  try {
    info = await stat(file)
  } catch (error) {
    throw fail((error as NodeJS.ErrnoException).code === "ENOENT" ? `there is no file at ${file}` : `${file} cannot be read`)
  }
  if (!info.isFile()) throw fail(`${file} is not a file`)
  if (info.size === 0) throw fail(`${file} is empty`)
  if (info.size > maxBytes) throw fail(`${file} weighs ${formatSize(info.size)}, more than the ${formatSize(maxBytes)} a rulebook may`)

  const data = await readFile(file)
  // The PDF header may follow a few bytes of junk, but not more than a kilobyte of it
  if (!data.subarray(0, 1024).includes("%PDF-")) throw fail(`${file} is not a PDF (it does not start with %PDF-)`)

  return { language: input.language, field: rulebookField(input.language), path: file, filename: pdfName(file), data, sha1: createHash("sha1").update(data).digest("hex") }
}

/** Every rulebook, or every problem (a line each, in the order asked), so that a person fixes them all in one go. */
export async function loadRulebooks(inputs: RulebookInput[], options?: { cwd?: string; maxBytes?: number }): Promise<Rulebook[]> {
  const settled = await Promise.allSettled(inputs.map((input) => loadRulebook(input, options)))
  const rulebooks: Rulebook[] = []
  const problems: string[] = []
  for (const entry of settled) {
    if (entry.status === "fulfilled") rulebooks.push(entry.value)
    else problems.push(entry.reason instanceof Error ? entry.reason.message : String(entry.reason))
  }
  if (problems.length) throw new RulebookError(problems.join("\n"))
  return rulebooks
}

/** What a `file` field holds once it points at an asset. */
export const fileRef = (assetId: string): FileValue => ({ _type: "file", asset: { _type: "reference", _ref: assetId } })

/** How Sanity names a PDF asset (`file-<sha1>-<extension>`), used to plan before the upload; the answer of the upload is what gets written. */
export const expectedFileAssetId = (sha1: string) => `file-${sha1}-pdf`

/** The `settings` document the run seeds: the `file` field of each rulebook, nothing else. */
export function rulebookDoc(rulebooks: Rulebook[], assetIds: ReadonlyMap<string, string>): SeedDoc {
  const doc: SeedDoc = { _id: SETTINGS_ID, _type: "settings" }
  for (const rulebook of rulebooks) doc[rulebook.field] = fileRef(assetIds.get(rulebook.sha1) ?? expectedFileAssetId(rulebook.sha1))
  return doc
}

/**
 * What the run does with the `file` field of one rulebook:
 * - `placed`: the field was empty and gets the file
 * - `replaced`: the field held another file and gets this one (`--overwrite`)
 * - `already`: the field holds this very file
 * - `kept`: the field holds another file, which stays (without `--overwrite`)
 */
export type RulebookOutcome = "placed" | "replaced" | "already" | "kept"

const isPlacing = (outcome: RulebookOutcome) => outcome === "placed" || outcome === "replaced"

const touches = (path: string, field: string) => path === field || path.startsWith(`${field}.`)

/** A different file is reported on `<field>.asset._ref`, a missing one on `<field>.asset`: both belong to the field. */
function outcomeOf(item: PlanItem, field: string): RulebookOutcome {
  // A draft made from nothing holds the whole seed
  if (item.action === "create") return "placed"
  const changes = item.changes.filter((change) => touches(change.path, field))
  if (changes.some((change) => change.kind === "overwrite")) return "replaced"
  if (changes.some((change) => change.kind === "diverged")) return "kept"
  if (changes.some((change) => change.kind === "fill")) return "placed"
  return "already"
}

export type RulebookPlacement = {
  rulebook: Rulebook
  outcome: RulebookOutcome
  /** Its content was in the dataset before this run: nothing is uploaded for it */
  stored: boolean
}

export type RulebookResult = {
  mode: "dry-run" | "apply"
  placements: RulebookPlacement[]
  /** What the run does with the `settings` document */
  action: PlanAction
  /** Files sent to Sanity, or that would be (a file already in the dataset is reused, and a file nothing uses is not sent) */
  uploads: number
  /** Documents written (apply only) */
  written: number
}

function placementsOf(plan: PlanItem[], rulebooks: Rulebook[], known: ReadonlyMap<string, string>): { item: PlanItem; placements: RulebookPlacement[] } {
  const item = plan.find((candidate) => candidate.id === SETTINGS_ID)
  if (!item) throw new Error(`The plan has no "${SETTINGS_ID}" document`)
  return { item, placements: rulebooks.map((rulebook) => ({ rulebook, outcome: outcomeOf(item, rulebook.field), stored: known.has(rulebook.sha1) })) }
}

const uploadsOf = (placements: RulebookPlacement[]) => new Set(placements.filter(({ outcome, stored }) => isPlacing(outcome) && !stored).map(({ rulebook }) => rulebook.sha1))

/**
 * Places the rulebooks in the draft of `settings`.
 * - Without `apply` it reads the dataset and says what would happen: nothing is written or uploaded.
 * - With it, the files that will be placed and are not in the dataset yet are uploaded (an asset has no draft state, but nothing uses
 *   it until the document points at it), then the draft is written, like a seed run. A file already in the dataset is reused.
 * - `overwrite` replaces the file a field holds; without it, it stays.
 * The published `settings` is never touched.
 */
export async function placeRulebooks({ store, rulebooks, apply, overwrite = false }: { store: SeedStore; rulebooks: Rulebook[]; apply: boolean; overwrite?: boolean }): Promise<RulebookResult> {
  if (!rulebooks.length) throw new RulebookError("No rulebook to place: give one with --rules [<language>=]<file.pdf>")
  for (const rulebook of rulebooks) {
    if (rulebooks.some((other) => other !== rulebook && other.language === rulebook.language)) throw new RulebookError(`Two rulebooks for "${rulebook.language}": a game has one per language`)
  }
  const options = { overwrite, only: overwrite ? [SETTINGS_ID] : [] }

  const known = await store.findFileAssets([...new Set(rulebooks.map((rulebook) => rulebook.sha1))])
  // The first plan only needs to know what the fields will say, not what the dataset will call a file it does not hold yet
  const first = await run({ store, docs: [rulebookDoc(rulebooks, known)], slots: [], options: { ...options, apply: false } })
  const planned = placementsOf(first.plan, rulebooks, known)
  if (!apply) return { mode: "dry-run", placements: planned.placements, action: planned.item.action, uploads: uploadsOf(planned.placements).size, written: 0 }

  const assetIds = new Map(known)
  for (const sha1 of uploadsOf(planned.placements)) {
    const rulebook = rulebooks.find((candidate) => candidate.sha1 === sha1)
    if (!rulebook) continue
    const asset = await store.uploadFile({ data: rulebook.data, filename: rulebook.filename, contentType: "application/pdf" })
    assetIds.set(sha1, asset._id)
  }

  const result = await run({ store, docs: [rulebookDoc(rulebooks, assetIds)], slots: [], options: { ...options, apply: true } })
  const done = placementsOf(result.plan, rulebooks, known)
  return { mode: "apply", placements: done.placements, action: done.item.action, uploads: uploadsOf(planned.placements).size, written: result.written }
}

const ACTION_WORDS: Record<PlanAction, string> = {
  create: "new draft",
  "create-from-published": "new draft made from the published document",
  update: "existing draft, rulebooks added",
  unchanged: "draft untouched",
}

/** What the report says about one rulebook. */
function phrase({ rulebook, outcome }: RulebookPlacement, mode: RulebookResult["mode"]): string {
  const field = `"${rulebookTitle(rulebook.language)}"`
  const done = mode === "apply"
  switch (outcome) {
    case "placed":
      return done ? `placed in ${field}` : `to place in ${field}`
    case "replaced":
      return done ? `replaced what ${field} held (--overwrite)` : `to replace what ${field} holds (--overwrite)`
    case "already":
      return `${field} holds this file already`
    case "kept":
      return `${field} holds another file, kept (--overwrite replaces it)`
  }
}

/** What `check` prints: every rulebook that was read, and nothing sent anywhere. */
export function formatRulebookList(rulebooks: Rulebook[]): string {
  const width = Math.max(...rulebooks.map((rulebook) => rulebook.filename.length))
  return [
    "Rulebooks read (nothing is sent anywhere):",
    ...rulebooks.map((rulebook) => `  ${rulebook.language}  ${rulebook.filename.padEnd(width)}  ${formatSize(rulebook.data.length).padStart(8)}  PDF, goes in "${rulebookTitle(rulebook.language)}"`),
  ].join("\n")
}

/** The summary printed after `place`. It has no access to the token, so it cannot leak it. */
export function formatRulebookReport(result: RulebookResult, { projectId, dataset }: { projectId: string; dataset: string }): string {
  const { placements, mode } = result
  const lines: string[] = [`Rulebooks · project ${projectId} · dataset ${dataset}`, ""]
  const work = placements.some(({ outcome }) => isPlacing(outcome))

  if (mode === "dry-run") lines.push(`DRY RUN: nothing was written or uploaded.${work ? " Run again with --apply to place the rulebooks." : ""}`)
  else lines.push(`APPLIED: ${placements.filter(({ outcome }) => isPlacing(outcome)).length} rulebook(s) placed in the draft of Settings (Mechanics tab). Nothing is published.`)
  lines.push("")

  const width = Math.max(...placements.map(({ rulebook }) => rulebook.filename.length))
  for (const placement of placements) {
    const { rulebook } = placement
    lines.push(`  ${rulebook.language}  ${rulebook.filename.padEnd(width)}  ${formatSize(rulebook.data.length).padStart(8)}  ${phrase(placement, mode)}`)
  }

  const reused = new Set(placements.filter(({ outcome, stored }) => isPlacing(outcome) && stored).map(({ rulebook }) => rulebook.sha1)).size
  lines.push("", `Settings: ${ACTION_WORDS[result.action]}`)
  lines.push(mode === "apply" ? `Files: ${result.uploads} uploaded, ${reused} already in the dataset` : `Files: ${result.uploads} to upload, ${reused} already in the dataset`)

  lines.push("")
  if (mode === "apply") lines.push("Verified: planning again after the write finds nothing to do, so running it again changes nothing. Open the Studio (Settings › Mechanics), check the draft and publish it.")
  else if (work) lines.push("Next: run with --apply. Only a draft of Settings is written; publishing stays a Studio action.")
  else lines.push("Next: nothing to place, the dataset already has what was asked.")
  return lines.join("\n")
}

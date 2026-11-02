import type { SeedDoc } from "@pbgo/content-kit"
import { expansionId, reference } from "../data/ids.ts"

// PLT-102: an expansion was a `game` with `kind: "expansion"`; it is now an `expansion`. This moves the drafts that were made the old way:
// for each `game` draft of kind `expansion` it creates the `expansion` draft (`drafts.expansion-<slug>`) and deletes the game draft, in one
// transaction. `planMigration` decides what happens and refuses what it cannot move without losing something or guessing; the rest of this
// file words the plan and runs it against a `MigrationStore` (the dataset, or an in-memory one in the tests). Nothing is published.

export type Doc = SeedDoc & { _rev?: string }

/** The two mutations a migration is made of: a document is created (it must not exist), another is deleted. */
export type Mutation = { create: SeedDoc } | { delete: { id: string } }

/** What the migration asks of a dataset. The real one is `http-store.ts`; the tests use an in-memory one. */
export interface MigrationStore {
  /** Every `game` of kind `expansion`, whatever its state (published, draft, version). */
  expansionGames(): Promise<Doc[]>
  /** The documents found among `ids`, keyed by `_id`. */
  getDocuments(ids: string[]): Promise<Map<string, Doc>>
  /** All the mutations in one transaction: every one is applied or none is. */
  commit(mutations: Mutation[]): Promise<void>
}

const SYSTEM_FIELDS = new Set(["_id", "_type", "_rev", "_createdAt", "_updatedAt"])

/** The fields of an expansion in the order of its form. */
const FIELD_ORDER = ["name", "slug", "baseGame", "bggId", "playersMin", "playersMax", "duration", "minAge", "releaseDate", "creators", "publishers", "description", "rulesFr", "rulesEn", "rulesEs", "rulesDe", "cover", "boxFront"]

/** The fields that hold references: written again by the rules of the seed (weak, marked to be made strong on publication). */
const REFERENCE_FIELDS = ["baseGame", "creators", "publishers"]

/** The fields an expansion shares with a game as they are: copied as they stand. */
const COPIED_FIELDS = FIELD_ORDER.filter((field) => !REFERENCE_FIELDS.includes(field))

/** What the move is about: the kind the old way used, which the new type has no field for. It carries no content. */
const KIND_FIELD = "kind"

/** What only a game has. An expansion has no field for them: a draft that holds one is not moved, since moving it would lose it. */
const GAME_ONLY_FIELDS = ["order", "complexity", "categories", "tagline", "related", "logo", "icon", "background"]

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** What the Studio's form calls empty: nothing, an empty text, an empty list. */
const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)

const refOf = (value: unknown): string | undefined => (isRecord(value) && typeof value._ref === "string" && value._ref !== "" ? value._ref : undefined)

const show = (value: unknown): string => {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 40 ? `${text.slice(0, 37)}…` : text
}

const DRAFT = "drafts."
const draftIdOf = (id: string) => `${DRAFT}${id}`

/** The types of document a reference of an expansion points at, by field. */
type TargetType = "game" | "creator" | "publisher"

/** A reference the new document holds: where, what it points at, and whether that is published yet. */
export type Link = { path: string; id: string; type: TargetType; state: "published" | "draft only" }

/** One game draft turned into an expansion draft. */
export type Migration = {
  /** The game draft, deleted. */
  from: string
  /** The expansion draft, created. */
  to: string
  doc: SeedDoc
  /** The fields that move, `creators (3)` for a list. */
  moves: string[]
  /** The fields that are not moved because they hold nothing (`kind`, and any game-only field the draft leaves empty). */
  drops: string[]
  links: Link[]
}

export type Plan = {
  /** How many games of kind `expansion` the dataset holds, and how many of them are drafts. */
  found: { total: number; drafts: number }
  migrations: Migration[]
  /** Why the plan cannot be run: when there is one, nothing is written. */
  problems: string[]
}

/** The slug of a game, when it can make the id of a document (letters, digits, "-" and "_"), else nothing. */
const slugOf = (game: Doc): string => (isRecord(game.slug) && typeof game.slug.current === "string" && /^[A-Za-z0-9_-]+$/.test(game.slug.current) ? game.slug.current : "")

/** The ids `planMigration` needs to see: where each expansion will go, and what its references point at. */
export function idsToRead(games: readonly Doc[]): string[] {
  const ids = new Set<string>()
  for (const game of games) {
    const slug = slugOf(game)
    if (slug) for (const id of [expansionId(slug), draftIdOf(expansionId(slug))]) ids.add(id)
    for (const target of targetsOf(game)) for (const id of [target.id, draftIdOf(target.id)]) ids.add(id)
  }
  return [...ids]
}

/** Every document a game draft points at: its base game, the people of its credits, its publishers. */
function targetsOf(game: Doc): { path: string; id: string; type: TargetType }[] {
  const targets: { path: string; id: string; type: TargetType }[] = []
  const base = refOf(game.baseGame)
  if (base) targets.push({ path: "baseGame", id: base, type: "game" })
  if (Array.isArray(game.creators)) {
    game.creators.forEach((line, index) => {
      const id = isRecord(line) ? refOf(line.creator) : undefined
      if (id) targets.push({ path: `creators[${index}]`, id, type: "creator" })
    })
  }
  if (Array.isArray(game.publishers)) {
    game.publishers.forEach((entry, index) => {
      const id = refOf(entry)
      if (id) targets.push({ path: `publishers[${index}]`, id, type: "publisher" })
    })
  }
  return targets
}

/** The new document, made of a game draft: the fields they share as they stand, the references written again by the rules of the seed, in the order of the form. */
function expansionOf(game: Doc, to: string): SeedDoc {
  const built: Record<string, unknown> = {}
  for (const field of COPIED_FIELDS) if (!isEmpty(game[field])) built[field] = structuredClone(game[field])
  const base = refOf(game.baseGame)
  if (base) built.baseGame = reference(base, "game")
  if (Array.isArray(game.creators) && game.creators.length > 0) {
    built.creators = game.creators.map((line) => {
      const record = isRecord(line) ? line : {}
      const id = refOf(record.creator) ?? ""
      return { ...structuredClone(record), _key: typeof record._key === "string" ? record._key : id, creator: reference(id, "creator") }
    })
  }
  if (Array.isArray(game.publishers) && game.publishers.length > 0) {
    built.publishers = game.publishers.map((entry) => {
      const id = refOf(entry) ?? ""
      return { _key: isRecord(entry) && typeof entry._key === "string" ? entry._key : id, ...reference(id, "publisher") }
    })
  }
  const doc: SeedDoc = { _id: to, _type: "expansion" }
  for (const field of FIELD_ORDER) if (field in built) doc[field] = built[field]
  return doc
}

/**
 * What to do with the games of kind `expansion` the dataset holds, given the documents `idsToRead` asked for. Only drafts are moved: a
 * published game of that kind, or one in a release, has a state the migration does not guess at, and stops it. So does a draft that
 * holds a field an expansion has no place for, one with no base game (an expansion cannot be published without one), one whose target
 * document is missing or of another type, and an expansion that already exists. When there is a problem, nothing is moved at all.
 */
export function planMigration(games: readonly Doc[], existing: ReadonlyMap<string, Doc>): Plan {
  const problems: string[] = []
  const migrations: Migration[] = []
  const made = new Map<string, string>()
  const drafts = games.filter((game) => game._id.startsWith(DRAFT))

  for (const game of games) {
    if (!game._id.startsWith(DRAFT)) problems.push(`${game._id}: it is not a draft (published, or in a release): the migration moves drafts only. Move it by hand in the Studio`)
  }

  for (const game of drafts) {
    const own: string[] = []
    const slug = slugOf(game)
    if (!slug) own.push("it has no slug that can make the id of the expansion (letters, digits, \"-\" and \"_\")")

    const to = slug ? draftIdOf(expansionId(slug)) : ""
    if (to) {
      const taken = made.get(to)
      if (taken !== undefined) own.push(`${taken} and ${game._id} would both become ${to}`)
      for (const id of [to, to.slice(DRAFT.length)]) if (existing.has(id)) own.push(`${id} exists already: nothing is overwritten`)
    }

    for (const [field, value] of Object.entries(game)) {
      if (SYSTEM_FIELDS.has(field) || field === KIND_FIELD || FIELD_ORDER.includes(field)) continue
      if (GAME_ONLY_FIELDS.includes(field)) {
        if (!isEmpty(value)) own.push(`it has a "${field}" (${show(value)}), which an expansion has no field for: clear it in the Studio, or say so to the owner`)
      } else {
        own.push(`it has a "${field}", which is a field of neither a game nor an expansion`)
      }
    }

    const links: Link[] = []
    if (!refOf(game.baseGame)) own.push("it has no base game: pick it in the Studio first, an expansion cannot be published without one")
    for (const target of targetsOf(game)) {
      const published = existing.get(target.id)
      const draft = existing.get(draftIdOf(target.id))
      const found = published ?? draft
      if (!found) own.push(`${target.path} points at ${target.id}, which is not in the dataset`)
      else if (found._type !== target.type) own.push(`${target.path} points at ${target.id}, a "${found._type}", and an expansion takes a "${target.type}" there`)
      else links.push({ path: target.path, id: target.id, type: target.type, state: published ? "published" : "draft only" })
    }

    if (own.length > 0) {
      problems.push(...own.map((problem) => `${game._id}: ${problem}`))
      continue
    }
    made.set(to, game._id)
    const doc = expansionOf(game, to)
    const moves = Object.keys(doc)
      .filter((field) => !field.startsWith("_"))
      .map((field) => (Array.isArray(doc[field]) ? `${field} (${(doc[field] as unknown[]).length})` : field))
    // what is left behind holds nothing: the kind, and any field the draft leaves empty (a problem was found otherwise)
    const drops = Object.keys(game)
      .filter((field) => !SYSTEM_FIELDS.has(field) && !(field in doc))
      .map((field) => (field === KIND_FIELD ? `${field} (${show(game[field])})` : `${field} (empty)`))
    migrations.push({ from: game._id, to, doc, moves, drops, links })
  }

  return { found: { total: games.length, drafts: drafts.length }, migrations, problems }
}

/** The transaction of a plan: for each game draft, the expansion draft is created (never overwritten: `create` refuses an id that exists) and the game draft is deleted. */
export const mutationsOf = (plan: Plan): Mutation[] => plan.migrations.flatMap((migration): Mutation[] => [{ create: migration.doc }, { delete: { id: migration.from } }])

/** What a run did: `dry-run` wrote nothing because it was not asked to, `stopped` was asked to write and did not (a problem to settle, or nothing to move), `applied` wrote. */
export type Mode = "dry-run" | "applied" | "stopped"

export type Words = { projectId: string; dataset: string; mode: Mode }

const HEADERS: Record<Mode, string> = { "dry-run": ": DRY RUN, nothing is written", stopped: ": NOTHING WRITTEN", applied: ": WRITTEN" }

/** The plan in words, for a terminal: what is created, what is deleted, what moves and what does not, the new document in full. */
export function describePlan(plan: Plan, { projectId, dataset, mode }: Words): string {
  const lines = [`Expansions out of the games (PLT-102) on ${projectId}/${dataset}${HEADERS[mode]}`, ""]
  const { total, drafts } = plan.found
  lines.push(total === 0 ? 'No game of kind "expansion": nothing to move.' : `${total} game${total === 1 ? "" : "s"} of kind "expansion" (${drafts} draft${drafts === 1 ? "" : "s"}, ${total - drafts} other).`)
  for (const migration of plan.migrations) {
    lines.push("", `${migration.from}  ${show(migration.doc.name)}`)
    lines.push(`  create  ${migration.to}  (expansion)`, `  delete  ${migration.from}`)
    lines.push(`  moves   ${migration.moves.join(", ")}`)
    lines.push(`  drops   ${migration.drops.length > 0 ? migration.drops.join(", ") : "nothing"}`)
    lines.push(`  points at  ${migration.links.map((link) => `${link.id} (${link.type}, ${link.state})`).join(", ")}`)
    lines.push("", "The new document, as it is written:", JSON.stringify(migration.doc, null, 2).replace(/^/gm, "  "))
  }
  if (plan.problems.length > 0) {
    lines.push("", "Nothing can be moved until this is settled:", ...plan.problems.map((problem) => `  - ${problem}`))
  } else if (plan.migrations.length > 0) {
    lines.push(
      "",
      mode === "applied"
        ? "Written in one transaction, then read back. Publish in the Studio: the expansion, once what it points at is published."
        : "Nothing was written. Run again with --apply to write it, in one transaction. Close the game draft in the Studio first.",
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
 * Plans the migration against the dataset and, with `apply`, runs it in one transaction. Nothing is written when there is nothing to move
 * or a problem to settle. After a write, the dataset is read back: the expansions are there and the game drafts are not.
 */
export async function migrate(store: MigrationStore, { apply }: { apply: boolean }): Promise<Outcome> {
  const games = await store.expansionGames()
  const plan = planMigration(games, await store.getDocuments(idsToRead(games)))
  if (!apply) return { plan, mode: "dry-run", afterProblems: [] }
  if (plan.problems.length > 0 || plan.migrations.length === 0) return { plan, mode: "stopped", afterProblems: [] }

  await store.commit(mutationsOf(plan))
  const after = await store.getDocuments(plan.migrations.flatMap((migration) => [migration.to, migration.from]))
  const afterProblems = plan.migrations.flatMap((migration) => [
    ...(after.has(migration.to) ? [] : [`${migration.to} is not in the dataset after the write`]),
    ...(after.has(migration.from) ? [`${migration.from} is still in the dataset after the write`] : []),
  ])
  return { plan, mode: "applied", afterProblems }
}

import { readSync, syncMutations } from "./sync.ts"
import type { BggThing } from "./xml.ts"

// PLT-78: the figures of the games that BoardGameGeek has and the Studio does not, as drafts for the owner to publish. `planFigures` decides what is proposed and what is only
// said; the rest of this file words the plan and runs it against a `FiguresStore` (the dataset, or an in-memory one in the tests). Nothing here publishes anything, and a figure
// that the Studio holds is never replaced: a game that has a value, in its draft or, when it has no draft, published, keeps it.

export type Doc = { _id: string; _type: string; _rev?: string; [field: string]: unknown }

/** A draft made of a published document, or a patch of a draft: `ifRevisionID` makes the whole transaction fail if somebody saved the draft since it was read. */
export type Mutation = { createIfNotExists: Doc } | { patch: { id: string; ifRevisionID?: string; set: Record<string, unknown> } }

/** What the pipeline asks of a dataset. The real one is `store.ts`; the tests have an in-memory one. */
export interface FiguresStore {
  /** Every document of type `game`, whatever its state (published, draft, version), and the record of BGG's weights (`sync.ts`) when there is one. */
  documents(): Promise<Doc[]>
  /** All the mutations in one transaction: every one is applied or none is. */
  commit(mutations: Mutation[]): Promise<void>
}

/** The figures of a game that BGG can give. They are fields of the `game` type of the Studio. */
export const FIGURES = ["complexity", "playersMin", "playersMax", "duration", "minAge"] as const
export type Figure = (typeof FIGURES)[number]
/** What is written to a draft: the figures, and the BGG id when it is proposed too (`ProposedIds`). */
export type Figures = Partial<Record<Figure | "bggId", number>>

/** The BGG ids proposed for games that have none or a wrong one, by the id of the game (without the prefix of a draft): the figures are then read for them too. */
export type ProposedIds = ReadonlyMap<string, number>

/** How many people must have weighed a game for its weight to be worth proposing. */
export const MIN_WEIGHTS = 10

/** From this age a game is for adults on the platform: the player's age is checked and a guest cannot play it (PLT-125). BGG's minimum age is only proposed below it. */
export const ADULT_AGE = 16

const DRAFT = "drafts."

const isNothing = (value: unknown): boolean => value === undefined || value === null

/** The id of a document without the prefix of a draft. */
const baseId = (id: string): string => (id.startsWith(DRAFT) ? id.slice(DRAFT.length) : id)

/** A name as one compares two: no accent, no case, letters and digits in words. */
const plain = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Whether two names are the same game's, once one has no spaces ("Mind Bug" is "Mindbug: First Contact"): one holds the other. */
const sameName = (a: string, b: string): boolean => {
  const first = plain(a).replace(/ /g, "")
  const second = plain(b).replace(/ /g, "")
  return first !== "" && second !== "" && (first.includes(second) || second.includes(first))
}

/** The name of a game as the Studio holds it (a text; a value that is not one has no name). */
export const nameOf = (doc: Doc): string => (typeof doc.name === "string" ? doc.name : "")

/** A game of the Studio: its published document and its draft, either of which may be missing. The draft is what the owner works on. */
export type Entry = { id: string; published?: Doc; draft?: Doc }

/** The games of a set of documents, by id, in the order of their ids. The versions of a release are not touched. */
export function entries(docs: readonly Doc[]): Entry[] {
  const byId = new Map<string, Entry>()
  for (const doc of docs) {
    if (doc._type !== "game" || doc._id.startsWith("versions.")) continue
    const id = baseId(doc._id)
    const entry = byId.get(id) ?? { id }
    if (doc._id.startsWith(DRAFT)) entry.draft = doc
    else entry.published = doc
    byId.set(id, entry)
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** The document the owner sees: the draft when there is one. */
export const stateOf = (entry: Entry): Doc => (entry.draft ?? entry.published) as Doc

/** The BGG id of a game, null when it has none (or a value that is not one). */
export function bggIdOf(doc: Doc): number | null {
  const id = doc.bggId
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null
}

/** Whether the game lacks a figure that BGG could give. */
const lacksFigure = (doc: Doc): boolean => FIGURES.some((field) => isNothing(doc[field]))

/** The BGG ids worth asking for: those of the games that lack a figure, a proposed id standing for the one the game has. */
export function idsToRead(docs: readonly Doc[], proposed: ProposedIds = new Map()): number[] {
  const ids = new Set<number>()
  for (const entry of entries(docs)) {
    const state = stateOf(entry)
    const id = proposed.get(entry.id) ?? bggIdOf(state)
    if (id !== null && (proposed.has(entry.id) || lacksFigure(state))) ids.add(id)
  }
  return [...ids].sort((a, b) => a - b)
}

export type GameFigures = {
  id: string
  slug: string
  name: string
  bggId: number | null
  /**
   * `proposed`: figures to write · `complete`: it holds them all · `nothing`: BGG has nothing more to give it · `no-id`: it has no BGG id · `not-found`: BGG did not answer for its id
   * · `mismatch`: the id is another item (not a board game) or another game (its name is not the game's): nothing is proposed from it, the owner fixes the id
   */
  status: "proposed" | "complete" | "nothing" | "no-id" | "not-found" | "mismatch"
  set: Figures
  /** What is worth the owner's eye: a name that differs, a weight few have given, an age that would make the game for adults. */
  notes: string[]
  /** What BGG says of the game besides, for the report. */
  bgg: { name: string | null; year: number | null; rating: number | null; ratings: number; rank: number | null } | null
}

export type Plan = { games: GameFigures[]; mutations: Mutation[] }

export const round2 = (value: number): number => Math.round(value * 100) / 100

/** The figures of `thing` that the game lacks, and the notes on the way. */
function propose(state: Doc, thing: BggThing, notes: string[]): Figures {
  const set: Figures = {}
  const has = (field: Figure) => !isNothing(state[field])

  if (!has("complexity")) {
    if (thing.weight !== null && thing.weights >= MIN_WEIGHTS) set.complexity = round2(thing.weight)
    else if (thing.weight !== null) notes.push(`complexity ${round2(thing.weight)} not proposed: only ${thing.weights} people weighed it (${MIN_WEIGHTS} needed)`)
  }

  // An empty maximum means "or more" on the hub: it is filled only together with the minimum
  const max = typeof state.playersMax === "number" ? state.playersMax : null
  if (!has("playersMin") && !has("playersMax")) {
    if (thing.minPlayers !== null && thing.maxPlayers !== null && thing.maxPlayers >= thing.minPlayers) {
      set.playersMin = thing.minPlayers
      set.playersMax = thing.maxPlayers
    }
  } else if (!has("playersMin") && max !== null && thing.minPlayers !== null && thing.minPlayers <= max) {
    set.playersMin = thing.minPlayers
  }

  if (!has("duration") && thing.playingTime !== null) set.duration = thing.playingTime

  if (!has("minAge") && thing.minAge !== null) {
    if (thing.minAge < ADULT_AGE) set.minAge = thing.minAge
    else notes.push(`BGG says ${thing.minAge}+: writing it would make the game for adults (a guest could not play it), so it is not proposed; set it in the Studio if you mean it`)
  }
  return set
}

/** What the dataset sets itself, and a draft made of a published document does not carry over. */
const SYSTEM_FIELDS = ["_rev", "_createdAt", "_updatedAt"]

/** A draft of a published document: the same document under the id of a draft, without what the dataset sets itself. */
function draftOf(published: Doc): Doc {
  return { ...Object.fromEntries(Object.entries(published).filter(([key]) => !SYSTEM_FIELDS.includes(key))), _id: `${DRAFT}${published._id}`, _type: published._type }
}

/** The slug of a game: its field, else its id without the `game-` the seed gives it. */
export function slugOf(doc: Doc, id: string): string {
  const slug = doc.slug
  const current = typeof slug === "object" && slug !== null && "current" in slug ? (slug as { current: unknown }).current : undefined
  return typeof current === "string" && current !== "" ? current : id.replace(/^game-/, "")
}

/** Why a BGG item is not the game, null when it is: it is not a board game, or none of the names BGG knows it by is the game's. */
export function mismatchOf(bggId: number, name: string, thing: BggThing): string | null {
  const called = `"${thing.name ?? "no name"}"${thing.year ? ` (${thing.year})` : ""}`
  if (thing.type !== "boardgame" && thing.type !== "boardgameexpansion") return `BGG id ${bggId} is not a board game (it is a ${thing.type}: ${called})`
  if (name !== "" && thing.names.length > 0 && !thing.names.some((candidate) => sameName(candidate, name))) return `BGG id ${bggId} is ${called}, not "${name}"`
  return null
}

/**
 * What to write, from the games of the Studio and what BGG answered. A game with a BGG id and a figure missing gets the figures BGG has for it, in its draft (made of
 * the published document when it has none); a game with all its figures, no BGG id, or no answer from BGG, gets a line in the report and no mutation. So does a game whose
 * id is not a board game or whose BGG name is not the game's: the figures of another game are worse than none, and the owner fixes the id.
 */
export function planFigures(docs: readonly Doc[], things: ReadonlyMap<number, BggThing>, proposed: ProposedIds = new Map()): Plan {
  const games: GameFigures[] = []
  const mutations: Mutation[] = []

  for (const entry of entries(docs)) {
    const stored = stateOf(entry)
    // A proposed id is the game's own for what follows, and is written with the figures
    const bggId = proposed.get(entry.id) ?? bggIdOf(stored)
    const state: Doc = proposed.has(entry.id) ? { ...stored, bggId } : stored
    const name = nameOf(state)
    const slug = slugOf(state, entry.id)
    const idSet: Figures = proposed.has(entry.id) && bggId !== null ? { bggId } : {}
    const base = { id: entry.id, slug, name, bggId, set: idSet, notes: [] as string[], bgg: null }

    if (bggId === null) {
      games.push({ ...base, status: "no-id" })
      continue
    }
    if (!lacksFigure(state) && !proposed.has(entry.id)) {
      games.push({ ...base, status: "complete" })
      continue
    }
    const thing = things.get(bggId)
    if (!thing) {
      games.push({ ...base, status: "not-found" })
      continue
    }
    const bgg = { name: thing.name, year: thing.year, rating: thing.rating, ratings: thing.ratings, rank: thing.rank }
    const mismatch = mismatchOf(bggId, name, thing)
    if (mismatch !== null) {
      games.push({ ...base, bgg, status: "mismatch", notes: [`${mismatch}: nothing proposed, fix the BGG ID`] })
      continue
    }

    const notes: string[] = []
    const set: Figures = { ...idSet, ...propose(state, thing, notes) }
    games.push({ ...base, bgg, status: Object.keys(set).length > 0 ? "proposed" : "nothing", set, notes })

    if (Object.keys(set).length > 0) {
      if (entry.draft) mutations.push({ patch: { id: entry.draft._id, ...(entry.draft._rev ? { ifRevisionID: entry.draft._rev } : {}), set } })
      else if (entry.published) mutations.push({ createIfNotExists: draftOf(entry.published) }, { patch: { id: `${DRAFT}${entry.published._id}`, set } })
    }
  }
  return { games, mutations }
}

/** What the draft of each proposed game should hold after the write, checked against the dataset read back. */
export function problemsAfter(docs: readonly Doc[], plan: Plan): string[] {
  const problems: string[] = []
  const byId = new Map(docs.map((doc) => [doc._id, doc]))
  for (const game of plan.games) {
    if (game.status !== "proposed") continue
    const draft = byId.get(`${DRAFT}${game.id}`)
    if (!draft) {
      problems.push(`${game.id}: no draft after the write`)
      continue
    }
    for (const [field, value] of Object.entries(game.set)) if (draft[field] !== value) problems.push(`${game.id}: ${field} is ${JSON.stringify(draft[field])} after the write, not ${value}`)
  }
  return problems
}

export type Words = { projectId: string; dataset: string; mode: "dry-run" | "applied" }

const figuresText = (set: Figures): string =>
  [
    set.bggId !== undefined ? `BGG id ${set.bggId}` : null,
    set.complexity !== undefined ? `complexity ${set.complexity}` : null,
    set.playersMin !== undefined || set.playersMax !== undefined ? `players ${set.playersMin ?? "·"}–${set.playersMax ?? "·"}` : null,
    set.duration !== undefined ? `${set.duration} min` : null,
    set.minAge !== undefined ? `age ${set.minAge}+` : null,
  ]
    .filter((part) => part !== null)
    .join(", ")

/** The plan in words, for a dry run and for the run that follows it. */
export function describeFigures(plan: Plan, { projectId, dataset, mode }: Words): string {
  const proposed = plan.games.filter((game) => game.status === "proposed")
  const count = (status: GameFigures["status"]) => plan.games.filter((game) => game.status === status).length
  const outcome = mode === "dry-run" ? "dry run, nothing written" : plan.mutations.length > 0 ? "written as drafts" : "nothing to write"
  const lines = [`Figures from BoardGameGeek · ${projectId}/${dataset} · ${outcome}`, ""]

  if (proposed.length > 0) lines.push(`Proposed (${proposed.length} games, as drafts to publish):`)
  for (const game of proposed) {
    const rating = game.bgg?.rating ? ` · BGG ${game.bgg.rating.toFixed(1)}/10 by ${game.bgg.ratings}${game.bgg.rank ? `, #${game.bgg.rank}` : ""}` : ""
    lines.push(`  ${game.slug}: ${figuresText(game.set)}${rating}`)
    for (const note of game.notes) lines.push(`      ! ${note}`)
  }
  const wrong = plan.games.filter((game) => game.status === "mismatch")
  if (wrong.length > 0) lines.push("", "BGG ids to fix in the Studio (nothing is proposed from them):")
  for (const game of wrong) for (const note of game.notes) lines.push(`  ${game.slug}: ${note}`)
  const worth = plan.games.filter((game) => game.status !== "mismatch" && game.status !== "proposed" && game.notes.length > 0)
  if (worth.length > 0) lines.push("", "To look at:")
  for (const game of worth) for (const note of game.notes) lines.push(`  ${game.slug}: ${note}`)

  lines.push(
    "",
    `${proposed.length} proposed · ${count("mismatch")} with a wrong BGG id · ${count("complete")} already complete · ${count("nothing")} with nothing more on BGG · ${count("not-found")} not found on BGG · ${count("no-id")} without a BGG id`,
  )
  const notFound = plan.games.filter((game) => game.status === "not-found")
  if (notFound.length > 0) lines.push(`Not found on BGG: ${notFound.map((game) => `${game.slug} (${game.bggId})`).join(", ")}`)
  if (mode === "dry-run" && proposed.length > 0) lines.push("", "Run again with --apply to write them as drafts (only on the owner's word). Nothing is published.")
  return lines.join("\n")
}

export type Outcome = { plan: Plan; mode: Words["mode"]; afterProblems: string[] }

/**
 * Plans, and with `apply` writes in one transaction and reads the dataset back. BGG is read by `readThings` (asked for `idsToRead(documents)`), so that a test needs no
 * network. `chooseIds` is asked, once the first plan has found the games without a BGG id or with a wrong one, for the ids to propose for them; the figures are then read
 * for those games too and the plan is made again.
 */
export async function run(
  store: FiguresStore,
  readThings: (ids: number[]) => Promise<ReadonlyMap<number, BggThing>>,
  { apply, chooseIds, at = new Date().toISOString().slice(0, 10) }: { apply: boolean; chooseIds?: (plan: Plan) => Promise<ProposedIds>; at?: string },
): Promise<Outcome> {
  const docs = await store.documents()
  const first = idsToRead(docs)
  let things = first.length > 0 ? await readThings(first) : new Map<number, BggThing>()
  let plan = planFigures(docs, things)
  if (chooseIds) {
    const proposed = await chooseIds(plan)
    if (proposed.size > 0) {
      const more = idsToRead(docs, proposed).filter((id) => !things.has(id))
      things = new Map([...things, ...(more.length > 0 ? await readThings(more) : [])])
      plan = planFigures(docs, things, proposed)
    }
  }
  if (!apply) return { plan, mode: "dry-run", afterProblems: [] }
  if (plan.mutations.length === 0) return { plan, mode: "applied", afterProblems: [] }
  // The complexity written here is BGG's: it is recorded as such (`sync.ts`), so that `--refresh` can tell it from one the owner sets by hand
  const recorded = Object.fromEntries(plan.games.flatMap((game) => (game.set.complexity === undefined ? [] : [[game.id, { weight: game.set.complexity, at }]])))
  await store.commit([...plan.mutations, ...syncMutations(readSync(docs), recorded)])
  return { plan, mode: "applied", afterProblems: problemsAfter(await store.documents(), plan) }
}

import { bggIdOf, entries, mismatchOf, nameOf, round2, slugOf, stateOf, MIN_WEIGHTS, type Doc, type Entry, type FiguresStore, type Mutation } from "./figures.ts"
import { readSync, syncMutations, type SyncRecord } from "./sync.ts"
import type { BggThing } from "./xml.ts"

// PLT-78: the complexity of a game moves as people weigh it on BoardGameGeek, so `content:bgg --refresh` brings the ones that are BGG's up to date, by hand for now (a weekly run
// is a later step). It touches the complexity and nothing else, and only where the record of `sync.ts` says the value is still the one BGG gave: a complexity the owner set by hand
// is never changed. It writes where the hub reads: the published document and the draft of a game both, since a draft left with the old weight would undo the refresh when it is published.
// A change under `MIN_CHANGE` is left (every vote moves the second decimal and each write is a revision). The first run claims the weights the script wrote before the record existed:
// a value that is BGG's within `CLAIM_TOLERANCE` is recorded as BGG's, and one that is not is taken for a value set by hand.

/** The least change of the weight worth a write. */
export const MIN_CHANGE = 0.05

/** How far a stored complexity may be from BGG's today and still be taken for the one the script wrote. */
export const CLAIM_TOLERANCE = 0.02

export type RefreshStatus =
  /** the weight moved: the documents that held BGG's are patched */
  | "refreshed"
  /** no record yet, and the value is BGG's within the tolerance: it is recorded */
  | "claimed"
  /** BGG's weight is where it was, or within `MIN_CHANGE` of it */
  | "unchanged"
  /** the complexity is not the one BGG gave: the owner's, left alone */
  | "by-hand"
  /** fewer than `MIN_WEIGHTS` people weighed the game: nothing to say */
  | "few-votes"
  /** BGG did not answer for the id */
  | "not-found"
  /** the id is not the game (another game, or not a board game) */
  | "mismatch"

export type RefreshedGame = {
  id: string
  slug: string
  name: string
  bggId: number
  status: RefreshStatus
  /** The complexity before and after, for `refreshed`; the one recorded, for `claimed` */
  from: number | null
  to: number | null
  /** The documents patched */
  targets: string[]
  notes: string[]
}

export type RefreshPlan = { games: RefreshedGame[]; mutations: Mutation[] }

const isWeight = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** How far two weights are, to two decimals like the weights themselves: 1.77 and 1.82 are 0.05 apart, not 0.0500000000000000444. */
const distance = (a: number, b: number): number => round2(Math.abs(a - b))

/** The documents of a game that hold a complexity, the published one first. */
const holders = (entry: Entry): Doc[] => [entry.published, entry.draft].flatMap((doc) => (doc && isWeight(doc.complexity) ? [doc] : []))

/** The BGG ids worth asking for: those of the games that hold a complexity somewhere. */
export function idsToRefresh(docs: readonly Doc[]): number[] {
  const ids = new Set<number>()
  for (const entry of entries(docs)) {
    const id = bggIdOf(stateOf(entry))
    if (id !== null && holders(entry).length > 0) ids.add(id)
  }
  return [...ids].sort((a, b) => a - b)
}

/** The patch of one document: its complexity, guarded by the revision read. */
const patchOf = (doc: Doc, complexity: number): Mutation => ({ patch: { id: doc._id, ...(doc._rev ? { ifRevisionID: doc._rev } : {}), set: { complexity } } })

/**
 * What to refresh, from the games of the Studio, the record of BGG's weights and what BGG answered today (`at`, `YYYY-MM-DD`, is the day recorded with a weight).
 * Reports each game that holds a complexity and has a BGG id, and writes only for `refreshed` and `claimed`.
 */
export function planRefresh(docs: readonly Doc[], things: ReadonlyMap<number, BggThing>, at: string): RefreshPlan {
  const sync = readSync(docs)
  const games: RefreshedGame[] = []
  const mutations: Mutation[] = []
  const recorded: Record<string, SyncRecord> = {}

  for (const entry of entries(docs)) {
    const state = stateOf(entry)
    const bggId = bggIdOf(state)
    const held = holders(entry)
    if (bggId === null || held.length === 0) continue
    const base = { id: entry.id, slug: slugOf(state, entry.id), name: nameOf(state), bggId, from: null, to: null, targets: [] as string[], notes: [] as string[] }

    const thing = things.get(bggId)
    if (!thing) {
      games.push({ ...base, status: "not-found" })
      continue
    }
    const mismatch = mismatchOf(bggId, base.name, thing)
    if (mismatch !== null) {
      games.push({ ...base, status: "mismatch", notes: [`${mismatch}: fix the BGG ID`] })
      continue
    }
    if (thing.weight === null || thing.weights < MIN_WEIGHTS) {
      games.push({ ...base, status: "few-votes", notes: [`only ${thing.weights} people weighed it (${MIN_WEIGHTS} needed)`] })
      continue
    }
    const weight = round2(thing.weight)
    const record = sync.games[entry.id]

    if (record) {
      const bggs = held.filter((doc) => doc.complexity === record.weight)
      if (bggs.length === 0) {
        games.push({ ...base, status: "by-hand", from: record.weight, notes: [`complexity ${held.map((doc) => doc.complexity).join(" / ")} is not the ${record.weight} BGG gave (${record.at}): set by hand, left alone`] })
      } else if (distance(weight, record.weight) < MIN_CHANGE) {
        games.push({ ...base, status: "unchanged", from: record.weight, to: weight })
      } else {
        games.push({ ...base, status: "refreshed", from: record.weight, to: weight, targets: bggs.map((doc) => doc._id) })
        mutations.push(...bggs.map((doc) => patchOf(doc, weight)))
        recorded[entry.id] = { weight, at }
      }
      continue
    }

    // No record: the weights the script wrote before it kept one are BGG's within the tolerance, the others cannot be told from the owner's
    const values = [...new Set(held.map((doc) => doc.complexity as number))]
    const [value] = values
    if (values.length === 1 && value !== undefined && distance(value, weight) <= CLAIM_TOLERANCE) {
      games.push({ ...base, status: "claimed", from: value, to: value })
      recorded[entry.id] = { weight: value, at }
    } else {
      games.push({ ...base, status: "by-hand", notes: [`complexity ${values.join(" / ")} is not BGG's ${weight} and nothing says the script wrote it: left alone`] })
    }
  }
  return { games, mutations: [...mutations, ...syncMutations(sync, recorded)] }
}

/** What each refreshed game should hold after the write, and the record, checked against the dataset read back. */
export function problemsAfterRefresh(docs: readonly Doc[], plan: RefreshPlan, at: string): string[] {
  const problems: string[] = []
  const byId = new Map(docs.map((doc) => [doc._id, doc]))
  const sync = readSync(docs)
  for (const game of plan.games) {
    if (game.status !== "refreshed" && game.status !== "claimed") continue
    for (const id of game.targets) if (byId.get(id)?.complexity !== game.to) problems.push(`${id}: complexity is ${JSON.stringify(byId.get(id)?.complexity)} after the write, not ${game.to}`)
    const record = sync.games[game.id]
    if (record?.weight !== game.to || record.at !== at) problems.push(`${game.id}: the record of BGG's weight is ${JSON.stringify(record)} after the write, not ${game.to} on ${at}`)
  }
  return problems
}

export type RefreshWords = { projectId: string; dataset: string; mode: "dry-run" | "applied" }

/** The plan in words, for a dry run and for the run that follows it. */
export function describeRefresh(plan: RefreshPlan, { projectId, dataset, mode }: RefreshWords): string {
  const of = (status: RefreshStatus) => plan.games.filter((game) => game.status === status)
  const refreshed = of("refreshed")
  const writes = plan.mutations.length > 0
  const lines = [`Complexity from BoardGameGeek · refresh · ${projectId}/${dataset} · ${mode === "dry-run" ? "dry run, nothing written" : writes ? "written" : "nothing to write"}`, ""]
  if (refreshed.length > 0) lines.push(`Refreshed (${refreshed.length}, in the published document and the draft that hold BGG's weight):`)
  for (const game of refreshed) lines.push(`  ${game.slug}: ${game.from} → ${game.to}${game.targets.length > 1 ? " (published and draft)" : game.targets[0]?.startsWith("drafts.") ? " (draft only)" : " (published only)"}`)
  const claimed = of("claimed")
  if (claimed.length > 0) lines.push("", `Recorded as BGG's from now on (${claimed.length}, the value is BGG's within ${CLAIM_TOLERANCE}): ${claimed.map((game) => game.slug).join(", ")}`)
  const looked = plan.games.filter((game) => game.notes.length > 0)
  if (looked.length > 0) lines.push("", "To look at:")
  for (const game of looked) for (const note of game.notes) lines.push(`  ${game.slug}: ${note}`)
  lines.push(
    "",
    `${refreshed.length} refreshed · ${claimed.length} recorded · ${of("unchanged").length} unchanged (under ${MIN_CHANGE}) · ${of("by-hand").length} set by hand · ${of("few-votes").length} with too few votes · ${of("mismatch").length} with a wrong BGG id · ${of("not-found").length} not found on BGG`,
  )
  if (mode === "dry-run" && writes) lines.push("", "Run again with --apply to write it (only on the owner's word).")
  return lines.join("\n")
}

export type RefreshOutcome = { plan: RefreshPlan; mode: RefreshWords["mode"]; afterProblems: string[] }

/** Plans the refresh, and with `apply` writes it in one transaction and reads the dataset back. BGG is read by `readThings`, asked for `idsToRefresh(documents)`. */
export async function runRefresh(
  store: FiguresStore,
  readThings: (ids: number[]) => Promise<ReadonlyMap<number, BggThing>>,
  { apply, at = new Date().toISOString().slice(0, 10) }: { apply: boolean; at?: string },
): Promise<RefreshOutcome> {
  const docs = await store.documents()
  const ids = idsToRefresh(docs)
  const plan = planRefresh(docs, ids.length > 0 ? await readThings(ids) : new Map(), at)
  if (!apply) return { plan, mode: "dry-run", afterProblems: [] }
  if (plan.mutations.length === 0) return { plan, mode: "applied", afterProblems: [] }
  await store.commit(plan.mutations)
  return { plan, mode: "applied", afterProblems: problemsAfterRefresh(await store.documents(), plan, at) }
}

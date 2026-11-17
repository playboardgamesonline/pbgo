// The state of a game that goes through `/add-game`: one JSON file, `<assets>/<slug>/pipeline.json`, next to the scout file, outside the repo and never committed, so that the skill can stop and
// resume from any session. It keeps what the repo cannot say (which step was validated, what the gate showed, the Linear issues) and nothing `pnpm check:game` can: the stages of a game that has a
// folder are computed from the repo, never copied here. The skill is the only writer, through `pnpm game-flow`, and every write is a whole file renamed into place.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { cleanName, slugFromName } from "@pbgo/games/slug"

export const STATE_VERSION = 1
export const STATE_FILE = "pipeline.json"
export const SCOUT_FILE = "scout.json"
/** The rulebook of the game, next to its scout file: the one the scout found (`pnpm game-flow rulebook` fetches it) or one the owner put there. The rules spec is read from it. */
export const RULES_PDF = "rules.pdf"
/** The folder of the pictures of the game for the platform's catalog entry, next to the scout file: the files are named `game-<slug>-<picture>` (the seed's art step reads them there). */
export const PICTURES_DIR = "platform"

export type StepStatus = "pending" | "running" | "gate" | "validated" | "failed"

/** An issue made in Linear, and what was last written to it, so that a sync never repeats itself. */
export type LinearIssueRef = {
  id: string
  identifier: string
  url: string
  title: string
  /** the state of the issue as last written: Todo, In Progress, Done */
  applied: string
  /** whether the comment of the validation was posted */
  commented: boolean
}

export type StepState = {
  status: StepStatus
  /** the gate the step waits at (an index of its gates) */
  gate: number
  /** how many times the step was opened: the first work, then each change the owner asked for */
  rounds: number
  startedAt: string | null
  /** when the current round was opened, and where its sub-agent writes its report (so that a session that comes back can tell a report that is there from a sub-agent that is gone) */
  roundAt: string | null
  reportPath: string | null
  /** when the gate the step waits at was reached: the owner's ok to the drafts, for the second gate of the catalog entry (what is published must be newer) */
  gateAt: string | null
  validatedAt: string | null
  /** what the sub-agent said last, shown again when the skill comes back to the gate */
  report: string | null
  links: string[]
  /** what the machine checked after the last report */
  check: { ok: boolean; lines: string[] } | null
  failure: string | null
  issue: LinearIssueRef | null
}

export type PipelineState = {
  version: typeof STATE_VERSION
  name: string
  /** every name the game was asked for: the one typed and the one the scout settled */
  aliases: string[]
  slug: string
  createdAt: string
  updatedAt: string
  linear: { parent: LinearIssueRef | null; labelId: string | null; error: string | null }
  steps: Record<string, StepState>
}

export function emptyStep(): StepState {
  return { status: "pending", gate: 0, rounds: 0, startedAt: null, roundAt: null, reportPath: null, gateAt: null, validatedAt: null, report: null, links: [], check: null, failure: null, issue: null }
}

export function newState(args: { name: string; slug: string; now: Date }): PipelineState {
  const at = args.now.toISOString()
  return { version: STATE_VERSION, name: args.name, aliases: [args.name], slug: args.slug, createdAt: at, updatedAt: at, linear: { parent: null, labelId: null, error: null }, steps: {} }
}

/** The state of a step, made (pending) when the game has none yet: a step added in a later version shows up in a game that began before it. */
export function stepOf(state: PipelineState, id: string): StepState {
  const found = state.steps[id]
  if (found) return found
  const made = emptyStep()
  state.steps[id] = made
  return made
}

// ---------- reading a state file ----------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === "string"
const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

function parseIssue(value: unknown, where: string, problems: string[]): LinearIssueRef | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) {
    problems.push(`${where} is not an issue`)
    return null
  }
  const { id, identifier, url, title, applied, commented } = value
  if (!isString(id) || !isString(identifier) || !isString(url) || !isString(title) || !isString(applied) || typeof commented !== "boolean") {
    problems.push(`${where} lacks one of id, identifier, url, title, applied, commented`)
    return null
  }
  return { id, identifier, url, title, applied, commented }
}

function parseStep(value: unknown, where: string, problems: string[]): StepState {
  const step = emptyStep()
  if (!isRecord(value)) {
    problems.push(`${where} is not an object`)
    return step
  }
  const status = value.status
  if (status === "pending" || status === "running" || status === "gate" || status === "validated" || status === "failed") step.status = status
  else problems.push(`${where}.status is "${String(status)}"`)
  if (typeof value.gate === "number" && Number.isInteger(value.gate) && value.gate >= 0) step.gate = value.gate
  if (typeof value.rounds === "number" && value.rounds >= 0) step.rounds = value.rounds
  if (isStringOrNull(value.startedAt)) step.startedAt = value.startedAt ?? null
  if (isStringOrNull(value.roundAt)) step.roundAt = value.roundAt ?? null
  if (isStringOrNull(value.reportPath)) step.reportPath = value.reportPath ?? null
  if (isStringOrNull(value.gateAt)) step.gateAt = value.gateAt ?? null
  if (isStringOrNull(value.validatedAt)) step.validatedAt = value.validatedAt ?? null
  if (isStringOrNull(value.report)) step.report = value.report ?? null
  if (Array.isArray(value.links)) step.links = value.links.filter(isString)
  if (isRecord(value.check) && typeof value.check.ok === "boolean" && Array.isArray(value.check.lines)) step.check = { ok: value.check.ok, lines: value.check.lines.filter(isString) }
  if (isStringOrNull(value.failure)) step.failure = value.failure ?? null
  step.issue = parseIssue(value.issue, `${where}.issue`, problems)
  return step
}

/**
 * A state file read: the state, or what is wrong with the file (a state of another version is refused, not guessed). The file the terminal command wrote is read as it is: what only it
 * used (the session of a headless call, the cost of a round) is left out of the state, and the next write drops it.
 */
export function parseState(text: string): { state: PipelineState; problems: [] } | { state: null; problems: string[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { state: null, problems: ["the file is not JSON"] }
  }
  if (!isRecord(data)) return { state: null, problems: ["the file is not an object"] }
  if (data.version !== STATE_VERSION) return { state: null, problems: [`the file is version ${String(data.version)}, this command reads version ${STATE_VERSION}`] }
  const problems: string[] = []
  const { name, slug, createdAt, updatedAt, linear, steps } = data
  if (!isString(name) || !isString(slug) || !isString(createdAt) || !isString(updatedAt)) problems.push("name, slug, createdAt and updatedAt are text")
  if (!isRecord(linear)) problems.push("linear is an object")
  if (!isRecord(steps)) problems.push("steps is an object")
  if (problems.length > 0 || !isString(name) || !isString(slug) || !isString(createdAt) || !isString(updatedAt) || !isRecord(linear) || !isRecord(steps)) {
    return { state: null, problems }
  }
  const aliases = Array.isArray(data.aliases) ? data.aliases.filter(isString) : []
  if (!aliases.includes(name)) aliases.unshift(name)
  const parsedSteps: Record<string, StepState> = {}
  for (const [id, value] of Object.entries(steps)) parsedSteps[id] = parseStep(value, `steps.${id}`, problems)
  const state: PipelineState = {
    version: STATE_VERSION,
    name,
    aliases,
    slug,
    createdAt,
    updatedAt,
    linear: { parent: parseIssue(linear.parent, "linear.parent", problems), labelId: isString(linear.labelId) && linear.labelId !== '""' ? linear.labelId : null, error: isString(linear.error) ? linear.error : null },
    steps: parsedSteps,
  }
  return problems.length > 0 ? { state: null, problems } : { state, problems: [] }
}

export function statePath(dir: string): string {
  return join(dir, STATE_FILE)
}

/** Written whole to a temporary file and renamed, so that a command stopped in the middle never leaves half a state. */
export function writeState(dir: string, state: PipelineState, now: Date): void {
  state.updatedAt = now.toISOString()
  mkdirSync(dir, { recursive: true })
  const file = statePath(dir)
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`)
  renameSync(temporary, file)
}

export type FoundGame = { dir: string; state: PipelineState }

/** Reads the state of the folder `dir`, or `null` when it holds none. A file that cannot be read is an error that says which. */
export function readState(dir: string): PipelineState | null {
  const file = statePath(dir)
  if (!existsSync(file)) return null
  const parsed = parseState(readFileSync(file, "utf8"))
  if (parsed.state === null) throw new Error(`${file}: ${parsed.problems.join("; ")}`)
  return parsed.state
}

const normalize = (name: string): string => cleanName(name).toLowerCase()

/**
 * The folders that hold a game's state: `<root>/<slug>` and, for a family of games (a folder that holds no state of its own, the line of a game and its reimplementations: `the-crew/` with
 * `the-crew-the-quest-for-planet-nine/` and `the-crew-mission-deep-sea/` in it), `<root>/<family>/<slug>`.
 */
export function gameDirs(root: string): string[] {
  if (!existsSync(root)) return []
  const dirs: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    const dir = join(root, entry.name)
    if (existsSync(statePath(dir))) {
      dirs.push(dir)
      continue
    }
    let children: { name: string; isDirectory: () => boolean }[]
    try {
      children = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const child of children) {
      if (!child.isDirectory() || child.name.startsWith(".")) continue
      const inside = join(dir, child.name)
      if (existsSync(statePath(inside))) dirs.push(inside)
    }
  }
  return dirs
}

/** The game that was asked for by `query` (a name as typed, or a slug): its folder is the slug the name makes, else the one whose state knows the name or a slug it had (the scout may settle another), in a family folder or not. */
export function findGame(root: string, query: string): FoundGame | null {
  const direct = join(root, slugFromName(query))
  const state = readState(direct)
  if (state) return { dir: direct, state }
  const wanted = normalize(query)
  const wantedSlug = slugFromName(query)
  for (const dir of gameDirs(root)) {
    let found: PipelineState | null = null
    try {
      found = readState(dir)
    } catch {
      // the state of another game that cannot be read does not stop this one
      continue
    }
    if (found && (found.slug === query || found.aliases.some((alias) => normalize(alias) === wanted || slugFromName(alias) === wantedSlug))) return { dir, state: found }
  }
  return null
}

/** Every game that has a state, the oldest first. A folder whose state cannot be read is left out (the others are still listed). */
export function listGames(root: string): FoundGame[] {
  const games: FoundGame[] = []
  for (const dir of gameDirs(root)) {
    try {
      const state = readState(dir)
      if (state) games.push({ dir, state })
    } catch {
      // not a state this command wrote
    }
  }
  return games.sort((a, b) => a.state.createdAt.localeCompare(b.state.createdAt))
}

/** The folder of a game moves to the slug the scout settled, in the folder it is in (the family's, when it has one). A folder that is there already is never overwritten. */
export function moveGameDir(fromDir: string, toSlug: string): string {
  const target = join(dirname(fromDir), toSlug)
  if (existsSync(target)) throw new Error(`${target} already exists: the game cannot move to ${toSlug}`)
  renameSync(fromDir, target)
  return target
}

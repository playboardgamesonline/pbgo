// `pnpm add-game "<name>"`: a game from its name to the platform's catalog, one headless Claude Code step at a time, a gate in the terminal after each.
// This file is the order of things; the parts it calls are the state (state.ts), the call and its stream (claude.ts, stream.ts), the gates (gate.ts), the policy
// that bounds a step (policy.ts) and the Linear bookkeeping (linear.ts). The repo is touched by one step only, the rules spec, which writes the two pages of the
// game in `docs/games/<slug>/` and leaves them uncommitted; the rest is the game's folder of working files outside it, the drafts (then, on the word publish,
// the documents) of the platform's Sanity, and the issues of Linear.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { readRulesSpec, specPathsOf, stampValidated } from "@pbgo/games/rules-spec"
import { readScout, type Scout } from "@pbgo/games/scout"
import { cleanName, nameProblem, slugFromName, slugProblem } from "@pbgo/games/slug"
import { callArgs, childEnv, sessionArgs, type RunOptions, type RunOutcome, type SessionOutcome, type SessionRunOptions } from "./claude.ts"
import { downloadsOff, gamesDocsRoot, linearTuning, stepTuning, type Env } from "./config.ts"
import { parseAnswer } from "./gate.ts"
import { applyResult, buildOrder, issueIdsOf, LINEAR_SCHEMA, linearPolicy, linearPrompt } from "./linear.ts"
import { hookSettings, isPublishedId } from "./policy.ts"
import { preflight, serverOfPrefix, type Exec, type Preflight } from "./preflight.ts"
import { extractLinks, formatDuration, formatUsd, palette, printable, rule, shorten, tilde, tildeAll, type Palette } from "./render.ts"
import {
  acquireLock,
  findGame,
  LockedError,
  moveGameDir,
  newState,
  readState,
  stepOf,
  WORK_DIR,
  writeState,
  type FoundGame,
  type Lock,
  type PipelineState,
} from "./state.ts"
import { RunTracker, type RunResult } from "./stream.ts"
import { allowedTools, gameAt, gameOf, STEPS, type Game, type HeadlessStep, type SessionStep, type StepDefinition } from "./steps.ts"

export const EXIT = { ok: 0, failed: 1, usage: 2, noInput: 3, interrupted: 130 } as const

/** What the command says and asks: the terminal, or a test's stand-in. */
export type Io = {
  out: (text: string) => void
  err: (text: string) => void
  /** one line from the owner; `null` when the input is closed or Ctrl-C was pressed (`interrupted` tells which) */
  ask: (prompt: string) => Promise<string | null>
  interrupted: () => boolean
  open: (target: string) => void
}

export type CheckResult = { ok: boolean; lines: string[] }

/** The rulebook of a game, fetched to a file: the number of bytes kept, or why nothing was. */
export type RulebookFetch = { ok: true; bytes: number } | { ok: false; reason: string }

/** What the command reaches out of itself, so that a test can stand in for each. */
export type Deps = {
  env: Env
  repoRoot: string
  /** the folder of the games' working files */
  assets: string
  claudeBin: string
  exec: Exec
  run: (options: RunOptions) => Promise<RunOutcome>
  /** the machine's verdict on a scout file (`pnpm check:scout <file> --online`) */
  checkScout: (file: string) => Promise<CheckResult>
  /** the machine's verdict on the spec of a game (`pnpm check:rules <slug> --name <name>`) */
  checkRules: (slug: string, name: string) => Promise<CheckResult>
  /** the rulebook the scout found, fetched to a file (the command does it, the agent of a step downloads nothing) */
  fetchRulebook: (url: string, dest: string) => Promise<RulebookFetch>
  /** which pictures the published entry of a game has in the platform's Sanity (`pnpm catalog:pictures <slug>`) */
  checkPictures: (slug: string) => Promise<CheckResult>
  /** a session of Claude Code on the owner's terminal, until they leave it */
  session: (options: SessionRunOptions) => Promise<SessionOutcome>
  /** the stage `pnpm check:game` gives a game that has a folder */
  stageOf: (slug: string) => Promise<string | null>
  /** the documents, among these ids, that the platform's Sanity does not show as published (`null`: it could not be read) */
  verifyPublished: (ids: string[]) => Promise<string[] | null>
  now: () => Date
  uuid: () => string
  color: boolean
}

export type Options = {
  name: string
  dryRun: boolean
  yes: boolean
  noLinear: boolean
  newSession: boolean
  redo: string | null
}

type Ctx = {
  io: Io
  deps: Deps
  opts: Options
  pal: Palette
  game: Game
  state: PipelineState
  lock: Lock
  linear: boolean
  prefix: string
  /** `--new-session` is done at the next call, once */
  freshSession: boolean
  /** what the last call of the step showed, kept to print its gate */
  last: { tracker: RunTracker; elapsedMs: number } | null
}

type StepOutcome = "validated" | "stopped" | "failed" | "eof" | "interrupted"

const RESUME_MESSAGE =
  "The previous call of this step was interrupted or stopped. Check what already exists (the files, the drafts), carry on from there, and stop at the gate with the report, as the skill says."

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A word for a shell, in single quotes unless it is plain. */
export function shellQuote(text: string): string {
  return /^[A-Za-z0-9._/=:@%+,-]+$/.test(text) ? text : `'${text.replace(/'/g, "'\\''")}'`
}

function save(ctx: Ctx): void {
  writeState(ctx.game.dir, ctx.state, ctx.deps.now())
}

// ---------- what a game's state says ----------

function stepLine(state: PipelineState, step: StepDefinition, pal: Palette): string {
  const s = stepOf(state, step.id)
  const name = step.title.padEnd(14)
  switch (s.status) {
    case "validated":
      return `${pal.green("✓")} ${name} validated`
    case "gate":
      return `${pal.yellow("…")} ${name} waits at its gate: ${step.gates[s.gate] ?? step.gates[0]}`
    case "running":
      return `${pal.yellow("…")} ${name} was interrupted`
    case "failed":
      return `${pal.red("✗")} ${name} failed: ${s.failure ?? "see the log"}`
    default:
      return `  ${name} not started`
  }
}

/** One line for `--list` and for the summary: where a game stands. */
export function progressOf(state: PipelineState): string {
  const parts = STEPS.map((step) => {
    const s = stepOf(state, step.id)
    if (s.status === "validated") return `${step.title} validated`
    if (s.status === "gate") return `${step.title} at its gate (${step.gates[s.gate] ?? step.gates[0]})`
    if (s.status === "running") return `${step.title} interrupted`
    if (s.status === "failed") return `${step.title} failed`
    return `${step.title} not started`
  })
  return parts.join(" · ")
}

function printPlan(args: { io: Io; pal: Palette; deps: Deps; game: Game; state: PipelineState | null; check: Preflight; linear: boolean }): void {
  const { io, pal, deps, game, state, check } = args
  const tuning = stepTuning(deps.env)
  io.out("")
  io.out(pal.bold(`${game.name} (${game.slug})`))
  io.out(`  Folder     ${tilde(game.dir)}  (pipeline.json, scout.json)`)
  if (state) {
    for (const step of STEPS) io.out(`  ${stepLine(state, step, pal)}`)
  } else {
    STEPS.forEach((step, index) => io.out(`  ${index === 0 ? "Steps     " : "          "} ${index + 1}. ${step.title}: /${step.skill} · ${step.gates.length > 1 ? `gates ${step.gates.join(", ")}` : `gate ${step.gates[0]}`}${step.mode === "session" ? " · a session of your own" : ""}`))
  }
  const login = check.claudeVersion ? `claude ${check.claudeVersion} · claude.ai${check.subscription ? ` (${check.subscription})` : ""}` : "claude not found"
  io.out(`  Headless   ${login} · model ${tuning.model} · ${formatUsd(tuning.budgetUsd)} a call at most · one session for the game`)
  io.out(`  Linear     ${args.linear ? `GAM, project Game factory: "${game.name}: add the game" and a sub-issue per step` : "not used (--no-linear)"}`)
  io.out(`  The repo is touched by one step, the rules spec, which writes docs/games/${game.slug}/ and leaves it uncommitted. Nothing is published before the word publish.`)
  for (const note of check.notes) io.out(pal.dim(`  ${note}`))
}

// ---------- the call of a step ----------

type RoundKind = "first" | "change" | "resume" | "publish"
/** What a round was: `result` is what a headless call said, and nothing for a session of the owner's (what it made is for the gate to check). */
type RoundOutcome = { kind: "ok"; result: RunResult | null } | { kind: "failed"; failure: string } | { kind: "interrupted" }

/** The files of one call: its policy, the settings that register the hook, where the hook logs. */
function writeWorkFiles(ctx: Ctx, name: string, policy: object): { settingsPath: string; policyPath: string; guardLog: string; dir: string } {
  const dir = join(ctx.game.dir, WORK_DIR)
  mkdirSync(join(dir, "logs"), { recursive: true })
  const policyPath = join(dir, `${name}.policy.json`)
  const settingsPath = join(dir, `${name}.settings.json`)
  writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`)
  writeFileSync(settingsPath, `${JSON.stringify(hookSettings({ nodePath: process.execPath, guardFile: join(ctx.deps.repoRoot, "packages", "pipeline", "hook", "guard.ts") }), null, 2)}\n`)
  return { settingsPath, policyPath, guardLog: join(dir, "guard.log"), dir }
}

const stamp = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

const formatBytes = (bytes: number): string => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/**
 * What a step needs before its call. The rules spec reads the rulebook of the game: the command fetches the one the scout found (the address the owner validated at its gate) to `rules.pdf`
 * next to the scout file, because the agent downloads nothing and a PDF it fetches with a web tool is not readable. A file that is there is the owner's own or an earlier fetch and is never
 * replaced. It never stops the step: the skill says what it lacks, and the owner puts the file there and says retry.
 */
async function prepareStep(ctx: Ctx, step: StepDefinition): Promise<void> {
  if (step.id !== "rules-spec") return
  const { game, io, pal, deps } = ctx
  if (existsSync(game.rulesPdf)) return
  const rules = readScoutFile(game.scoutFile)?.edition.rules ?? null
  if (!rules) {
    io.out(pal.dim("· Rulebook: the scout found no address for it; the skill reads what it can find, or says where to put the PDF"))
    return
  }
  if (downloadsOff(deps.env)) {
    io.out(pal.dim(`· Rulebook: not fetched (downloads are off); put the PDF at ${tilde(game.rulesPdf)} if the rules are not a web page`))
    return
  }
  io.out(pal.dim(`· Rulebook: fetching ${shorten(printable(rules.url), 160)}…`))
  const fetched = await deps.fetchRulebook(rules.url, game.rulesPdf)
  if (fetched.ok) io.out(pal.dim(`  ${tilde(game.rulesPdf)}: ${formatBytes(fetched.bytes)}`))
  else io.out(pal.yellow(`! The rulebook was not fetched (${shorten(printable(fetched.reason), 160)}). A PDF has to be at ${tilde(game.rulesPdf)}: put it there and type retry at the gate; a web page is read as it is.`))
}

/** One call of a step, shown as it runs. The state says `running` while it does, and `gate` or `failed` when it ends. */
async function callRound(ctx: Ctx, step: HeadlessStep, kind: RoundKind, extra: { message?: string; publishIds?: string[]; retried?: boolean } = {}): Promise<RoundOutcome> {
  const { deps, io, state, pal } = ctx
  const s = stepOf(state, step.id)
  s.status = "running"
  s.failure = null
  s.startedAt ??= deps.now().toISOString()
  // only the call that publishes comes from the second gate: any other call is the work again, and its gate is the first
  if (kind !== "publish") s.gate = 0
  // a fresh session never takes the word publish: it would not know what the owner was shown
  if (ctx.freshSession && kind !== "publish") {
    state.session = { id: deps.uuid(), started: false }
    ctx.freshSession = false
  }
  if (kind !== "publish") await prepareStep(ctx, step)
  const prompt = kind === "first" ? step.prompt(ctx.game) : kind === "resume" ? RESUME_MESSAGE : kind === "publish" ? "validate" : (extra.message ?? "")
  const files = writeWorkFiles(ctx, step.id, step.policy(ctx.game, deps.repoRoot, { composioServer: serverOfPrefix(ctx.prefix), publishIds: extra.publishIds ?? [], gamesDocs: gamesDocsRoot(deps.env) }))
  const tuning = stepTuning(deps.env)
  const resume = state.session.started
  const args = callArgs({
    prompt,
    session: { id: state.session.id, resume },
    name: `add-game: ${state.name}`,
    model: tuning.model,
    budgetUsd: tuning.budgetUsd,
    settingsPath: files.settingsPath,
    tools: allowedTools(step, ctx.prefix),
  })
  // the one word that lets the hook pass a Sanity write that is not a draft is given to the call that publishes, and says no to every other (whatever the shell had)
  const env = childEnv(deps.env, { PBGO_GUARD_POLICY: files.policyPath, PBGO_GUARD_LOG: files.guardLog, PBGO_PUBLISH_OK: kind === "publish" ? "1" : "0" })
  state.session.started = true
  save(ctx)

  io.out("")
  io.out(pal.dim(`${titleCase(step.title)}: ${kind === "first" ? `/${step.skill}` : kind === "change" ? "your change" : kind === "publish" ? "publishing" : "resuming the session"}…`))
  const tracker = new RunTracker()
  const started = Date.now()
  const outcome = await deps.run({
    bin: deps.claudeBin,
    args,
    cwd: deps.repoRoot,
    env,
    onEvent: (event) => {
      for (const line of tracker.feed(event)) io.out(pal.dim(`  ${stamp(Date.now() - started)}  ${line}`))
      return tracker.apiKeySource !== null && tracker.apiKeySource !== "none" ? "stop" : undefined
    },
  })
  const elapsedMs = Date.now() - started
  try {
    // named by the time, to the millisecond: a round never overwrites the log of an earlier one (a step taken again, a change asked twice)
    writeFileSync(join(files.dir, "logs", `${step.id}-${deps.now().toISOString().replace(/[-:.]/g, "")}-${kind}.jsonl`), outcome.raw)
  } catch {
    // the log is a help, never a reason to stop
  }

  const fail = (failure: string): RoundOutcome => {
    // a failure can carry what the agent wrote (the message of a failed call): it is kept and shown as text
    const clean = printable(failure)
    s.status = "failed"
    s.failure = clean
    save(ctx)
    return { kind: "failed", failure: clean }
  }
  if (outcome.spawnError) return fail(outcome.spawnError)
  if (outcome.interrupted) {
    save(ctx)
    return { kind: "interrupted" }
  }
  if (tracker.apiKeySource !== null && tracker.apiKeySource !== "none") return fail(`the call ran on ${tracker.apiKeySource} instead of your login: it was stopped before it did anything`)
  const result = tracker.result
  if (!result) return fail(`claude ended without a result (exit code ${outcome.code ?? "none"})${outcome.stderr.trim() ? `: ${shorten(outcome.stderr, 200)}` : ""}`)
  if (!result.ok) {
    // a session that was never made (the first call died before the CLI wrote it) cannot be resumed: start it again, once (never for the call that publishes)
    if (resume && !extra.retried && kind !== "publish" && /no conversation found/i.test(`${result.text} ${outcome.stderr}`)) {
      state.session.started = false
      return callRound(ctx, step, kind === "resume" ? "first" : kind, { ...extra, retried: true })
    }
    return fail(result.failure ?? "the call failed")
  }
  s.rounds += 1
  s.costUsd += result.costUsd
  // what the agent wrote is printed and kept as text, never as the escape sequences it may hold; the report of the publication does not replace the one the owner validated
  if (kind !== "publish") {
    s.report = printable(result.text)
    s.links = extractLinks(s.report)
  }
  s.status = "gate"
  ctx.last = { tracker, elapsedMs }
  save(ctx)
  return { kind: "ok", result }
}

// ---------- a session of the owner's ----------

const SESSION_RESUME_MESSAGE = "We were interrupted. Check what already exists (the files, the drafts, what is published), carry on from there, and stop at the end of the skill with its report."

/**
 * One session of a step that is the owner's own: Claude Code opened in their terminal on the skill, in the session of the game, until they leave it. They approve each action in it, so there is no
 * policy and no hook; what the command does is wait, and then check the result (`afterCall`). The state says `running` while the session is open and `gate` when it ends, as for a headless call.
 */
async function sessionRound(ctx: Ctx, step: SessionStep, kind: "first" | "change" | "resume", message = ""): Promise<RoundOutcome> {
  const { deps, io, state, pal } = ctx
  const s = stepOf(state, step.id)
  s.status = "running"
  s.failure = null
  s.startedAt ??= deps.now().toISOString()
  s.gate = 0
  if (ctx.freshSession) {
    state.session = { id: deps.uuid(), started: false }
    ctx.freshSession = false
  }
  const prompt = kind === "first" ? step.prompt(ctx.game) : kind === "resume" ? SESSION_RESUME_MESSAGE : message
  const resume = state.session.started
  const args = sessionArgs({ prompt, session: { id: state.session.id, resume }, name: `add-game: ${state.name}`, model: stepTuning(deps.env).model })
  state.session.started = true
  save(ctx)

  io.out("")
  io.out(rule(`${titleCase(step.title)} · ${state.name} · a session of your own`, pal))
  io.out(`Claude Code opens here on /${step.skill}, in the session of the game. You approve each action in it. Leave it with /exit when you are done: the command then checks what it made and asks for your validation.`)
  io.out(pal.dim(`  folder  ${tilde(step.folder(ctx.game))}`))
  const outcome = await deps.session({ bin: deps.claudeBin, args, cwd: deps.repoRoot, env: childEnv(deps.env) })
  io.out("")
  if (outcome.spawnError) {
    const clean = printable(outcome.spawnError)
    s.status = "failed"
    s.failure = clean
    save(ctx)
    return { kind: "failed", failure: clean }
  }
  s.rounds += 1
  s.status = "gate"
  s.report = null
  s.links = []
  ctx.last = null
  save(ctx)
  return { kind: "ok", result: null }
}

/** One round of a step, whatever its kind: a headless call, or a session of the owner's. */
function round(ctx: Ctx, step: StepDefinition, kind: RoundKind, extra: { message?: string; publishIds?: string[] } = {}): Promise<RoundOutcome> {
  if (step.mode === "session") return sessionRound(ctx, step, kind === "publish" ? "change" : kind, extra.message)
  return callRound(ctx, step, kind, extra)
}

// ---------- the scout ----------

function readScoutFile(file: string): Scout | null {
  if (!existsSync(file)) return null
  return readScout(readFileSync(file, "utf8")).scout
}

/** What the machine says of the scout file once the call is over: it exists, it has the shape, it passes `check:scout --online`. */
async function checkScoutStep(ctx: Ctx): Promise<void> {
  const s = stepOf(ctx.state, "scout")
  const file = ctx.game.scoutFile
  if (!existsSync(file)) {
    s.check = { ok: false, lines: [`no scout file was written (${tilde(file)}): the skill stopped before it, say what it asks`] }
    return
  }
  const parsed = readScout(readFileSync(file, "utf8"))
  if (parsed.scout === null) {
    s.check = { ok: false, lines: [`${tilde(file)} is not a scout file:`, ...parsed.problems.map((problem) => `  - ${problem}`)] }
    return
  }
  const verdict = await ctx.deps.checkScout(file)
  s.check = { ok: verdict.ok, lines: verdict.lines }
}

// ---------- the rules spec ----------

/** What the machine says of the spec once the call is over: the page exists, it has the shape, its title is the game's (`pnpm check:rules <slug> --name <name>`). */
async function checkRulesStep(ctx: Ctx): Promise<void> {
  const s = stepOf(ctx.state, "rules-spec")
  const files = specPathsOf(gamesDocsRoot(ctx.deps.env), ctx.state.slug)
  if (!existsSync(files.rules)) {
    s.check = { ok: false, lines: [`no spec was written (docs/games/${ctx.state.slug}/rules.md): the skill stopped before it, say what it asks`] }
    return
  }
  const verdict = await ctx.deps.checkRules(ctx.state.slug, ctx.state.name)
  s.check = { ok: verdict.ok, lines: verdict.lines }
}

/** The day, as the owner's clock says it (`YYYY-MM-DD`). */
const dayOf = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

/**
 * The owner validated the spec: its status and every reading that waited for their word become "validated" with the day (the gate said that validating accepts the readings). `null` when
 * the page is stamped, else what stopped it. A page that is validated already is left as it is.
 */
function stampSpec(ctx: Ctx): string | null {
  const file = specPathsOf(gamesDocsRoot(ctx.deps.env), ctx.state.slug).rules
  try {
    const text = readFileSync(file, "utf8")
    const stamped = stampValidated(text, dayOf(ctx.deps.now()))
    if (stamped === text) return null
    if (readRulesSpec(stamped).spec === null) return "stamping the validation would leave a page that does not pass the check: nothing was changed"
    writeFileSync(file, stamped)
    return null
  } catch (error) {
    return `the spec cannot be stamped (${error instanceof Error ? shorten(error.message, 120) : "unreadable"})`
  }
}

// ---------- the pictures ----------

/** What the platform's public API says of the entry of the game once the session is over: published, and which of the five pictures it has (`pnpm catalog:pictures <slug>`). */
async function checkPicturesStep(ctx: Ctx): Promise<void> {
  const s = stepOf(ctx.state, "platform-assets")
  const verdict = await ctx.deps.checkPictures(ctx.state.slug)
  s.check = { ok: verdict.ok, lines: verdict.lines }
}

/** The scout settled the name and the slug: the game's records follow (its folder moves to the slug). `null` when all went well, else what stopped it. */
function settleScout(ctx: Ctx): string | null {
  const scout = readScoutFile(ctx.game.scoutFile)
  if (scout === null) return "the scout file cannot be read"
  const { state, deps } = ctx
  if (scout.slug !== state.slug && existsSync(join(deps.repoRoot, "games", scout.slug))) return `games/${scout.slug} exists already: ${scout.name} has a folder, there is nothing to add`
  const target = join(deps.assets, scout.slug)
  // the folder may be at the slug already (a run that stopped between the move and the save)
  if (resolve(ctx.game.dir) !== resolve(target)) {
    try {
      moveGameDir(deps.assets, ctx.game.dir, scout.slug)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  ctx.lock.dir = target
  if (!state.aliases.includes(scout.name)) state.aliases.push(scout.name)
  state.name = scout.name
  state.slug = scout.slug
  ctx.game = gameAt(target, state.name, state.slug)
  return null
}

// ---------- Linear ----------

/** Brings Linear up to date. `"interrupted"` when Ctrl-C ended the call (the command stops too); any other failure is told and the game goes on. */
async function syncLinear(ctx: Ctx, reason: string): Promise<"interrupted" | null> {
  if (!ctx.linear) return null
  const { deps, io, state, pal } = ctx
  const order = buildOrder(state, STEPS, ctx.game)
  if (!order) return null
  io.out(pal.dim(`· Linear: ${reason}…`))
  const tuning = linearTuning(deps.env)
  const files = writeWorkFiles(ctx, "linear", linearPolicy(ctx.game, deps.repoRoot, { composioServer: serverOfPrefix(ctx.prefix), issueIds: issueIdsOf(state) }))
  const args = callArgs({
    prompt: linearPrompt(order, ctx.prefix),
    session: { id: deps.uuid(), resume: false },
    name: `add-game: ${state.name} (linear)`,
    model: tuning.model,
    budgetUsd: tuning.budgetUsd,
    settingsPath: files.settingsPath,
    tools: ["ToolSearch", `${ctx.prefix}COMPOSIO_SEARCH_TOOLS`, `${ctx.prefix}COMPOSIO_GET_TOOL_SCHEMAS`],
    jsonSchema: LINEAR_SCHEMA,
    ephemeral: true,
  })
  const tracker = new RunTracker()
  const started = Date.now()
  const outcome = await deps.run({
    bin: deps.claudeBin,
    args,
    cwd: deps.repoRoot,
    // the bookkeeping never publishes anything: the word is refused to it, whatever the shell had
    env: childEnv(deps.env, { PBGO_GUARD_POLICY: files.policyPath, PBGO_GUARD_LOG: files.guardLog, PBGO_PUBLISH_OK: "0" }),
    onEvent: (event) => {
      for (const line of tracker.feed(event)) io.out(pal.dim(`  ${stamp(Date.now() - started)}  ${line}`))
      return tracker.apiKeySource !== null && tracker.apiKeySource !== "none" ? "stop" : undefined
    },
  })
  if (outcome.interrupted) {
    io.out("")
    io.out("Stopped (Ctrl-C). Nothing of the game is lost: run the command again, Linear is brought up to date then.")
    return "interrupted"
  }
  const result = tracker.result
  let problem: string | null = null
  if (outcome.spawnError) problem = outcome.spawnError
  else if (!result) problem = "claude ended without a result"
  else if (!result.ok) problem = result.failure ?? "the call failed"
  else problem = applyResult(state, result.structured, order).join("; ") || null
  state.linear.error = problem
  if (problem) io.out(pal.yellow(`! Linear was not updated (${shorten(problem, 160)}): the game goes on, the next point tries again`))
  else io.out(pal.dim(`  Linear: ${state.linear.parent?.identifier ?? "done"} up to date`))
  save(ctx)
  return null
}

// ---------- the gate ----------

/**
 * The documents that publishing makes public, from the skill's own sentence ("Validate publishes 3 documents (game-x, publisher-y)"). Empty when the sentence is not
 * there or does not add up: the owner is shown these ids, and these are the only ones the call that publishes may publish, so without them there is no `publish`.
 */
export function publishedIds(report: string): string[] {
  const match = /Validate publishes (\d+) documents?\s*\(([^)]*)\)/i.exec(report)
  if (!match) return []
  const ids = (match[2] ?? "").split(",").map((id) => id.trim()).filter(Boolean)
  return ids.length === Number(match[1]) && new Set(ids).size === ids.length && ids.every(isPublishedId) ? ids : []
}

/** The line of the second gate: what `publish` makes public. */
export function publishLine(report: string): string | null {
  const ids = publishedIds(report)
  return ids.length > 0 ? `publish makes ${ids.length} document${ids.length === 1 ? "" : "s"} public (${ids.join(", ")}): they are on the hub within about eleven minutes.` : null
}

/** The gate as the owner sees it: `full` is the report with its checks, `publish` the next gate once the work is validated (the report was just read). */
function showGate(ctx: Ctx, step: StepDefinition, mode: "full" | "publish" = "full"): void {
  const { io, pal, state } = ctx
  const s = stepOf(state, step.id)
  const last = ctx.last
  const header = mode === "publish" ? [titleCase(step.title), state.name, "drafts validated"] : [titleCase(step.title), state.name, `round ${s.rounds}`, ...(last ? [formatDuration(last.elapsedMs), formatUsd(s.costUsd)] : ["at its gate"])]
  io.out("")
  io.out(rule(header.join(" · "), pal))
  if (mode === "full") {
    io.out(s.report ?? (step.mode === "session" ? "The session is over; what it made is below, as the platform shows it." : "(the call left no report)"))
    io.out("")
  }
  if (mode === "full" && s.check) for (const line of s.check.lines) io.out(`${s.check.ok && line === s.check.lines[0] ? pal.green("✓") : s.check.ok ? " " : pal.red("✗")} ${tildeAll(line)}`)
  if (mode === "full" && last && last.tracker.denials.length > 0) io.out(pal.yellow(`! ${last.tracker.denials.length} call${last.tracker.denials.length === 1 ? "" : "s"} blocked by the policy: ${last.tracker.denials.map((d) => `${d.tool} ${d.target}`.trim()).join("; ")}`))
  if (s.links.length > 0) for (const link of s.links) io.out(`  ${pal.cyan(link)}`)
  const tracker = last?.tracker
  const usage = tracker?.rate ? ` · usage ${tracker.rate.fiveHour === null ? "" : `5 h ${Math.round(tracker.rate.fiveHour * 100)} %`}${tracker.rate.sevenDay === null ? "" : ` · week ${Math.round(tracker.rate.sevenDay * 100)} %`}` : ""
  io.out(pal.dim(`  claude --resume ${state.session.id}${usage}`))
  if (step.gates[s.gate] === "publish") {
    io.out("")
    io.out(publishLine(s.report ?? "") ?? pal.red('The report does not say which documents publish would make public ("Validate publishes N documents (ids)"): `publish` is refused, type b and ask for it.'))
    io.out(pal.dim("There is no preview of a draft on the hub yet (the hub reads published documents only): the Studio page above is what to look at."))
  }
}

/** What `o` opens: the platform's own addresses (its Studio, its site) and the scout file, never another address of what the agent wrote. */
const OPENABLE = /^https:\/\/(?:[a-z0-9-]+\.)*(?:sanity\.studio|playboardgamesonline\.app)(?:[/?#]|$)/

export function openableTarget(links: readonly string[], file: string | null): string | null {
  return links.find((candidate) => OPENABLE.test(candidate)) ?? file
}

function openTarget(ctx: Ctx, step: StepDefinition): string | null {
  const file = step.id === "scout" ? ctx.game.scoutFile : step.id === "rules-spec" ? specPathsOf(gamesDocsRoot(ctx.deps.env), ctx.state.slug).rules : step.mode === "session" ? step.folder(ctx.game) : null
  return openableTarget(stepOf(ctx.state, step.id).links, file !== null && existsSync(file) ? file : null)
}

async function finishStep(ctx: Ctx, step: StepDefinition): Promise<StepOutcome> {
  const s = stepOf(ctx.state, step.id)
  s.status = "validated"
  s.validatedAt = ctx.deps.now().toISOString()
  save(ctx)
  ctx.io.out(ctx.pal.green(`✓ ${titleCase(step.title)} validated`))
  return (await syncLinear(ctx, `${step.title} validated`)) ?? "validated"
}

/** After a call: the machine's check of what the step wrote. */
async function afterCall(ctx: Ctx, step: StepDefinition): Promise<void> {
  if (step.id === "scout") await checkScoutStep(ctx)
  if (step.id === "rules-spec") await checkRulesStep(ctx)
  if (step.id === "platform-assets") await checkPicturesStep(ctx)
}

async function gateLoop(ctx: Ctx, step: StepDefinition): Promise<StepOutcome> {
  const { io, pal } = ctx
  const s = stepOf(ctx.state, step.id)
  showGate(ctx, step)
  for (;;) {
    const gate = step.gates[s.gate] ?? "validate"
    if (gate === "publish") io.out(`${pal.bold("publish")} · b to change something · q stops (the drafts stay)`)
    else io.out(`${pal.bold("validate")}${step.gates.length > 1 ? " (the drafts are right)" : ""} · or type what to change · ${step.id === "catalog-entry" ? "o opens the draft · " : step.id === "rules-spec" ? "o opens the spec · " : step.id === "platform-assets" ? "o opens the pictures · " : ""}q stops (everything is saved)`)
    const line = await io.ask("> ")
    if (line === null) {
      io.out("")
      io.out(io.interrupted() ? "Stopped." : "No answer (the input is closed): the game is saved at this gate, run the command again.")
      return io.interrupted() ? "interrupted" : "eof"
    }
    const answer = parseAnswer(line, gate)
    switch (answer.kind) {
      case "empty":
        io.out(pal.dim("Enter alone is not a yes."))
        break
      case "unknown":
        io.out(pal.dim(answer.hint))
        break
      case "open": {
        const target = openTarget(ctx, step)
        if (target) io.open(target)
        else io.out(pal.dim("Nothing to open from here: only the platform's own addresses and the scout file are."))
        break
      }
      case "quit":
        io.out("Stopped. Everything is saved: run the command again to come back to this gate.")
        return "stopped"
      case "back":
        s.gate = 0
        save(ctx)
        showGate(ctx, step)
        break
      case "validate": {
        if (step.id === "scout") {
          if (!s.check?.ok) {
            io.out(pal.red("✗ The scout file does not pass the check above: type what to change."))
            break
          }
          const problem = settleScout(ctx)
          if (problem) {
            io.out(pal.red(`✗ ${problem}`))
            break
          }
        }
        if (step.id === "platform-assets") {
          // what is published is what the public API says now, not what the session said: asked again, and the step is validated only for a game that is published
          await checkPicturesStep(ctx)
          if (!s.check?.ok) {
            for (const line of s.check?.lines ?? []) io.out(`${pal.red("✗")} ${tildeAll(line)}`)
            io.out(pal.red("✗ The platform's Sanity does not show the entry of the game as published: type what to change (a session opens again with your message)."))
            break
          }
        }
        if (step.id === "rules-spec") {
          // the page may have been edited by hand since the call: it is judged again, and stamped as validated only when it passes
          await checkRulesStep(ctx)
          if (!s.check?.ok) {
            for (const line of s.check?.lines ?? []) io.out(`${pal.red("✗")} ${tildeAll(line)}`)
            io.out(pal.red("✗ The spec does not pass the check: type what to change."))
            break
          }
          const problem = stampSpec(ctx)
          if (problem) {
            io.out(pal.red(`✗ ${problem}`))
            break
          }
        }
        if (s.gate + 1 < step.gates.length) {
          s.gate += 1
          save(ctx)
          showGate(ctx, step, "publish")
          break
        }
        return finishStep(ctx, step)
      }
      case "publish": {
        // a session of the owner's has no second gate: the word is a headless step's
        if (step.mode !== "headless") break
        const ids = publishedIds(s.report ?? "")
        if (ids.length === 0) {
          io.out(pal.red("✗ The report does not say which documents publish would make public: type b, then ask for the sentence \"Validate publishes N documents (ids)\"."))
          break
        }
        const outcome = await callRound(ctx, step, "publish", { publishIds: ids })
        const done = settleRound(ctx, outcome)
        if (done) return done
        io.out("")
        io.out(outcome.kind === "ok" && outcome.result ? printable(outcome.result.text) : "")
        // the skill says it published: the public API of the platform's Sanity is asked, nothing is recorded on its word alone
        const missing = await ctx.deps.verifyPublished(ids)
        if (missing !== null && missing.length > 0) {
          io.out(pal.red(`✗ Not published: ${missing.join(", ")}. The skill said it was done and the platform's Sanity does not show it, so nothing is recorded: look in the Studio, then type publish again, or b.`))
          s.status = "gate"
          s.gate = 1
          save(ctx)
          showGate(ctx, step, "publish")
          break
        }
        if (missing === null) io.out(pal.yellow("! The platform's Sanity could not be read to confirm the publication: the skill's own read-back is above."))
        return finishStep(ctx, step)
      }
      case "change": {
        const outcome = await round(ctx, step, "change", { message: answer.text })
        const done = settleRound(ctx, outcome)
        if (done) return done
        await afterCall(ctx, step)
        save(ctx)
        showGate(ctx, step)
        break
      }
    }
  }
}

/** What a failed or interrupted call means for the command: `null` when the call went well. */
function settleRound(ctx: Ctx, outcome: RoundOutcome): StepOutcome | null {
  if (outcome.kind === "ok") return null
  if (outcome.kind === "interrupted") {
    ctx.io.out("")
    ctx.io.out("Stopped (Ctrl-C). The session is saved: run the command again to resume it.")
    return "interrupted"
  }
  ctx.io.err(ctx.pal.red(`✗ ${printable(outcome.failure)}`))
  ctx.io.err("The game is saved: run the command again to try the step once more.")
  return "failed"
}

async function runStep(ctx: Ctx, step: StepDefinition): Promise<StepOutcome> {
  const { io, pal } = ctx
  const s = stepOf(ctx.state, step.id)
  if (s.status === "validated") {
    io.out(`${pal.green("✓")} ${titleCase(step.title)} is validated already`)
    return "validated"
  }
  if (s.status === "gate") {
    io.out(pal.dim(`${titleCase(step.title)} waits at its gate: the report is shown again, nothing is called.`))
    return gateLoop(ctx, step)
  }
  let kind: RoundKind = "first"
  if (s.status === "failed") kind = ctx.state.session.started ? "resume" : "first"
  if (s.status === "running") {
    io.out(pal.yellow(`The last call of the ${step.title} step was interrupted.`))
    const line = await ctx.io.ask("Resume its session? [Y/n] ")
    if (line === null) return ctx.io.interrupted() ? "interrupted" : "eof"
    kind = /^n/i.test(line.trim()) ? "first" : "resume"
  }
  const outcome = await round(ctx, step, kind)
  const done = settleRound(ctx, outcome)
  if (done) return done
  await afterCall(ctx, step)
  save(ctx)
  return gateLoop(ctx, step)
}

// ---------- the whole run ----------

const RULEBOOK_LANGUAGES: readonly string[] = ["en", "fr", "es", "de"]

function printNext(ctx: Ctx): void {
  const { io, pal, state } = ctx
  const scout = readScoutFile(ctx.game.scoutFile)
  const language = scout?.edition.rules?.language ?? null
  io.out("")
  io.out(rule(`${state.name} is in the platform's catalog, its rules are written down`, pal))
  io.out(`Its rules spec is in your checkout, uncommitted: docs/games/${state.slug}/ (rules.md and index.md). The game's first pull request takes it.`)
  io.out("Next, which this command does not do yet: the game's folder, its Sanity project and its Studio.")
  // the rulebook the command fetched (or the owner put) is the PDF to hand to the script, when its language is one of the four of the games
  const rulebook = existsSync(ctx.game.rulesPdf) && language !== null && RULEBOOK_LANGUAGES.includes(language) ? `${language}=${ctx.game.rulesPdf}` : "en=<the rulebook PDF>"
  io.out(`  pnpm add-game ${state.slug} --name ${shellQuote(state.name)} --rules ${shellQuote(rulebook)}`)
  if (scout?.edition.rules) io.out(pal.dim(`  rulebook found by the scout: ${scout.edition.rules.url} (${scout.edition.rules.language}${scout.edition.rules.version ? `, ${scout.edition.rules.version}` : ""})`))
  io.out("Then /game-new proposes the fields of its Studio, and the engine is written from the spec (/engine-rules).")
}

/** The game has a folder in the repo: its stages are `pnpm check:game`'s, this command has nothing to add. */
async function folderCase(args: { io: Io; deps: Deps; pal: Palette; slug: string; state: PipelineState | null }): Promise<number> {
  const { io, deps, pal, slug, state } = args
  const stage = await deps.stageOf(slug)
  io.out(`${pal.bold(slug)} has a folder in the repo (games/${slug})${stage ? `: it has got as far as the stage ${stage}` : ""}.`)
  io.out(`Nothing to scout or to add to the catalog from here: \`pnpm check:game ${slug}\` says what its next step is.`)
  if (state) io.out(pal.dim(`Pipeline: ${progressOf(state)}`))
  return EXIT.ok
}

export async function runPipeline(opts: Options, io: Io, deps: Deps): Promise<number> {
  const pal = palette(deps.color)
  const name = cleanName(opts.name)
  const problem = nameProblem(name) ?? slugProblem(slugFromName(name))
  if (problem) {
    io.err(pal.red(`✗ ${problem}`))
    return EXIT.usage
  }
  let found: FoundGame | null = null
  try {
    found = findGame(deps.assets, name)
  } catch (error) {
    io.err(pal.red(`✗ ${error instanceof Error ? error.message : String(error)}`))
    return EXIT.failed
  }
  if (opts.redo && !found) {
    io.err(pal.red(`✗ --redo ${opts.redo}: ${name} is not in the pipeline yet, there is nothing to redo`))
    return EXIT.usage
  }
  const slug = found?.state.slug ?? slugFromName(name)
  if (existsSync(join(deps.repoRoot, "games", slug))) return folderCase({ io, deps, pal, slug, state: found?.state ?? null })

  const check = await preflight({ exec: deps.exec, env: deps.env, repoRoot: deps.repoRoot, claudeBin: deps.claudeBin, needsComposio: true })
  if (/[^A-Za-z0-9._/~@%+=,:-]/.test(deps.assets)) check.problems.push(`the folder of the games' files (${deps.assets}) has a space or a special character in its path: the skills take it as one word, set PBGO_ASSETS_DIR to a plain path`)
  const linear = !opts.noLinear
  const game = found ? gameAt(found.dir, found.state.name, found.state.slug) : gameOf(deps.assets, name, slug)
  printPlan({ io, pal, deps, game, state: found?.state ?? null, check, linear })
  if (check.problems.length > 0) {
    io.out("")
    for (const each of check.problems) io.err(pal.red(`✗ ${each}`))
    return EXIT.failed
  }
  if (opts.dryRun) {
    io.out("")
    io.out(found ? "Nothing was called or written (--dry-run): the same command without it goes on from here." : "Nothing was created (--dry-run): the same command without it starts the game.")
    return EXIT.ok
  }

  if (!found) {
    if (!opts.yes) {
      io.out("")
      const answer = await io.ask("Start? [Y/n] ")
      if (answer === null) return io.interrupted() ? EXIT.interrupted : EXIT.noInput
      if (/^n/i.test(answer.trim())) {
        io.out("Cancelled, nothing was created.")
        return EXIT.ok
      }
    }
  }

  let lock: Lock
  try {
    lock = acquireLock(game.dir)
  } catch (error) {
    io.err(pal.red(`✗ ${error instanceof LockedError ? error.message : error instanceof Error ? error.message : String(error)}`))
    return EXIT.failed
  }
  const release = () => lock.release()
  process.once("exit", release)
  try {
    // read once the lock is held: a run that was in progress when this one began has written its progress by now
    const state = found ? (readState(found.dir) ?? found.state) : newState({ name, slug, sessionId: deps.uuid(), now: deps.now() })
    if (opts.redo) {
      const from = STEPS.findIndex((step) => step.id === opts.redo)
      for (const step of STEPS.slice(from)) {
        const s = stepOf(state, step.id)
        s.status = "pending"
        s.gate = 0
        s.failure = null
        s.validatedAt = null
        s.report = null
        s.check = null
      }
    }
    const ctx: Ctx = { io, deps, opts, pal, game, state, lock, linear, prefix: check.composioPrefix, freshSession: opts.newSession, last: null }
    for (const step of STEPS) stepOf(state, step.id)
    save(ctx)
    if (!found) io.out(pal.dim(`  State: ${tilde(game.dir)}/pipeline.json`))
    if ((await syncLinear(ctx, found ? "bringing the issues up to date" : "making the issues")) === "interrupted") return EXIT.interrupted

    for (const step of STEPS) {
      const outcome = await runStep(ctx, step)
      if (outcome === "validated") continue
      if (outcome === "interrupted") return EXIT.interrupted
      if (outcome === "eof") return EXIT.noInput
      return outcome === "failed" ? EXIT.failed : EXIT.ok
    }
    printNext(ctx)
    return EXIT.ok
  } finally {
    process.off("exit", release)
    release()
  }
}

/** `--list`: the games that have a state, where each stands. */
export async function listPipeline(io: Io, deps: Deps, games: { state: PipelineState }[]): Promise<number> {
  const pal = palette(deps.color)
  if (games.length === 0) {
    io.out(`No game is in the pipeline (${tilde(deps.assets)} has no pipeline.json).`)
    return EXIT.ok
  }
  io.out(pal.bold(`Games in the pipeline (${tilde(deps.assets)})`))
  const width = Math.max(...games.map(({ state }) => state.slug.length))
  for (const { state } of games) {
    const stage = existsSync(join(deps.repoRoot, "games", state.slug)) ? await deps.stageOf(state.slug) : null
    io.out(`  ${state.slug.padEnd(width)}  ${state.name}: ${progressOf(state)}${stage ? ` · folder in the repo, stage ${stage}` : ""}${state.linear.parent ? ` · ${state.linear.parent.identifier}` : ""}`)
  }
  return EXIT.ok
}

// `pnpm game-flow`: what the skill `/add-game` keeps the state of a game with. The skill runs the steps (a sub-agent each) and talks to the owner; this keeps what must not be improvised: where the game
// stands, which step is next and whether it may begin, the brief of a sub-agent, the machine's check of what it left, what the owner's ok does, the Linear work and the rulebook. The state is one file
// per game (`state.ts`) and the skill is its only writer, one command at a time (`lock.ts` makes two that run together wait for each other). Every verb prints what to do next, and exits 0 when it
// did what it was asked, 1 when it refused, 2 for a wrong command line.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { specPathsOf } from "@pbgo/games/rules-spec"
import { readScout, type Scout } from "@pbgo/games/scout"
import { cleanName, nameProblem, slugFromName, slugProblem } from "@pbgo/games/slug"
import { briefOf } from "./brief.ts"
import { runCheck, stageOf, stampRules, type CheckDeps, type CheckResult } from "./checks.ts"
import { applyResult, buildOrder, linearPrompt, parseAnswer } from "./linear.ts"
import { withLock } from "./lock.ts"
import { publishLine, publishedIds } from "./publish.ts"
import { findGame, listGames, moveGameDir, newState, stepOf, writeState, type FoundGame, type PipelineState } from "./state.ts"
import { firstOpen, gameAt, STEPS, stepById, type Game, type StepDefinition } from "./steps.ts"
import { extractLinks, printable, shorten, tilde, tildeAll } from "./text.ts"

export const EXIT = { ok: 0, failed: 1, usage: 2 } as const

/** What the report of a step that was taken on as it was says: it was done outside `/add-game`. */
export const ADOPTED = "taken on as it was: done outside /add-game"

/** The rulebook of a game, fetched to a file: the number of bytes kept, or why nothing was. */
export type RulebookFetch = { ok: true; bytes: number } | { ok: false; reason: string }

/** What the command reaches out of itself, so that a test can stand in for each. */
export type FlowDeps = CheckDeps & {
  /** the folder of the games' working files */
  assets: string
  fetchRulebook: (url: string, dest: string) => Promise<RulebookFetch>
  now: () => Date
  out: (text: string) => void
  err: (text: string) => void
  /** how long a command waits for another to let go of the lock (10 s) */
  lockTimeoutMs?: number
}

export const VERBS = ["status", "start", "begin", "gate", "check", "validate", "fail", "redo", "rulebook", "linear", "linear-record"] as const

export const USAGE = `Usage: pnpm game-flow <verb> …     the state of a game that goes through /add-game (the skill that runs it is .claude/skills/add-game)

  status [<game>] [--step <id>] [--json]            where a game stands and what is next; with no game, the games in the flow
  start "<Game Name>" [--family <folder>] [--adopt-through <step>]   a game enters the flow (--family: its folder is in the folder of its line, assets/<folder>/<slug>; a game that has a folder in the repo only with --adopt-through)
  begin <game> <step> [--scratch <dir>] [--change | --again]   opens a round of a step and writes the brief of its sub-agent (--change: the owner asked for a change; --again: the sub-agent of the open round is gone)
  gate <game> <step> [--report <file>] [--link <url>]…   the sub-agent is done: records its report (the round's own file when --report is left out), runs the machine's check, shows the gate
  check <game> <step>                               the machine's check of a step, again
  validate <game> <step>                            the owner said ok: the next gate, or the step is validated
  fail <game> <step> --reason "<why>"               the step cannot go on (a sub-agent that is blocked)
  redo <game> <step>                                that step and the ones after it go back to not started
  rulebook <game> [--dry-run]                       fetches the rulebook the scout found to rules.pdf (never over a file that is there); --dry-run says from where and fetches nothing
  linear <game> [--scratch <dir>]                   what Linear should say now: the brief of the bookkeeping sub-agent, or nothing to do
  linear-record <game> [--scratch <dir>] [--file <answer>]   records the ids that sub-agent wrote

<game> is a name as typed or a slug; <step> is one of: ${STEPS.map((step) => step.id).join(", ")}`

class FlowError extends Error {
  readonly code: number
  constructor(message: string, code: number = EXIT.failed) {
    super(message)
    this.code = code
  }
}

// ---------- the command line ----------

type Parsed = { verb: string; words: string[]; values: Map<string, string[]>; flags: Set<string> }

const VALUE_FLAGS = new Set(["--report", "--link", "--reason", "--scratch", "--file", "--adopt-through", "--step", "--family"])
const BOOL_FLAGS = new Set(["--json", "--change", "--again", "--dry-run", "--help"])

function parseArgs(argv: string[]): Parsed {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const [verb = "", ...rest] = args
  const parsed: Parsed = { verb, words: [], values: new Map(), flags: new Set() }
  for (let at = 0; at < rest.length; at += 1) {
    const arg = rest[at] ?? ""
    if (BOOL_FLAGS.has(arg)) parsed.flags.add(arg)
    else if (VALUE_FLAGS.has(arg)) {
      const value = rest[at + 1]
      if (value === undefined || (value.startsWith("--") && value.length > 2)) throw new FlowError(`${arg} takes a value`, EXIT.usage)
      parsed.values.set(arg, [...(parsed.values.get(arg) ?? []), value])
      at += 1
    } else if (arg.startsWith("--")) throw new FlowError(`Unknown option ${arg}`, EXIT.usage)
    else parsed.words.push(arg)
  }
  return parsed
}

const valueOf = (parsed: Parsed, flag: string): string | undefined => parsed.values.get(flag)?.[0]

// ---------- the game and the step a verb is about ----------

type Target = { found: FoundGame; game: Game; state: PipelineState }

function locate(deps: FlowDeps, query: string | undefined): Target {
  if (!query) throw new FlowError("Name the game: a name as typed, or its slug", EXIT.usage)
  const found = findGame(deps.assets, query)
  if (!found) throw new FlowError(`${query} is not in the flow yet: pnpm game-flow start "${query}"`)
  return { found, game: gameAt(found.dir, found.state.name, found.state.slug), state: found.state }
}

function stepArg(parsed: Parsed, at: number): StepDefinition {
  const id = parsed.words[at]
  if (!id) throw new FlowError(`Name the step: ${STEPS.map((step) => step.id).join(", ")}`, EXIT.usage)
  const step = stepById(id)
  if (!step) throw new FlowError(`"${id}" is not a step: ${STEPS.map((each) => each.id).join(", ")}`, EXIT.usage)
  return step
}

const save = (deps: FlowDeps, target: Target): void => writeState(target.found.dir, target.state, deps.now())
const folderIn = (deps: FlowDeps, slug: string): boolean => existsSync(join(deps.repoRoot, "games", slug))
const dayOf = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const clock = (iso: string | null): string => (iso ? `${iso.slice(11, 16)} UTC` : "an unknown time")
const say = (deps: FlowDeps, ...lines: string[]): void => {
  for (const line of lines) deps.out(line)
}

/** Every step before this one is validated: the steps go in order. */
function requirePrevious(target: Target, step: StepDefinition): void {
  for (const before of STEPS) {
    if (before.id === step.id) return
    if (stepOf(target.state, before.id).status !== "validated") throw new FlowError(`${before.title} is not validated yet: the steps go in order, ${step.title} comes after it`)
  }
}

/** The scout file of the game, when it is there and sound. */
function scoutOf(target: Target): Scout | null {
  if (!existsSync(target.game.scoutFile)) return null
  return readScout(readFileSync(target.game.scoutFile, "utf8")).scout
}

/** An expansion has no rules spec, no folder and no engine of its own: its base game's are its. The scout and the catalog entry are all that `/add-game` does for it. */
function expansionText(target: Target, scout: Scout): string {
  return `${target.state.name} is an expansion of ${scout.baseGame?.slug ?? "a game of the catalog"}: /add-game does the scout and the catalog entry for it and stops there (its rules, its art and its code are its base game's work)`
}

function requireNotExpansion(target: Target, step: StepDefinition): void {
  if (STEPS.indexOf(step) < 2) return
  const scout = scoutOf(target)
  if (scout?.type === "expansion") throw new FlowError(expansionText(target, scout))
}

// ---------- what a game's state says ----------

function stepLine(target: Target, step: StepDefinition, index: number): string {
  const s = stepOf(target.state, step.id)
  const mark = s.status === "validated" ? "✓" : s.status === "failed" ? "✗" : s.status === "pending" ? " " : "…"
  let what: string
  switch (s.status) {
    case "validated":
      what = `validated${s.validatedAt ? ` ${s.validatedAt.slice(0, 10)}` : ""}`
      break
    case "gate":
      what = `at its gate (${step.gates[s.gate] ?? step.gates[0]}${step.gates.length > 1 ? `, ${s.gate + 1} of ${step.gates.length}` : ""})${s.check ? (s.check.ok ? " · check ok" : " · check failed") : ""}`
      break
    case "running":
      what = `open since ${clock(s.roundAt)} (round ${s.rounds})${s.reportPath && existsSync(s.reportPath) ? " · its report is there" : ""}`
      break
    case "failed":
      what = `failed: ${shorten(s.failure ?? "no reason given", 90)}`
      break
    default:
      what = "not started"
  }
  return `${String(index + 1).padStart(2)} ${mark} ${step.title.padEnd(16)} ${what}${s.issue?.identifier ? ` · ${s.issue.identifier}` : ""}`
}

type Next = { step: string | null; action: "begin" | "gate-ready" | "wait-owner" | "reopen" | "make-folder" | "wait-folder" | "done"; text: string }

function nextOf(deps: FlowDeps, target: Target): Next {
  const { state } = target
  const open = firstOpen((id) => stepOf(state, id).status === "validated")
  if (!open) return { step: null, action: "done", text: `every step is validated: pnpm check:game ${state.slug} says what is left` }
  if (STEPS.indexOf(open) >= 2) {
    const scout = scoutOf(target)
    if (scout?.type === "expansion") return { step: null, action: "done", text: expansionText(target, scout) }
  }
  const s = stepOf(state, open.id)
  const folder = folderIn(deps, state.slug)
  if (s.status === "gate") return { step: open.id, action: "wait-owner", text: `${open.title} waits for the owner at its gate (${open.gates[s.gate] ?? open.gates[0]}): show them its report and its check (pnpm game-flow status ${state.slug} --step ${open.id}), then pnpm game-flow validate ${state.slug} ${open.id} on their ok` }
  if (s.status === "running") {
    if (s.reportPath && existsSync(s.reportPath)) return { step: open.id, action: "gate-ready", text: `${open.title}: the sub-agent of round ${s.rounds} left its report (${s.reportPath}): pnpm game-flow gate ${state.slug} ${open.id}` }
    return { step: open.id, action: "reopen", text: `${open.title} has been open since ${clock(s.roundAt)} (round ${s.rounds}) and has no report yet: its sub-agent may be at work still, so look for it or ask the owner; only when none is alive, pnpm game-flow begin ${state.slug} ${open.id} --again opens a new round` }
  }
  if (s.status === "failed") return { step: open.id, action: "reopen", text: `${open.title} failed (${shorten(s.failure ?? "no reason given", 90)}): pnpm game-flow begin ${state.slug} ${open.id} opens a new round with a fresh sub-agent` }
  if (open.needsFolder && !folder) return { step: open.id, action: "wait-folder", text: `games/${state.slug} is not in this checkout, and ${open.title} works in it: switch to the branch or the worktree that has it, then ask for the status again` }
  if (open.makesFolder && folder) return { step: open.id, action: "make-folder", text: `games/${state.slug} is already here, so ${open.title} has nothing to make: pnpm game-flow gate ${state.slug} ${open.id} (no sub-agent) runs its check, then validate` }
  return { step: open.id, action: "begin", text: `pnpm game-flow begin ${state.slug} ${open.id} --scratch <your temp folder> opens ${open.title} and writes the brief of its sub-agent` }
}

const nextLine = (next: Next): string => `Next [${next.action}]: ${next.text}`

function progressOf(state: PipelineState): string {
  const done = STEPS.filter((step) => stepOf(state, step.id).status === "validated").length
  const open = firstOpen((id) => stepOf(state, id).status === "validated")
  return `${done}/${STEPS.length} validated${open ? ` · next: ${open.title} (${stepOf(state, open.id).status === "pending" ? "not started" : stepOf(state, open.id).status})` : " · every step validated"}`
}

async function status(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const query = parsed.words.join(" ")
  if (query === "") {
    const list = listGames(deps.assets)
    if (list.length === 0) {
      say(deps, `No game is in the flow (${tilde(deps.assets)} has no pipeline.json): pnpm game-flow start "<Game Name>"`)
      return EXIT.ok
    }
    const width = Math.max(...list.map(({ state }) => state.slug.length))
    say(deps, `Games in the flow (${tilde(deps.assets)})`)
    for (const { state } of list) say(deps, `  ${state.slug.padEnd(width)}  ${state.name}: ${progressOf(state)}${state.linear.parent?.identifier ? ` · ${state.linear.parent.identifier}` : ""}`)
    return EXIT.ok
  }
  const target = locate(deps, query)
  const { state } = target
  const folder = folderIn(deps, state.slug)
  const stage = folder ? await stageOf(deps, state.slug) : null
  const next = nextOf(deps, target)
  const detail = valueOf(parsed, "--step")
  if (parsed.flags.has("--json")) {
    say(
      deps,
      JSON.stringify(
        {
          slug: state.slug,
          name: state.name,
          dir: target.found.dir,
          folderInRepo: folder,
          stage,
          linear: { parent: state.linear.parent?.identifier || null, url: state.linear.parent?.url || null },
          steps: STEPS.map((step) => ({ id: step.id, title: step.title, skill: step.skill, ...stepOf(state, step.id), gates: step.gates })),
          next,
        },
        null,
        2,
      ),
    )
    return EXIT.ok
  }
  if (detail !== undefined) {
    const step = stepById(detail)
    if (!step) throw new FlowError(`"${detail}" is not a step: ${STEPS.map((each) => each.id).join(", ")}`, EXIT.usage)
    printGate(deps, target, step)
    return EXIT.ok
  }
  say(deps, `${state.name} (${state.slug}) · ${progressOf(state)}`, `  folder  ${tilde(target.found.dir)}`, `  repo    ${folder ? `games/${state.slug} is here${stage ? `, stage ${stage}` : ""}` : `games/${state.slug} is not in this checkout`}`, `  linear  ${state.linear.parent?.identifier ? `${state.linear.parent.identifier} ${state.linear.parent.url}` : "not made yet"}`, "")
  STEPS.forEach((step, index) => say(deps, `  ${stepLine(target, step, index)}`))
  say(deps, "", nextLine(next))
  return EXIT.ok
}

/** The gate as the owner sees it: the sub-agent's report, the machine's check, the links, and what the owner's word does. */
function printGate(deps: FlowDeps, target: Target, step: StepDefinition): void {
  const { state } = target
  const s = stepOf(state, step.id)
  say(deps, `━━━ ${step.title[0]?.toUpperCase() ?? ""}${step.title.slice(1)} · ${state.name} · round ${s.rounds} ━━━`, s.report ? tildeAll(s.report) : s.status === "validated" ? "(validated)" : "(no report)", "")
  if (s.check) for (const [at, line] of s.check.lines.entries()) say(deps, `${s.check.ok ? (at === 0 ? "✓" : " ") : "✗"} ${tildeAll(line)}`)
  for (const link of s.links) say(deps, `  ${link}`)
  const kind = step.gates[s.gate] ?? step.gates[0]
  if (kind === "publish") {
    say(deps, "", `Gate 2 of 2 (publish): the drafts were found right. The owner's explicit yes to publish goes to the sub-agent that made them, THEN pnpm game-flow check ${state.slug} ${step.id}, then validate. Validating before is refused: what is published must be newer than the owner's ok to the drafts.`)
    return
  }
  if (step.gates.length > 1 && step.gates[1] === "publish") {
    say(deps, "", publishLine(s.report ?? "") ?? 'The report does not say which documents publish would make public: ask the sub-agent for the sentence "Validate publishes N documents (ids)" before anything is validated.')
    say(deps, "There is no preview of a draft on the hub (it reads published documents only): the Studio page above is what to look at.")
  }
  if (s.status === "gate") say(deps, `Gate ${s.gate + 1} of ${step.gates.length} (${kind}): on the owner's ok, pnpm game-flow validate ${state.slug} ${step.id}`)
}

// ---------- start ----------

async function start(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const name = cleanName(parsed.words.join(" "))
  if (name === "") throw new FlowError('Give the name of the game: pnpm game-flow start "The Crew"', EXIT.usage)
  const problem = nameProblem(name) ?? slugProblem(slugFromName(name))
  if (problem) throw new FlowError(problem, EXIT.usage)
  const existing = findGame(deps.assets, name)
  if (existing) {
    say(deps, `${existing.state.name} is in the flow already (${tilde(existing.dir)}).`)
    return status(deps, { verb: "status", words: [existing.state.slug], values: new Map(), flags: new Set() })
  }
  const slug = slugFromName(name)
  const adopt = valueOf(parsed, "--adopt-through")
  if (folderIn(deps, slug) && adopt === undefined) {
    throw new FlowError(`${slug} has a folder in the repo (games/${slug}): a game that has one is not scouted. To take it on from where it is, pass --adopt-through <step>: the steps up to it are recorded as done outside /add-game (pnpm check:game ${slug} says how far the game has got)`)
  }
  const last = adopt === undefined ? null : stepById(adopt)
  if (adopt !== undefined && !last) throw new FlowError(`"${adopt}" is not a step: ${STEPS.map((each) => each.id).join(", ")}`, EXIT.usage)
  const family = valueOf(parsed, "--family")
  if (family !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(family)) throw new FlowError(`"${family}" is not the name of a folder of a family: lowercase words joined by dashes, like the-crew`, EXIT.usage)
  // a family is a folder that holds games, never one that is a game's own
  if (family !== undefined && existsSync(join(deps.assets, family, "pipeline.json"))) throw new FlowError(`${tilde(join(deps.assets, family))} is the folder of a game, not of a family: pick another folder for the line`)
  const dir = family === undefined ? join(deps.assets, slug) : join(deps.assets, family, slug)
  const state = newState({ name, slug, now: deps.now() })
  const game = gameAt(dir, name, slug)
  const taken: StepDefinition[] = []
  let adopting = last !== null
  for (const step of STEPS) {
    const s = stepOf(state, step.id)
    if (adopting) {
      s.status = "validated"
      s.validatedAt = deps.now().toISOString()
      s.report = ADOPTED
      taken.push(step)
    }
    if (last && step.id === last.id) adopting = false
  }
  // a step that a stage of the game judges is taken on only when the repo says the game has passed it
  for (const step of taken) {
    if (step.check.kind !== "stage") continue
    const verdict = await runCheck(step, { deps, game, state })
    if (!verdict.ok) throw new FlowError(`${name} is not taken on through ${last?.title ?? "that step"}: ${step.title} does not pass (pnpm check:game ${slug}):\n${verdict.lines.map((line) => `  ${tildeAll(line)}`).join("\n")}`)
  }
  const target: Target = { found: { dir, state }, game, state }
  save(deps, target)
  say(deps, `${name} is in the flow: ${tilde(dir)}/pipeline.json`, `Linear has nothing for it yet: pnpm game-flow linear ${slug} --scratch <your temp folder> says what to make.`, "")
  return status(deps, { verb: "status", words: [slug], values: new Map(), flags: new Set() })
}

// ---------- begin ----------

/** What the checkout must hold for a step that works in it: the rules spec, which was written there uncommitted, and nothing of the game's first commit that is not the game's. */
async function requireCheckout(deps: FlowDeps, target: Target, step: StepDefinition): Promise<void> {
  const { state } = target
  const spec = stepOf(state, "rules-spec")
  if (spec.status === "validated" && spec.report !== ADOPTED && !existsSync(specPathsOf(deps.gamesDocs, state.slug).rules)) {
    throw new FlowError(`the rules spec (docs/games/${state.slug}/rules.md) is not in this checkout: it was written, uncommitted, in another one: switch to it before ${step.title}`)
  }
  if (!step.makesFolder) return
  const result = await deps.exec("git", ["status", "--porcelain"], { cwd: deps.repoRoot, timeoutMs: 30_000 })
  // the game's first commit carries what is tracked and changed: a file that is not the spec's would ride along (untracked files are left alone, the brief says to stage paths one by one)
  const others = result.stdout
    .split("\n")
    .filter((line) => /^[ MADRCU!]{2} \S/.test(line))
    .map((line) => line.slice(3))
    .filter((path) => !path.startsWith(`docs/games/${state.slug}/`))
  if (others.length > 0) {
    throw new FlowError(`this checkout has changes that are not the game's (${others.slice(0, 3).join(", ")}${others.length > 3 ? `, and ${others.length - 3} more` : ""}): they would ride along in its first commit. Commit them or put them aside, or run the session in a clean worktree`)
  }
}

async function begin(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const step = stepArg(parsed, 1)
  const { state, game } = target
  const s = stepOf(state, step.id)
  if (s.status === "validated") {
    say(deps, `${step.title} is validated already: pnpm game-flow redo ${state.slug} ${step.id} takes it back.`)
    return EXIT.ok
  }
  requirePrevious(target, step)
  requireNotExpansion(target, step)
  const change = parsed.flags.has("--change")
  if (s.status === "gate" && !change) throw new FlowError(`${step.title} waits at its gate: show the owner its report (pnpm game-flow status ${state.slug} --step ${step.id}). A change they ask for is pnpm game-flow begin ${state.slug} ${step.id} --change`)
  if (change && s.status === "pending") throw new FlowError(`${step.title} has not begun: there is nothing to change yet`)
  if (s.status === "running" && !change && !parsed.flags.has("--again")) {
    if (s.reportPath && existsSync(s.reportPath)) {
      throw new FlowError(`${step.title}: the sub-agent of round ${s.rounds} left its report at ${s.reportPath}. Gate it (pnpm game-flow gate ${state.slug} ${step.id}); a new round would leave it unread`)
    }
    throw new FlowError(`${step.title} has been open since ${clock(s.roundAt)} (round ${s.rounds}) and has no report yet: its sub-agent may be at work still, and a second one would do the work twice. Look for it or ask the owner; when none is alive, pnpm game-flow begin ${state.slug} ${step.id} --again`)
  }
  const folder = folderIn(deps, state.slug)
  if (step.needsFolder && !folder) throw new FlowError(`games/${state.slug} is not in this checkout, and ${step.title} works in it: switch to the branch or the worktree that has it (the pull request of the game folder, say)`)
  if (step.makesFolder && folder && s.status === "pending") throw new FlowError(`games/${state.slug} is already here, so ${step.title} has nothing to make: pnpm game-flow gate ${state.slug} ${step.id} runs its check, then validate`)
  if (step.needsFolder || step.makesFolder) await requireCheckout(deps, target, step)
  const scratch = resolve(valueOf(parsed, "--scratch") ?? join(target.found.dir, ".flow"))
  const reopened = s.status !== "pending"
  s.status = "running"
  s.failure = null
  s.startedAt ??= deps.now().toISOString()
  s.roundAt = deps.now().toISOString()
  s.gate = 0
  s.gateAt = null
  s.rounds += 1
  s.check = null
  // one report file for each round: a report that was written and never read is never overwritten
  const briefPath = join(scratch, `brief-${state.slug}-${step.id}.md`)
  const reportPath = join(scratch, `report-${state.slug}-${step.id}-r${s.rounds}.md`)
  s.reportPath = reportPath
  save(deps, target)
  mkdirSync(scratch, { recursive: true })
  const index = STEPS.findIndex((each) => each.id === step.id) + 1
  say(deps, `${step.title[0]?.toUpperCase() ?? ""}${step.title.slice(1)} · step ${index} of ${STEPS.length} · round ${s.rounds} · skill ${step.skill}`)
  // the brief is written for a change too: the sub-agent that did the step may be gone (another session), and a fresh one reads it, finds what exists and carries on
  writeFileSync(briefPath, briefOf({ step, game, scratch, reportPath, has: { scout: existsSync(game.scoutFile), rulesPdf: existsSync(game.rulesPdf) }, round: reopened ? s.rounds : 1, issue: s.issue?.identifier || null, parent: state.linear.parent?.identifier || null }))
  if (change) {
    say(deps, "A round for the change the owner asked for: send it to the sub-agent that did the step (SendMessage), and ask it to return its new report as its final message: you write it to the new file.", `  report  ${reportPath}`, `  brief   ${briefPath}  (for a fresh sub-agent when that one is gone: Read it and follow it, and give it the owner's words)`, `When it answers STATUS: done: pnpm game-flow gate ${state.slug} ${step.id}`)
    return EXIT.ok
  }
  say(deps, `  brief   ${briefPath}`, `  report  ${reportPath}  (the sub-agent returns its report as its final message: write it to this file, then gate)`, `Give a sub-agent (Agent tool, general-purpose) this prompt: Read ${briefPath} and follow it.`, `When it answers STATUS: done: write its message to the report file, then pnpm game-flow gate ${state.slug} ${step.id}`)
  return EXIT.ok
}

// ---------- gate, check ----------

const STATUS_LINE = /^\s*STATUS:\s*(done|questions|blocked)\b/im

async function gate(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const step = stepArg(parsed, 1)
  const { state, game } = target
  const s = stepOf(state, step.id)
  if (s.status === "validated") throw new FlowError(`${step.title} is validated already`)
  requirePrevious(target, step)
  requireNotExpansion(target, step)
  // a step that no sub-agent works at (the game folder, when it is there already) can be gated as it is; any other has to have begun
  if (s.status === "pending" && !(step.makesFolder && folderIn(deps, state.slug))) throw new FlowError(`${step.title} has not begun: pnpm game-flow begin ${state.slug} ${step.id} first`)
  const reportFile = valueOf(parsed, "--report") ?? (s.reportPath && existsSync(s.reportPath) ? s.reportPath : undefined)
  let report: string | null = null
  if (reportFile !== undefined) {
    if (!existsSync(reportFile)) throw new FlowError(`no report at ${reportFile}: a sub-agent returns its report as its final message and cannot write the file: write that message to the path yourself, then gate again`)
    report = printable(readFileSync(reportFile, "utf8")).trim().slice(0, 12_000)
    const said = STATUS_LINE.exec(report)?.[1]?.toLowerCase()
    if (said === "questions") throw new FlowError("the sub-agent asked questions: relay them to the owner and send it the answers, then wait for STATUS: done (a gate is for a finished step; when it did finish and its file still says questions, write its final message to the file)")
    if (said === "blocked") throw new FlowError(`the sub-agent is blocked: pnpm game-flow fail ${state.slug} ${step.id} --reason "<why>"`)
  }
  const links = [...new Set([...(parsed.values.get("--link") ?? []), ...extractLinks(report ?? "")])]
  // a report that comes at a later gate (the second gate of the catalog entry) is the publication's: the report the owner validated, which names the documents, is the one that stays
  const later = s.status === "gate" && s.gate > 0
  s.status = "gate"
  s.failure = null
  if (!later) {
    if (report !== null) s.report = report
    if (report !== null || links.length > 0) s.links = links
  }
  // the check belongs to the last gate: a step with a gate for publishing is judged on what is published, which is after the first gate
  const checkNow = s.gate + 1 >= step.gates.length
  if (checkNow) s.check = await runCheck(step, { deps, game, state })
  else s.check = null
  save(deps, target)
  if (later && report !== null) say(deps, "Report of the second gate (the drafts' report, which names the documents, is kept):", report, "")
  printGate(deps, target, step)
  return checkNow && !s.check?.ok ? EXIT.failed : EXIT.ok
}

const printCheck = (deps: FlowDeps, verdict: CheckResult): void => {
  for (const [at, line] of verdict.lines.entries()) say(deps, `${verdict.ok ? (at === 0 ? "✓" : " ") : "✗"} ${tildeAll(line)}`)
}

async function check(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const step = stepArg(parsed, 1)
  const s = stepOf(target.state, step.id)
  const verdict = await runCheck(step, { deps, game: target.game, state: target.state })
  s.check = verdict
  save(deps, target)
  printCheck(deps, verdict)
  return verdict.ok ? EXIT.ok : EXIT.failed
}

// ---------- validate ----------

/** The scout settled the name and the slug: the game's records follow (its folder moves to the slug, and the slug it had stays a name it answers to). `null` when all went well, else what stopped it. */
function settleScout(deps: FlowDeps, target: Target): string | null {
  const { found, state } = target
  const scout = scoutOf(target)
  if (scout === null) return "the scout file cannot be read"
  if (scout.slug !== state.slug && folderIn(deps, scout.slug)) return `games/${scout.slug} exists already: ${scout.name} has a folder, there is nothing to add`
  // the folder keeps the folder it is in (a family's, for a game of a line)
  const to = join(dirname(found.dir), scout.slug)
  const was = state.slug
  // the folder may be at the slug already (a move that stopped between the rename and the save)
  if (resolve(found.dir) !== resolve(to)) {
    try {
      found.dir = moveGameDir(found.dir, scout.slug)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }
  for (const alias of [scout.name, was]) if (!state.aliases.includes(alias)) state.aliases.push(alias)
  state.name = scout.name
  state.slug = scout.slug
  target.game = gameAt(found.dir, state.name, state.slug)
  return null
}

async function validate(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const step = stepArg(parsed, 1)
  const { state } = target
  const s = stepOf(state, step.id)
  if (s.status === "validated") {
    say(deps, `${step.title} is validated already.`)
    return EXIT.ok
  }
  if (s.status !== "gate") throw new FlowError(`${step.title} is ${s.status === "pending" ? "not started" : s.status}: it has nothing at a gate to validate (begin, then gate)`)
  requirePrevious(target, step)
  if (s.gate + 1 < step.gates.length) {
    // the first gate said the work is right; the next one is the word that acts, and the owner is shown what it makes public
    if (step.gates[s.gate + 1] === "publish" && publishedIds(s.report ?? "").length === 0) {
      throw new FlowError('the report does not say which documents publish would make public: ask the sub-agent for the sentence "Validate publishes N documents (ids)", then gate again')
    }
    s.gate += 1
    s.gateAt = deps.now().toISOString()
    s.check = null
    save(deps, target)
    say(deps, `${step.title}: the drafts are right. ${publishLine(s.report ?? "") ?? ""}`.trim(), `Gate ${s.gate + 1} of ${step.gates.length} (${step.gates[s.gate]}): the owner's explicit yes to publish goes to the sub-agent that made the drafts, THEN pnpm game-flow check ${state.slug} ${step.id}, then validate again.`)
    return EXIT.ok
  }
  // the last gate: the files may have changed since the sub-agent's report, so the check is run again, and a step that does not pass is not validated
  const verdict = await runCheck(step, { deps, game: target.game, state })
  s.check = verdict
  if (!verdict.ok) {
    save(deps, target)
    printCheck(deps, verdict)
    throw new FlowError(`the check of ${step.title} does not pass: say what to change (pnpm game-flow begin ${state.slug} ${step.id} --change)`)
  }
  if (step.onValidate === "settle-scout") {
    const problem = settleScout(deps, target)
    if (problem) {
      save(deps, target)
      throw new FlowError(problem)
    }
  }
  if (step.onValidate === "stamp-rules") {
    const stamped = await stampRules(deps, state, dayOf(deps.now()))
    if (!stamped.ok) {
      save(deps, target)
      printCheck(deps, stamped)
      throw new FlowError("the spec cannot be stamped as validated: nothing was changed")
    }
  }
  s.status = "validated"
  s.validatedAt = deps.now().toISOString()
  save(deps, target)
  say(deps, `✓ ${step.title} validated`, ...(step.onValidate === "settle-scout" ? [`  the game is "${target.state.name}", slug ${target.state.slug}, folder ${tilde(target.found.dir)}`] : []))
  say(deps, nextLine(nextOf(deps, target)), `Linear: pnpm game-flow linear ${target.state.slug} --scratch <your temp folder> says what to bring up to date.`)
  return EXIT.ok
}

// ---------- fail, redo ----------

async function fail(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const step = stepArg(parsed, 1)
  const reason = valueOf(parsed, "--reason")
  if (reason === undefined || reason.trim() === "") throw new FlowError('Say why: --reason "<what stopped the step>"', EXIT.usage)
  const s = stepOf(target.state, step.id)
  if (s.status === "validated") throw new FlowError(`${step.title} is validated already: redo takes it back first`)
  s.status = "failed"
  s.failure = shorten(printable(reason), 400)
  save(deps, target)
  say(deps, `${step.title} failed: ${s.failure}`, `pnpm game-flow begin ${target.state.slug} ${step.id} opens a new round once the cause is dealt with.`)
  return EXIT.ok
}

async function redo(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const step = stepArg(parsed, 1)
  const from = STEPS.findIndex((each) => each.id === step.id)
  for (const later of STEPS.slice(from)) {
    const s = stepOf(target.state, later.id)
    s.status = "pending"
    s.gate = 0
    s.gateAt = null
    s.failure = null
    s.validatedAt = null
    s.report = null
    s.reportPath = null
    s.check = null
    s.links = []
  }
  save(deps, target)
  say(deps, `${step.title} and the steps after it are back to not started (their Linear issues and what the skills made are kept: the skills fill and never replace).`)
  return EXIT.ok
}

// ---------- the rulebook ----------

async function rulebook(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const { game } = target
  if (existsSync(game.rulesPdf)) {
    say(deps, `${tilde(game.rulesPdf)} is there already: it is kept.`)
    return EXIT.ok
  }
  if (!existsSync(game.scoutFile)) throw new FlowError(`there is no scout file yet (${tilde(game.scoutFile)}): the rulebook is the one the scout found`)
  const url = scoutOf(target)?.edition.rules?.url ?? null
  if (url === null) {
    say(deps, `The scout found no address for the rulebook: put the PDF at ${tilde(game.rulesPdf)} if the rules are a PDF (a rulebook that is a web page is read as it is).`)
    return EXIT.failed
  }
  if (parsed.flags.has("--dry-run")) {
    say(deps, `It would fetch ${shorten(printable(url), 160)} to ${tilde(game.rulesPdf)}: https only, a public host, 60 MB at the most, kept only if it is a whole PDF. Ask the owner first: a download needs their yes.`)
    return EXIT.ok
  }
  say(deps, `Fetching ${shorten(printable(url), 160)}…`)
  const fetched = await deps.fetchRulebook(url, game.rulesPdf)
  if (fetched.ok) {
    say(deps, `${tilde(game.rulesPdf)}: ${fetched.bytes >= 1024 * 1024 ? `${(fetched.bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(fetched.bytes / 1024))} KB`}`)
    return EXIT.ok
  }
  say(deps, `The rulebook was not fetched (${shorten(printable(fetched.reason), 160)}). A PDF has to be at ${tilde(game.rulesPdf)}: the owner puts it there; a web page is read as it is.`)
  return EXIT.failed
}

// ---------- Linear ----------

const scratchOf = (parsed: Parsed, target: Target): string => resolve(valueOf(parsed, "--scratch") ?? join(target.found.dir, ".flow"))

async function linear(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const order = buildOrder(target.state, STEPS, target.game)
  if (!order) {
    say(deps, "Linear already says what the state says: nothing to do.")
    return EXIT.ok
  }
  const scratch = scratchOf(parsed, target)
  const briefPath = join(scratch, `linear-${target.state.slug}-brief.md`)
  const answerPath = join(scratch, `linear-${target.state.slug}-answer.json`)
  mkdirSync(scratch, { recursive: true })
  rmSync(answerPath, { force: true })
  writeFileSync(briefPath, linearPrompt(order, answerPath))
  const toMake = order.issues.filter((issue) => issue.id === null).length
  const toMove = order.issues.filter((issue) => issue.id !== null && (issue.state !== issue.wantState || issue.title !== issue.wantTitle)).length
  const toComment = order.issues.filter((issue) => issue.comment !== null).length
  say(deps, `Linear needs work: ${toMake} issue${toMake === 1 ? "" : "s"} to make, ${toMove} to move or rename, ${toComment} comment${toComment === 1 ? "" : "s"} to post.`, `  brief   ${briefPath}`, `  answer  ${answerPath}`, `Give a small sub-agent (Agent tool, model haiku) this prompt: Read ${briefPath} and do what it says.`, `When it answers: pnpm game-flow linear-record ${target.state.slug} --scratch ${scratch}`)
  return EXIT.ok
}

async function linearRecord(deps: FlowDeps, parsed: Parsed): Promise<number> {
  const target = locate(deps, parsed.words[0])
  const answerPath = valueOf(parsed, "--file") ?? join(scratchOf(parsed, target), `linear-${target.state.slug}-answer.json`)
  if (!existsSync(answerPath)) throw new FlowError(`no answer at ${answerPath}: the sub-agent was to write its JSON there`)
  const order = buildOrder(target.state, STEPS, target.game)
  if (!order) {
    say(deps, "Linear already says what the state says: nothing to record.")
    return EXIT.ok
  }
  const problems = applyResult(target.state, parseAnswer(readFileSync(answerPath, "utf8")), order)
  target.state.linear.error = problems.length > 0 ? problems.join("; ") : null
  save(deps, target)
  const made = order.issues.filter((issue) => !problems.some((problem) => problem.endsWith(` ${issue.key}`))).length
  say(deps, `Linear: ${target.state.linear.parent?.identifier ?? "no parent"} and ${Math.max(0, made - 1)} sub-issue${made - 1 === 1 ? "" : "s"} recorded${target.state.linear.parent?.url ? ` (${target.state.linear.parent.url})` : ""}.`)
  for (const problem of problems) deps.err(`✗ ${problem}`)
  if (problems.length > 0) say(deps, "The game goes on: pnpm game-flow linear brings what is missing at the next point.")
  return problems.length > 0 ? EXIT.failed : EXIT.ok
}

// ---------- the command ----------

async function dispatch(parsed: Parsed, deps: FlowDeps): Promise<number> {
  switch (parsed.verb) {
    case "status":
      return status(deps, parsed)
    case "start":
      return start(deps, parsed)
    case "begin":
      return begin(deps, parsed)
    case "gate":
      return gate(deps, parsed)
    case "check":
      return check(deps, parsed)
    case "validate":
      return validate(deps, parsed)
    case "fail":
      return fail(deps, parsed)
    case "redo":
      return redo(deps, parsed)
    case "rulebook":
      return rulebook(deps, parsed)
    case "linear":
      return linear(deps, parsed)
    case "linear-record":
      return linearRecord(deps, parsed)
    default:
      throw new FlowError(`Unknown verb "${parsed.verb}": ${VERBS.join(", ")}`, EXIT.usage)
  }
}

export async function runFlow(argv: string[], deps: FlowDeps): Promise<number> {
  try {
    const parsed = parseArgs(argv)
    if (parsed.verb === "" || parsed.verb === "help" || parsed.verb === "--help" || parsed.verb === "-h" || parsed.flags.has("--help")) {
      say(deps, USAGE)
      return parsed.verb === "" ? EXIT.usage : EXIT.ok
    }
    // reading changes nothing; every other verb reads a state, changes it and writes it whole, so it runs alone
    if (parsed.verb === "status" || !(VERBS as readonly string[]).includes(parsed.verb)) return await dispatch(parsed, deps)
    return await withLock(deps.assets, () => dispatch(parsed, deps), { timeoutMs: deps.lockTimeoutMs })
  } catch (error) {
    if (error instanceof FlowError) {
      deps.err(`✗ ${error.message}`)
      if (error.code === EXIT.usage) deps.err(`\n${USAGE}`)
      return error.code
    }
    deps.err(`✗ ${error instanceof Error ? error.message : String(error)}`)
    return EXIT.failed
  }
}

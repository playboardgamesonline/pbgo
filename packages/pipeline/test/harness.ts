// What the tests that run the whole command share: a temporary world (the folder of the games' files, a HOME, two stand-ins for `claude` and `pnpm check:scout`),
// the command started as a process with its answers on stdin, and what it did read back (what it printed, what the stand-in `claude` was asked). Nothing here
// reaches the network, the owner's login, Linear or Sanity.
import { spawn } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Policy } from "../src/policy.ts"

export const PACKAGE = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "")
export const REPO = join(PACKAGE, "..", "..")

export type CallSpec = {
  /** a regular expression the prompt of the headless call must match */
  match: string
  text?: string
  cost?: number
  /** files the call leaves behind (`$OUT` is the `--out` of the prompt, `$ASSETS` the folder of the games' files, `$DOCS` the folder of the specs) */
  writes?: { path: string; content: string }[]
  /** a session of the owner's (no `-p`) that leaves the stand-in for the check of the pictures saying this: the exit code and the lines */
  pictures?: { exit: number; lines: string[] }
  /** same, for the stand-in of the dry run of a game's seed on its art folder */
  art?: { exit: number; lines: string[] }
  /** same, for the stand-in of the gate of a stage: the report it prints (the script's own format) and its exit code */
  stage?: { exit: number; report: string }
  tools?: { name: string; input?: Record<string, unknown> }[]
  denials?: { tool: string; input?: Record<string, unknown>; reason?: string; hook?: boolean }[]
  structured?: unknown
  subtype?: string
  isError?: boolean
  errors?: string[]
  terminalReason?: string
  apiKeySource?: string
  exitCode?: number
  /** the call does not end by itself (Ctrl-C ends it); the file is written when it has started */
  hang?: boolean
  startedFile?: string
}

export type Scenario = { version?: string; auth?: unknown; mcp?: string; calls?: CallSpec[] }

export type LoggedCall = { argv: string[]; cwd: string; env: Record<string, string | null>; /** the policy file of the call, as it was when the call began */ policy: Policy | null; prompt?: string; matched?: number }

export type Run = {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  /** every invocation of the stand-in `claude` */
  invocations: LoggedCall[]
  /** the headless ones (`-p`) */
  calls: LoggedCall[]
  /** the sessions of the owner's (no `-p`: the last word of the arguments is their first message) */
  sessions: LoggedCall[]
  base: string
  assets: string
  /** the folder of the specs of the games (`docs/games` of the temporary world) */
  docs: string
  /** reads a file of the temporary world */
  read: (path: string) => string
}

export type RunOptions = {
  args: string[]
  /** what the owner types, one line each */
  answers?: string[]
  scenario?: Scenario
  env?: Record<string, string>
  /** the same world as an earlier run (a command that comes back to a game) */
  base?: string
  /** a signal to send to the command once its output matches */
  interrupt?: { when: RegExp; signal?: NodeJS.Signals }
  /** keep stdin open after the answers (the command is stopped by `interrupt`) */
  keepStdin?: boolean
}

function executable(path: string, body: string): void {
  writeFileSync(path, body)
  chmodSync(path, 0o755)
}

export function world(): string {
  return mkdtempSync(join(tmpdir(), "pipeline-test-"))
}

export const flagValue = (call: LoggedCall, name: string): string | null => {
  const at = call.argv.indexOf(name)
  return at >= 0 ? (call.argv[at + 1] ?? null) : null
}

/** The values of a flag that takes several (`--allowedTools a b c`), up to the next flag. */
export const flagValues = (call: LoggedCall, name: string): string[] => {
  const at = call.argv.indexOf(name)
  if (at < 0) return []
  const values: string[] = []
  for (const word of call.argv.slice(at + 1)) {
    if (word.startsWith("--")) break
    values.push(word)
  }
  return values
}

export async function runCli(options: RunOptions): Promise<Run> {
  const base = options.base ?? world()
  const assets = join(base, "assets")
  const docs = join(base, "docs-games")
  const bin = join(base, "bin")
  mkdirSync(assets, { recursive: true })
  mkdirSync(docs, { recursive: true })
  mkdirSync(bin, { recursive: true })
  executable(join(bin, "claude"), `#!/bin/sh\nexec "${process.execPath}" "${join(PACKAGE, "test", "fake-claude.mjs")}" "$@"\n`)
  executable(join(bin, "check-scout"), `#!/bin/sh\nexec "${process.execPath}" "${join(PACKAGE, "test", "fake-check-scout.mjs")}" "$@"\n`)
  // the check of a spec is the real one (`pnpm check:rules` without pnpm), reading the specs of the temporary world
  executable(join(bin, "check-pictures"), `#!/bin/sh\nexec "${process.execPath}" "${join(PACKAGE, "test", "fake-check-pictures.mjs")}" "$@"\n`)
  executable(join(bin, "check-stage"), `#!/bin/sh\nexec "${process.execPath}" "${join(PACKAGE, "test", "fake-check-stage.mjs")}" "$@"\n`)
  executable(join(bin, "check-art"), `#!/bin/sh\nexec "${process.execPath}" "${join(PACKAGE, "test", "fake-check-art.mjs")}" "$@"\n`)
  executable(join(bin, "check-rules"), `#!/bin/sh\nexec "${process.execPath}" --disable-warning=ExperimentalWarning "${join(REPO, "packages", "games", "scripts", "check-rules.ts")}" "$@"\n`)
  writeFileSync(join(base, "scenario.json"), JSON.stringify(options.scenario ?? {}))
  // a log and a list of the calls already answered for each run, so that a run that comes back to the same world reads only its own
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const logFile = join(base, `log-${unique}.jsonl`)
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: base,
    USER: "tester",
    NO_COLOR: "1",
    PBGO_ASSETS_DIR: assets,
    PBGO_CLAUDE_BIN: join(bin, "claude"),
    PBGO_CHECK_SCOUT_BIN: join(bin, "check-scout"),
    PBGO_CHECK_RULES_BIN: join(bin, "check-rules"),
    PBGO_CHECK_PICTURES_BIN: join(bin, "check-pictures"),
    PBGO_CHECK_ART_BIN: join(bin, "check-art"),
    PBGO_CHECK_STAGE_BIN: join(bin, "check-stage"),
    FAKE_STAGE_FILE: join(base, "stage.json"),
    FAKE_STAGE_LOG: join(base, "stage.log"),
    FAKE_ART_FILE: join(base, "art.json"),
    FAKE_PICTURES_FILE: join(base, "pictures.json"),
    PBGO_GAMES_DOCS_DIR: docs,
    // no test fetches a rulebook from the network: one that wants to see the fetch tried sets this to "" and an address that cannot be resolved (.invalid)
    PBGO_ADD_GAME_NO_DOWNLOAD: "1",
    FAKE_CLAUDE_SCENARIO: join(base, "scenario.json"),
    FAKE_CLAUDE_LOG: logFile,
    FAKE_CLAUDE_USED: join(base, `used-${unique}.json`),
    // where the command asks whether the documents are published: nowhere (a closed port) unless a test starts a stand-in, so that no test reaches the platform's Sanity
    PBGO_SANITY_API_BASE: "http://127.0.0.1:9",
    // the variables a stray key or a parent Claude Code session would leave in the shell: none of them may reach a call
    ANTHROPIC_API_KEY: "sk-ant-api03-a-key-that-must-never-reach-a-call",
    ANTHROPIC_BASE_URL: "https://example.invalid",
    CLAUDE_CODE_ENTRYPOINT: "cli",
    CLAUDECODE: "1",
    ...options.env,
  }
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", join(PACKAGE, "bin", "add-game.ts"), ...options.args], { cwd: REPO, env, stdio: ["pipe", "pipe", "pipe"] })
  let stdout = ""
  let stderr = ""
  let signalled = false
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8")
    if (options.interrupt && !signalled && options.interrupt.when.test(stdout)) {
      signalled = true
      child.kill(options.interrupt.signal ?? "SIGINT")
    }
  })
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")))
  if (options.answers?.length) child.stdin.write(`${options.answers.join("\n")}\n`)
  if (!options.keepStdin) child.stdin.end()
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child.on("close", (code, signal) => resolve({ code, signal })))
  const invocations: LoggedCall[] = existsSync(logFile)
    ? readFileSync(logFile, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LoggedCall)
    : []
  return {
    ...exit,
    stdout,
    stderr,
    invocations,
    calls: invocations.filter((call) => call.argv[0] === "-p"),
    sessions: invocations.filter((call) => (call.argv[0] === "--resume" || call.argv[0] === "--session-id") && !call.argv.includes("-p")),
    base,
    assets,
    docs,
    read: (path) => readFileSync(path, "utf8"),
  }
}

/** A scout file that the contract accepts (the example of `.claude/skills/game-scout`), for the name and the slug given. */
export function scoutJson(name: string, slug: string, extra: Record<string, unknown> = {}): string {
  return `${JSON.stringify(
    {
      version: 1,
      scoutedAt: "2026-11-15",
      name,
      slug,
      type: "base-game",
      baseGame: null,
      suggestion: null,
      edition: {
        publisher: "Sample Publisher",
        year: 2024,
        label: "Second edition",
        bggVersionId: 654321,
        rules: { language: "en", url: "https://example.com/rules.pdf", version: "v2.1", date: "2024-03" },
        confidence: "high",
      },
      bgg: { id: 123456, type: "boardgame", year: 2019, rank: 812, rating: 7.4, ratings: 18200, weight: 1.86, weights: 940 },
      facts: { playersMin: 2, playersMax: 6, duration: 30, minAge: 8, complexity: 1.86 },
      existing: { catalog: "none" },
      notes: ["BGG says 2-8 players, the box says 2-6: the box is kept."],
      sources: [{ label: "Publisher page", url: "https://example.com/sample-game" }],
      ...extra,
    },
    null,
    2,
  )}\n`
}

/** What a bookkeeping call answers: the ids of the issues it made or moved. */
export function linearAnswer(keys: string[], state: Record<string, string> = {}, extra: { commented?: string[] } = {}): unknown {
  const number = (key: string) => 40 + ["parent", "scout", "catalog-entry", "rules-spec", "platform-assets", "game-new", "game-sanity-create", "game-assets", "engine-rules", "engine-board", "game-go-live"].indexOf(key)
  return {
    labelId: "label-1",
    issues: keys.map((key) => ({
      key,
      id: `issue-${key}`,
      identifier: `GAM-${number(key)}`,
      url: `https://linear.app/example/issue/GAM-${number(key)}/${key}`,
      state: state[key] ?? "Todo",
      ...(extra.commented?.includes(key) ? { commented: true } : {}),
    })),
  }
}

/**
 * A stand-in for the public API of the platform's Sanity (`PBGO_SANITY_API_BASE`): it answers the query of `missingPublished` from the ids it says are published,
 * or with an error when `down` is set. `requests` is every URL it was asked.
 */
export async function fakeSanity(options: { published?: string[]; down?: boolean } = {}): Promise<{ base: string; requests: URL[]; close: () => Promise<void> }> {
  const requests: URL[] = []
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    requests.push(url)
    if (options.down) {
      response.writeHead(500, { "content-type": "application/json" })
      response.end(JSON.stringify({ error: "down" }))
      return
    }
    const asked = JSON.parse(url.searchParams.get("$ids") ?? "[]") as string[]
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ result: asked.filter((id) => (options.published ?? []).includes(id)) }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return { base: `http://127.0.0.1:${port}`, requests, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

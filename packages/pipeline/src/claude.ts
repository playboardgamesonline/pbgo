// The one place that runs `claude`: its environment (the owner's login, never a key), its arguments (a headless call whose permission mode refuses what the
// policy does not allow), and the process that reads its stream. Verified on the CLI 2.1.299 (docs/scripts.md, "pnpm add-game in full").
import { spawn } from "node:child_process"
import type { Env } from "./config.ts"

/** The variables of the shell that are kept for `claude`: its config folder says where the login is. */
const KEPT = new Set(["CLAUDE_CONFIG_DIR"])
/** The variables that give a call a power of this command's: set for a call by the command alone, never taken from the shell. */
const OURS = /^PBGO_(?:PUBLISH_OK|GUARD_)/

/**
 * The environment of a call: the shell's own minus every ANTHROPIC_* and CLAUDE* variable. A key in the environment takes over the owner's login (and
 * switches the claude.ai connectors, Composio among them, off), and the variables of a Claude Code session that runs this command would make the call think
 * it is nested in it. `USER` and the rest stay: the login is found through them.
 */
export function childEnv(parent: Env, extra: Env = {}): Env {
  const env: Env = {}
  for (const [key, value] of Object.entries(parent)) {
    if (value === undefined) continue
    if (/^(ANTHROPIC_|CLAUDE)/.test(key) && !KEPT.has(key)) continue
    if (OURS.test(key)) continue
    env[key] = value
  }
  return { ...env, ...extra }
}

/** The names of the variables that `childEnv` takes out, for the line that says so. */
export function strippedNames(parent: Env): string[] {
  return Object.keys(parent).filter((key) => parent[key] !== undefined && /^(ANTHROPIC_|CLAUDE)/.test(key) && !KEPT.has(key))
}

/** The variables that carry a key or another source of credentials: the ones the owner must hear about. */
export function strippedCredentials(parent: Env): string[] {
  return strippedNames(parent).filter((key) => /^(ANTHROPIC_(API_KEY|AUTH_TOKEN|BASE_URL)|CLAUDE_CODE_USE_|CLAUDE_CODE_OAUTH_TOKEN)/.test(key))
}

export type CallOptions = {
  prompt: string
  /** a first call makes the session (`--session-id`), every other resumes it */
  session: { id: string; resume: boolean }
  /** the name the session has in `claude --resume` */
  name: string
  model: string
  budgetUsd: number
  /** the settings file that holds the hook */
  settingsPath: string
  /** tool names allowed by the mode itself (never a path, never a command: the hook allows those) */
  tools: readonly string[]
  /** the schema of the answer, for a call that returns data */
  jsonSchema?: object
  /** a call that leaves no session behind (the bookkeeping ones): it makes no session of the game and shows in no `claude --resume` list */
  ephemeral?: boolean
}

/**
 * The arguments of a headless call. The prompt comes right after `-p` and every variadic option is followed by another flag: the CLI would take the next
 * word for one more value. The owner's settings (their hooks, their permission rules) are left out, the local ones of the checkout included, so that the call behaves
 * the same on any machine and no rule of theirs widens the policy.
 */
export function callArgs(options: CallOptions): string[] {
  const args = [
    "-p",
    options.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    options.model,
    "--max-budget-usd",
    String(options.budgetUsd),
    "--permission-mode",
    "dontAsk",
    "--setting-sources",
    "project",
    "--settings",
    options.settingsPath,
  ]
  if (options.jsonSchema) args.push("--json-schema", JSON.stringify(options.jsonSchema))
  if (options.ephemeral) args.push("--no-session-persistence")
  else if (options.session.resume) args.push("--resume", options.session.id)
  else args.push("--session-id", options.session.id, "--name", options.name)
  if (options.tools.length > 0) args.push("--allowedTools", ...options.tools)
  return args
}

export type RunOutcome = {
  code: number | null
  signal: string | null
  stderr: string
  /** every line of stdout, for the log of the round */
  raw: string
  /** the owner pressed Ctrl-C: the call was asked to stop */
  interrupted: boolean
  /** `onEvent` asked for the call to end */
  stopped: boolean
  /** `claude` could not be started */
  spawnError: string | null
}

export type RunOptions = {
  bin: string
  args: readonly string[]
  cwd: string
  env: Env
  /** called with each JSON event, as it comes; answering "stop" ends the call (a call that must not go on: a key took over the login) */
  onEvent: (event: unknown) => void | "stop"
}

/**
 * Runs `claude` and reads its stream. stdin is closed (the CLI waits three seconds for it otherwise), and the call gets its own process group, so that
 * Ctrl-C reaches this process alone and is passed on once: the call stops as a run that was interrupted, and its session resumes.
 */
export function runClaude(options: RunOptions): Promise<RunOutcome> {
  return new Promise((resolve) => {
    let raw = ""
    let stderr = ""
    let pending = ""
    let interrupted = false
    let stopped = false
    let spawnError: string | null = null
    const child = spawn(options.bin, [...options.args], { cwd: options.cwd, env: options.env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"], detached: true })

    let killer: NodeJS.Timeout | null = null
    const forward = (signal: NodeJS.Signals) => () => {
      interrupted = true
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, signal)
        } catch {
          child.kill(signal)
        }
      }
      killer ??= setTimeout(() => child.kill("SIGKILL"), 20_000)
    }

    const line = (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      let event: unknown
      try {
        event = JSON.parse(trimmed)
      } catch {
        stderr += `${trimmed}\n`
        return
      }
      if (options.onEvent(event) === "stop") {
        stopped = true
        forward("SIGTERM")()
      }
    }
    child.stdout.on("data", (chunk: Buffer) => {
      const piece = chunk.toString("utf8")
      raw += piece
      pending += piece
      const lines = pending.split("\n")
      pending = lines.pop() ?? ""
      for (const each of lines) line(each)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8")
    })

    const onInt = forward("SIGINT")
    const onTerm = forward("SIGTERM")
    process.on("SIGINT", onInt)
    process.on("SIGTERM", onTerm)

    const done = (code: number | null, signal: string | null) => {
      process.off("SIGINT", onInt)
      process.off("SIGTERM", onTerm)
      if (killer) clearTimeout(killer)
      if (pending) line(pending)
      resolve({ code, signal, stderr, raw, interrupted: interrupted && !stopped, stopped, spawnError })
    }
    child.on("error", (error: NodeJS.ErrnoException) => {
      spawnError = error.code === "ENOENT" ? `${options.bin}: command not found` : error.message
      done(null, null)
    })
    child.on("close", (code, signal) => done(code, signal))
  })
}

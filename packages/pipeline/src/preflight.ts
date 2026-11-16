// What the command checks before it starts: the `claude` that will run the steps is the owner's login (a subscription, never a key), the skills the steps
// need are in this checkout, and Composio is connected to that `claude`. Each check says what to do when it fails. The decisions are pure functions of the text
// the CLI printed; running the CLI is `exec`, which a test replaces.
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { childEnv, strippedCredentials } from "./claude.ts"
import type { Env } from "./config.ts"
import { STEPS } from "./steps.ts"

export type ExecResult = { code: number | null; stdout: string; stderr: string }
export type Exec = (file: string, args: string[], options?: { cwd?: string; env?: Env; timeoutMs?: number }) => Promise<ExecResult>

/** Runs a command to its end with its output kept; never throws (a command that cannot start is `code: null`). */
export const nodeExec: Exec = (file, args, options = {}) =>
  new Promise((resolve) => {
    let stdout = ""
    let stderr = ""
    const child = spawn(file, args, { cwd: options.cwd, env: (options.env ?? process.env) as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] })
    const timer = options.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), options.timeoutMs) : null
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")))
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")))
    child.on("error", (error) => {
      if (timer) clearTimeout(timer)
      resolve({ code: null, stdout, stderr: stderr || error.message })
    })
    child.on("close", (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })

/** `claude auth status` (JSON): the problem with it, `null` when it is the owner's subscription login. */
export function authProblem(status: unknown): string | null {
  if (typeof status !== "object" || status === null) return "`claude auth status` did not answer with JSON"
  const { loggedIn, authMethod } = status as { loggedIn?: unknown; authMethod?: unknown }
  if (loggedIn !== true) return "claude is not logged in: run `claude auth login` (it opens the browser; choose the Claude subscription, not the Console)"
  if (authMethod === "claude.ai") return null
  if (authMethod === "api_key") return "claude runs on an API key (apiKeySource says where): the pipeline runs on the subscription login, run `claude auth login` and remove the key"
  if (authMethod === "third_party") return "claude is set to a cloud provider (Bedrock, Vertex…): the pipeline runs on the subscription login"
  return `claude's login is "${String(authMethod)}": the pipeline runs on the claude.ai subscription login, run \`claude auth login\``
}

export function subscriptionOf(status: unknown): string | null {
  return typeof status === "object" && status !== null && typeof (status as { subscriptionType?: unknown }).subscriptionType === "string" ? String((status as { subscriptionType: string }).subscriptionType) : null
}

export type ComposioServer = { server: string; connected: boolean; prefix: string }

/** The tools of an MCP server are named `mcp__<server>__<tool>`, the server's name with every character outside letters, digits, `_` and `-` replaced by `_`. */
export function toolPrefix(server: string): string {
  return `mcp__${server.replace(/[^A-Za-z0-9_-]/g, "_")}__`
}

/** The server a prefix names, as it is in a tool name: `mcp__claude_ai_Composio__` is `claude_ai_Composio`. */
export function serverOfPrefix(prefix: string): string {
  return prefix.replace(/^mcp__/, "").replace(/__$/, "")
}

/** The Composio line of `claude mcp list` (`claude.ai Composio: https://… - ✔ Connected`), `null` when there is none. */
export function composioOf(listing: string): ComposioServer | null {
  for (const row of listing.split("\n")) {
    const match = /^(.+?): \S+(?: \([^)]*\))? - (.*)$/.exec(row.trim())
    const server = match?.[1]
    if (!server || !/composio/i.test(server)) continue
    return { server, connected: /connected/i.test(match?.[2] ?? "") && !/(failed|needs auth)/i.test(match?.[2] ?? ""), prefix: toolPrefix(server) }
  }
  return null
}

export type Preflight = {
  problems: string[]
  notes: string[]
  claudeVersion: string | null
  subscription: string | null
  /** the prefix of the tool names of Composio (`mcp__claude_ai_Composio__`) */
  composioPrefix: string
}

/** What the call needs, checked: `claude`, its login, the skills, Composio. `problems` stop the command, `notes` are said and go on. */
export async function preflight(args: { exec: Exec; env: Env; repoRoot: string; claudeBin: string; needsComposio: boolean }): Promise<Preflight> {
  const problems: string[] = []
  const notes: string[] = []
  const env = childEnv(args.env)
  const stripped = strippedCredentials(args.env)
  if (stripped.length > 0) notes.push(`${stripped.join(", ")} ${stripped.length > 1 ? "are" : "is"} set in this shell: left out of the calls, the login is used`)

  const version = await args.exec(args.claudeBin, ["--version"], { env, timeoutMs: 15_000 })
  // `2.1.299 (Claude Code)`: the number is what is shown
  const claudeVersion = version.code === 0 ? (version.stdout.trim().split(/\s+/)[0] || null) : null
  let subscription: string | null = null
  if (claudeVersion === null) {
    problems.push(`\`${args.claudeBin}\` does not run: Claude Code is not installed, or not on the PATH (https://claude.com/claude-code)`)
  } else {
    const status = await args.exec(args.claudeBin, ["auth", "status"], { env, timeoutMs: 20_000 })
    let parsed: unknown = null
    try {
      parsed = JSON.parse(status.stdout)
    } catch {
      parsed = null
    }
    const problem = authProblem(parsed)
    if (problem) problems.push(problem)
    else subscription = subscriptionOf(parsed)
  }

  for (const step of STEPS) {
    if (!existsSync(join(args.repoRoot, step.skillFile))) problems.push(`the skill ${step.skill} is not in this checkout (${step.skillFile}): update the branch from main`)
  }
  try {
    const manifest = JSON.parse(readFileSync(join(args.repoRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> }
    if (!manifest.scripts?.["check:scout"]) problems.push("`pnpm check:scout` is not in this checkout: update the branch from main")
  } catch {
    problems.push("package.json of the checkout cannot be read")
  }

  let composioPrefix = toolPrefix("claude.ai Composio")
  if (claudeVersion !== null && args.needsComposio) {
    const listing = await args.exec(args.claudeBin, ["mcp", "list"], { env, timeoutMs: 45_000 })
    const composio = composioOf(listing.stdout)
    if (!composio) problems.push("Composio is not among the MCP servers of `claude` (`claude mcp list`): connect it in the claude.ai connectors, then run `claude auth login` again, or add it with `claude mcp add --transport http -s user composio <its URL>`")
    else if (!composio.connected) problems.push(`${composio.server} is not connected (\`claude mcp list\`): reconnect it in the claude.ai connectors`)
    else composioPrefix = composio.prefix
  }
  return { problems, notes, claudeVersion, subscription, composioPrefix }
}

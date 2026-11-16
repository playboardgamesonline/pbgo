// What a headless call says, read as it comes: `claude -p --output-format stream-json --verbose` writes one JSON event per line. The events used here were
// captured from the real CLI (2.1.299): `system/init`, `assistant` (text, tool_use), `user` (tool_result), `system/permission_denied`, `rate_limit_event` and the
// final `result`. Anything else is ignored: a new kind of event never breaks a run.
import { printable, shorten } from "./render.ts"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === "string" ? value : "")

/** The usage windows of the owner's plan, as the CLI reports them (a fraction of the window used, and when it resets). */
export type RateInfo = { status: string; fiveHour: number | null; sevenDay: number | null; resetsAt: number | null }

/** A tool call that the policy (or the permission mode) refused, with what it aimed at. */
export type Denial = { tool: string; target: string; reason: string }

export type RunResult = {
  ok: boolean
  subtype: string
  isError: boolean
  /** the final message of the run: the skill's report */
  text: string
  costUsd: number
  turns: number
  durationMs: number
  sessionId: string | null
  errors: string[]
  terminalReason: string | null
  /** the answer to `--json-schema`, when there was one */
  structured: unknown
  /** a sentence saying why the run did not succeed, `null` when it did */
  failure: string | null
}

/** The sentence for a run that did not succeed. */
export function failureOf(event: Record<string, unknown>): string | null {
  const subtype = text(event.subtype)
  const errors = Array.isArray(event.errors) ? event.errors.filter((error): error is string => typeof error === "string") : []
  const message = text(event.result)
  if (subtype === "error_max_budget_usd") return `the budget of the call was reached${errors.length > 0 ? ` (${errors.join(" ")})` : ""}: raise PBGO_ADD_GAME_BUDGET_USD and run the command again`
  if (subtype === "error_max_turns") return "the call used all its turns"
  if (subtype === "error_during_execution") return "the call was interrupted"
  if (event.is_error === true) {
    if (/not logged in/i.test(message)) return "claude is not logged in: run `claude auth login`"
    if (/invalid api key/i.test(message)) return "an API key took over the login: unset ANTHROPIC_API_KEY (the command strips it from the calls, so this should not happen)"
    return message || errors.join(" ") || "the call failed"
  }
  if (subtype !== "success") return `the call ended with "${subtype}"`
  return null
}

function resultOf(event: Record<string, unknown>): RunResult {
  const failure = failureOf(event)
  return {
    ok: failure === null,
    subtype: text(event.subtype),
    isError: event.is_error === true,
    text: text(event.result),
    costUsd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : 0,
    turns: typeof event.num_turns === "number" ? event.num_turns : 0,
    durationMs: typeof event.duration_ms === "number" ? event.duration_ms : 0,
    sessionId: typeof event.session_id === "string" ? event.session_id : null,
    errors: Array.isArray(event.errors) ? event.errors.filter((error): error is string => typeof error === "string") : [],
    terminalReason: typeof event.terminal_reason === "string" ? event.terminal_reason : null,
    structured: event.structured_output,
    failure,
  }
}

/** `mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS` → the server and the tool. */
export function splitMcpName(name: string): { server: string; tool: string } | null {
  const parts = name.split("__")
  const [first, server] = parts
  if (first !== "mcp" || !server || parts.length < 3) return null
  return { server, tool: parts.slice(2).join("__") }
}

/** One line for a tool call, as the owner reads it while the call runs; `null` for the calls that are only noise. */
export function describeToolUse(name: string, input: Record<string, unknown>): string | null {
  switch (name) {
    case "ToolSearch":
    case "TodoWrite":
      return null
    case "WebSearch":
      return `search "${shorten(text(input.query), 80)}"`
    case "WebFetch":
      return `fetch ${shorten(text(input.url), 90)}`
    case "Bash":
      return `$ ${shorten(text(input.command), 100)}`
    case "Read":
      return `read ${shorten(text(input.file_path), 90)}`
    case "Write":
    case "Edit":
      return `write ${shorten(text(input.file_path), 90)}`
    case "Skill":
      return `skill ${text(input.skill)}`
  }
  const mcp = splitMcpName(name)
  if (mcp?.tool === "COMPOSIO_MULTI_EXECUTE_TOOL") {
    const calls = Array.isArray(input.tools) ? input.tools.filter(isRecord) : []
    const slugs = calls.map((call) => text(call.tool_slug)).filter(Boolean)
    const dry = calls.some((call) => isRecord(call.arguments) && call.arguments.dry_run === true)
    return `Composio ${slugs.join(", ") || "(no tool)"}${dry ? " (dry run)" : ""}`
  }
  if (mcp?.tool === "COMPOSIO_SEARCH_TOOLS" || mcp?.tool === "COMPOSIO_GET_TOOL_SCHEMAS") return "Composio: looking up tools"
  return mcp ? `${mcp.server}: ${mcp.tool}` : name
}

/** The first text of a tool result (a string, or a list of blocks). */
function resultText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((block) => (isRecord(block) && block.type === "text" ? text(block.text) : ""))
    .filter(Boolean)
    .join("\n")
}

/** Follows one headless call: what it announced, what it did, what the policy refused, what it reported. */
export class RunTracker {
  sessionId: string | null = null
  /** `none` when the owner's login is used; anything else is an API key or another source that took over */
  apiKeySource: string | null = null
  permissionMode: string | null = null
  model: string | null = null
  mcpServers: string[] = []
  rate: RateInfo | null = null
  denials: Denial[] = []
  result: RunResult | null = null
  toolCalls = 0
  /** every tool call the agent made, with what it aimed at (the self-test reads it to see what was tried) */
  calls: { name: string; target: string }[] = []
  /** the tools a ToolSearch found (`tool_reference` blocks of a tool result) */
  toolReferences: string[] = []
  readonly #uses = new Map<string, { name: string; input: Record<string, unknown> }>()
  readonly #denied = new Set<string>()

  /**
   * Takes one event; returns the lines to show for it (none, most of the time). What an agent aimed at (a command, an address) may hold what it read on a web page:
   * a line is printed with no escape sequence and no control character in it.
   */
  feed(event: unknown): string[] {
    return this.#feed(event).map((line) => printable(line).replace(/ {2,}/g, " "))
  }

  #feed(event: unknown): string[] {
    if (!isRecord(event)) return []
    const type = text(event.type)
    if (type === "system" && event.subtype === "init") {
      this.sessionId = typeof event.session_id === "string" ? event.session_id : this.sessionId
      this.apiKeySource = typeof event.apiKeySource === "string" ? event.apiKeySource : this.apiKeySource
      this.permissionMode = typeof event.permissionMode === "string" ? event.permissionMode : this.permissionMode
      this.model = typeof event.model === "string" ? event.model : this.model
      if (Array.isArray(event.mcp_servers)) this.mcpServers = event.mcp_servers.filter(isRecord).map((server) => `${text(server.name)}:${text(server.status)}`)
      return []
    }
    if (type === "assistant") return this.#assistant(event)
    if (type === "user") return this.#user(event)
    if (type === "system" && event.subtype === "permission_denied") {
      const id = text(event.tool_use_id)
      if (id && this.#denied.has(id)) return []
      if (id) this.#denied.add(id)
      const use = this.#uses.get(id)
      const denial: Denial = { tool: text(event.tool_name) || use?.name || "tool", target: targetOf(use), reason: "not on the allowlist of this step" }
      this.denials.push(denial)
      return [blockedLine(denial)]
    }
    if (type === "rate_limit_event" && isRecord(event.rate_limit_info)) {
      const info = event.rate_limit_info
      const windows = isRecord(info.unifiedWindows) ? info.unifiedWindows : {}
      const utilization = (name: string): number | null => {
        const window = windows[name]
        return isRecord(window) && typeof window.utilization === "number" ? window.utilization : null
      }
      this.rate = { status: text(info.status) || "unknown", fiveHour: utilization("five_hour"), sevenDay: utilization("seven_day"), resetsAt: typeof info.resetsAt === "number" ? info.resetsAt : null }
      return []
    }
    if (type === "result") {
      this.result = resultOf(event)
      if (this.result.sessionId) this.sessionId = this.result.sessionId
    }
    return []
  }

  #assistant(event: Record<string, unknown>): string[] {
    const message = event.message
    const content = isRecord(message) && Array.isArray(message.content) ? message.content : []
    const lines: string[] = []
    for (const block of content) {
      if (!isRecord(block) || block.type !== "tool_use") continue
      const name = text(block.name)
      const input = isRecord(block.input) ? block.input : {}
      this.toolCalls += 1
      this.calls.push({ name, target: targetOf({ name, input }) })
      if (typeof block.id === "string") this.#uses.set(block.id, { name, input })
      const line = describeToolUse(name, input)
      if (line) lines.push(line)
    }
    return lines
  }

  #user(event: Record<string, unknown>): string[] {
    const message = event.message
    const content = isRecord(message) && Array.isArray(message.content) ? message.content : []
    const lines: string[] = []
    for (const block of content) {
      if (isRecord(block) && block.type === "tool_result" && Array.isArray(block.content)) {
        for (const part of block.content) if (isRecord(part) && part.type === "tool_reference" && typeof part.tool_name === "string") this.toolReferences.push(part.tool_name)
      }
      if (!isRecord(block) || block.type !== "tool_result" || block.is_error !== true) continue
      const id = text(block.tool_use_id)
      const body = resultText(block.content)
      const hook = /^PreToolUse:(\S+) hook error: ([\s\S]*)$/.exec(body)
      if (!hook && !/denied because Claude Code is running in don't ask mode/.test(body)) continue
      if (id && this.#denied.has(id)) continue
      if (id) this.#denied.add(id)
      const use = this.#uses.get(id)
      const denial: Denial = { tool: hook?.[1] ?? use?.name ?? "tool", target: targetOf(use), reason: hook ? shorten(hook[2] ?? "", 160) : "not on the allowlist of this step" }
      this.denials.push(denial)
      lines.push(blockedLine(denial))
    }
    return lines
  }
}

function targetOf(use: { name: string; input: Record<string, unknown> } | undefined): string {
  if (!use) return ""
  const { input } = use
  if (typeof input.file_path === "string") return input.file_path
  if (typeof input.command === "string") return shorten(input.command, 80)
  if (typeof input.url === "string") return input.url
  if (Array.isArray(input.tools)) return input.tools.filter(isRecord).map((call) => text(call.tool_slug)).join(", ")
  return ""
}

export function blockedLine(denial: Denial): string {
  return `✗ blocked: ${denial.tool}${denial.target ? ` ${denial.target}` : ""} (${denial.reason})`
}

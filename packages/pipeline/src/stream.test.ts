import { describe, expect, it } from "vitest"
import { describeToolUse, failureOf, RunTracker, splitMcpName } from "./stream.ts"

// The events are the ones the CLI 2.1.299 wrote in real runs, cut down to what is read here.
const init = { type: "system", subtype: "init", session_id: "s1", apiKeySource: "none", permissionMode: "dontAsk", model: "claude-haiku-5-5", mcp_servers: [{ name: "Sanity", status: "connected" }] }
const use = (id: string, name: string, input: Record<string, unknown>) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } })
const failed = (id: string, content: string) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: true, content }] } })

describe("what a call says as it runs", () => {
  it("keeps the session, the login in use and the mode from the init event", () => {
    const tracker = new RunTracker()
    expect(tracker.feed(init)).toEqual([])
    expect(tracker).toMatchObject({ sessionId: "s1", apiKeySource: "none", permissionMode: "dontAsk", model: "claude-haiku-5-5", mcpServers: ["Sanity:connected"] })
  })

  it("makes one line of each tool call, and none of the noise", () => {
    const tracker = new RunTracker()
    expect(tracker.feed(use("1", "WebSearch", { query: "Love Letter publisher" }))).toEqual(['search "Love Letter publisher"'])
    expect(tracker.feed(use("2", "Bash", { command: "pnpm check:scout /x/scout.json --online" }))).toEqual(["$ pnpm check:scout /x/scout.json --online"])
    expect(tracker.feed(use("3", "ToolSearch", { query: "composio" }))).toEqual([])
    expect(tracker.feed(use("4", "Write", { file_path: "/x/scout.json" }))).toEqual(["write /x/scout.json"])
    expect(tracker.feed(use("5", "mcp__claude_ai_Composio__COMPOSIO_MULTI_EXECUTE_TOOL", { tools: [{ tool_slug: "SANITY_MUTATE_DOCUMENTS", arguments: { dry_run: true } }] }))).toEqual(["Composio SANITY_MUTATE_DOCUMENTS (dry run)"])
    expect(tracker.feed(use("6", "mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS", {}))).toEqual(["Composio: looking up tools"])
    expect(tracker.toolCalls).toBe(6)
  })

  it("prints no escape sequence a tool call carried: a command or an address comes from what the agent read", () => {
    const ESC = String.fromCharCode(27)
    const tracker = new RunTracker()
    const lines = [...tracker.feed(use("a", "Bash", { command: `echo ${ESC}]0;owned${String.fromCharCode(7)} done` })), ...tracker.feed(use("b", "WebFetch", { url: `https://example.com/${ESC}[2J` }))]
    expect(lines).toEqual(["$ echo done", "fetch https://example.com/"])
    expect(lines.join("")).not.toContain(ESC)
    tracker.feed(use("w", "Write", { file_path: `/repo/${ESC}[31mx.txt` }))
    expect(tracker.feed(failed("w", `PreToolUse:Write hook error: ${ESC}[2Jno`)).join("")).not.toContain(ESC)
  })

  it("keeps every call with what it aimed at, whether the policy refused it or not", () => {
    const tracker = new RunTracker()
    tracker.feed(use("r", "Read", { file_path: "/repo/.claude/skills/game-scout/SKILL.md" }))
    tracker.feed(use("b", "Bash", { command: "curl --version" }))
    tracker.feed(use("t", "ToolSearch", { query: "select:x" }))
    expect(tracker.calls).toEqual([
      { name: "Read", target: "/repo/.claude/skills/game-scout/SKILL.md" },
      { name: "Bash", target: "curl --version" },
      { name: "ToolSearch", target: "" },
    ])
  })

  it("tells what the policy refused, once, whichever event says it", () => {
    const tracker = new RunTracker()
    tracker.feed(use("w", "Write", { file_path: "/repo/x.txt" }))
    expect(tracker.feed(failed("w", "PreToolUse:Write hook error: a step writes only under /assets/game"))).toEqual(["✗ blocked: Write /repo/x.txt (a step writes only under /assets/game)"])
    // the same call is announced by a system event as well: counted once
    expect(tracker.feed({ type: "system", subtype: "permission_denied", tool_name: "Write", tool_use_id: "w" })).toEqual([])
    tracker.feed(use("b", "Bash", { command: "curl --version" }))
    expect(tracker.feed(failed("b", "Permission to use Bash has been denied because Claude Code is running in don't ask mode."))).toEqual(["✗ blocked: Bash curl --version (not on the allowlist of this step)"])
    expect(tracker.denials.map((denial) => denial.tool)).toEqual(["Write", "Bash"])
  })

  it("ignores a failed tool result that is no refusal", () => {
    const tracker = new RunTracker()
    tracker.feed(use("x", "Bash", { command: "pnpm check:scout f" }))
    expect(tracker.feed(failed("x", "Exit code 1\nfail f"))).toEqual([])
    expect(tracker.denials).toEqual([])
  })

  it("collects the tools a ToolSearch found", () => {
    const tracker = new RunTracker()
    tracker.feed({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t", content: [{ type: "tool_reference", tool_name: "mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS" }] }] } })
    expect(tracker.toolReferences).toEqual(["mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS"])
  })

  it("reads the usage windows of the plan", () => {
    const tracker = new RunTracker()
    tracker.feed({ type: "rate_limit_event", rate_limit_info: { status: "allowed", resetsAt: 1794856800, unifiedWindows: { five_hour: { utilization: 0.17 }, seven_day: { utilization: 0.3 } } } })
    expect(tracker.rate).toEqual({ status: "allowed", fiveHour: 0.17, sevenDay: 0.3, resetsAt: 1794856800 })
  })

  it("ignores an event it does not know", () => {
    const tracker = new RunTracker()
    expect(tracker.feed({ type: "something_new", subtype: "whatever" })).toEqual([])
    expect(tracker.feed("not an event")).toEqual([])
    expect(tracker.feed(null)).toEqual([])
  })
})

describe("how a call ended", () => {
  it("reads the report, the cost and the answer of a call that went well", () => {
    const tracker = new RunTracker()
    tracker.feed({ type: "result", subtype: "success", is_error: false, result: "the report", session_id: "s2", total_cost_usd: 0.42, num_turns: 4, duration_ms: 9000, structured_output: { a: 1 } })
    expect(tracker.result).toMatchObject({ ok: true, text: "the report", costUsd: 0.42, turns: 4, sessionId: "s2", structured: { a: 1 }, failure: null })
    expect(tracker.sessionId).toBe("s2")
  })

  it("says why a call did not go well", () => {
    expect(failureOf({ subtype: "error_max_budget_usd", is_error: true, errors: ["Reached maximum budget ($3)"] })).toContain("PBGO_ADD_GAME_BUDGET_USD")
    expect(failureOf({ subtype: "success", is_error: true, result: "Not logged in · Please run /login" })).toContain("claude auth login")
    expect(failureOf({ subtype: "success", is_error: true, result: "Invalid API key · Fix external API key" })).toContain("API key took over")
    expect(failureOf({ subtype: "error_during_execution", is_error: true })).toBe("the call was interrupted")
    expect(failureOf({ subtype: "success", is_error: true, result: "something else" })).toBe("something else")
    expect(failureOf({ subtype: "error_max_turns" })).toBe("the call used all its turns")
    expect(failureOf({ subtype: "success", is_error: false })).toBeNull()
  })
})

describe("names of tools", () => {
  it("splits a server's tool", () => {
    expect(splitMcpName("mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS")).toEqual({ server: "claude_ai_Composio", tool: "COMPOSIO_SEARCH_TOOLS" })
    expect(splitMcpName("Write")).toBeNull()
    expect(describeToolUse("mcp__linear__save_issue", {})).toBe("linear: save_issue")
  })
})

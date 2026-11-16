// A stand-in for `claude` that the tests run (PBGO_CLAUDE_BIN): it answers `--version`, `auth status`, `mcp list`, and the headless calls (`-p`) from a scenario
// file, with the same events the real CLI 2.1.299 writes (captured from real runs: system/init, assistant tool_use, user tool_result, rate_limit_event, result).
// Every invocation is added to FAKE_CLAUDE_LOG, so that a test can read what the command asked, with which arguments and which environment.
//
// Scenario (JSON, FAKE_CLAUDE_SCENARIO): { version?, auth?, mcp?, calls: [ { match, text, cost?, writes?, tools?, denials?, structured?, error?, hang?, apiKeySource?, ... } ] }
// A call of the scenario answers the first headless call whose prompt matches its `match` (a regular expression) and that no call has answered yet.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

const argv = process.argv.slice(2)
const scenario = process.env.FAKE_CLAUDE_SCENARIO ? JSON.parse(readFileSync(process.env.FAKE_CLAUDE_SCENARIO, "utf8")) : {}
const flag = (name) => {
  const at = argv.indexOf(name)
  return at >= 0 ? (argv[at + 1] ?? null) : null
}
const env = () => ({
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null,
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? null,
  CLAUDECODE: process.env.CLAUDECODE ?? null,
  CLAUDE_CODE_ENTRYPOINT: process.env.CLAUDE_CODE_ENTRYPOINT ?? null,
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR ?? null,
  USER: process.env.USER ?? null,
  PBGO_PUBLISH_OK: process.env.PBGO_PUBLISH_OK ?? null,
  PBGO_GUARD_POLICY: process.env.PBGO_GUARD_POLICY ?? null,
})
// the policy file of the call, as it was when the call began (the command rewrites it for each call)
const policy = () => {
  try {
    return process.env.PBGO_GUARD_POLICY ? JSON.parse(readFileSync(process.env.PBGO_GUARD_POLICY, "utf8")) : null
  } catch {
    return null
  }
}
const record = (extra = {}) => {
  if (process.env.FAKE_CLAUDE_LOG) appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify({ argv, cwd: process.cwd(), env: env(), policy: policy(), ...extra })}\n`)
}
const out = (event) => process.stdout.write(`${JSON.stringify(event)}\n`)

if (argv[0] === "--version") {
  record()
  console.log(scenario.version ?? "9.9.9 (Claude Code)")
  process.exit(0)
}
if (argv[0] === "auth" && argv[1] === "status") {
  record()
  console.log(JSON.stringify(scenario.auth ?? { loggedIn: true, authMethod: "claude.ai", subscriptionType: "max" }))
  process.exit(0)
}
if (argv[0] === "mcp" && argv[1] === "list") {
  record()
  console.log(scenario.mcp ?? "Checking MCP server health…\n\nclaude.ai Composio: https://connect.composio.dev/mcp - ✔ Connected\nSanity: https://mcp.sanity.io (HTTP) - ✔ Connected")
  process.exit(0)
}

const prompt = flag("-p") ?? ""
const sessionId = flag("--session-id") ?? flag("--resume") ?? "00000000-0000-4000-8000-000000000000"
const calls = scenario.calls ?? []
const usedFile = process.env.FAKE_CLAUDE_USED
const used = new Set(usedFile && existsSync(usedFile) ? JSON.parse(readFileSync(usedFile, "utf8")) : [])
const index = calls.findIndex((call, at) => !used.has(at) && new RegExp(call.match ?? ".").test(prompt))
record({ prompt, matched: index })
const apiKeySource = calls[index]?.apiKeySource ?? (process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : "none")
out({ type: "system", subtype: "init", session_id: sessionId, apiKeySource, permissionMode: flag("--permission-mode"), model: flag("--model"), mcp_servers: [{ name: "claude.ai Composio", status: "connected" }], tools: [] })
if (index < 0) {
  out({ type: "result", subtype: "success", is_error: true, result: `the fake has no call for this prompt: ${prompt.slice(0, 80)}`, session_id: sessionId, total_cost_usd: 0, num_turns: 1 })
  process.exit(1)
}
used.add(index)
if (usedFile) writeFileSync(usedFile, JSON.stringify([...used]))
const spec = calls[index]

let n = 0
for (const tool of spec.tools ?? []) {
  n += 1
  out({ type: "assistant", message: { content: [{ type: "tool_use", id: tool.id ?? `toolu_${index}_${n}`, name: tool.name, input: tool.input ?? {} }] } })
}
for (const denial of spec.denials ?? []) {
  n += 1
  const id = `toolu_${index}_${n}`
  out({ type: "assistant", message: { content: [{ type: "tool_use", id, name: denial.tool, input: denial.input ?? {} }] } })
  out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: true, content: denial.hook ? `PreToolUse:${denial.tool} hook error: ${denial.reason}` : "Permission to use Bash has been denied because Claude Code is running in don't ask mode." }] } })
}
out({ type: "rate_limit_event", rate_limit_info: { status: "allowed", resetsAt: 1794856800, rateLimitType: "five_hour", unifiedWindows: { five_hour: { utilization: 0.17, resetsAt: 1794856800 }, seven_day: { utilization: 0.3, resetsAt: 1795309200 } } } })

const outPath = /--out (\S+)/.exec(prompt)?.[1] ?? ""
for (const write of spec.writes ?? []) {
  const path = write.path.replace("$OUT", outPath).replace("$ASSETS", process.env.PBGO_ASSETS_DIR ?? "").replace("$DOCS", process.env.PBGO_GAMES_DOCS_DIR ?? "")
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, write.content)
}

if (spec.hang) {
  // a call that does not end by itself: Ctrl-C ends it, as the real CLI does (an error result, the session kept)
  process.on("SIGINT", () => {
    out({ type: "result", subtype: "error_during_execution", is_error: true, session_id: sessionId, total_cost_usd: 0.01, num_turns: 1, errors: ["interrupted"] })
    process.exit(0)
  })
  if (spec.startedFile) writeFileSync(spec.startedFile, "started")
  setInterval(() => {}, 1000)
} else {
  out({
    type: "result",
    subtype: spec.subtype ?? "success",
    is_error: spec.isError ?? false,
    result: spec.text ?? "",
    session_id: sessionId,
    total_cost_usd: spec.cost ?? 0.1,
    num_turns: 3,
    duration_ms: 1000,
    terminal_reason: spec.terminalReason ?? "completed",
    errors: spec.errors,
    structured_output: spec.structured,
    permission_denials: [],
  })
  process.exit(spec.exitCode ?? 0)
}

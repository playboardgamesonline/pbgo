// The hook as Claude Code runs it: a process that reads a tool call on stdin and answers on stdout. It is the allowlist of a headless step, so it is tested as a
// process, with the real file, and above all for what it does when something is wrong: it denies.
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { REPO_ROOT } from "./config.ts"
import type { Policy } from "./policy.ts"

let dir = ""
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pipeline-guard-"))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const GUARD = join(REPO_ROOT, "packages", "pipeline", "hook", "guard.ts")
const policy: Policy = { repoRoot: REPO_ROOT, workDir: "/assets/g", writeFiles: ["/assets/g/scout.json"], readFiles: [], bash: [], composio: null }

type Answer = { code: number | null; stdout: string; decision: string | null; reason: string | null; log: { tool: string; decision: string; reason: string }[] }

function guard(input: string, options: { policy?: string | null; env?: Record<string, string> } = {}): Answer {
  const policyPath = join(dir, "policy.json")
  const logPath = join(dir, "guard.log")
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", HOME: dir, PBGO_GUARD_LOG: logPath, ...options.env }
  if (options.policy !== null) {
    writeFileSync(policyPath, options.policy ?? JSON.stringify(policy))
    env.PBGO_GUARD_POLICY = policyPath
  }
  const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", GUARD], { input, env, encoding: "utf8" })
  const parsed = run.stdout.trim() ? (JSON.parse(run.stdout) as { hookSpecificOutput: { hookEventName: string; permissionDecision: string; permissionDecisionReason: string } }) : null
  expect(parsed === null || parsed.hookSpecificOutput.hookEventName === "PreToolUse").toBe(true)
  return {
    code: run.status,
    stdout: run.stdout,
    decision: parsed?.hookSpecificOutput.permissionDecision ?? null,
    reason: parsed?.hookSpecificOutput.permissionDecisionReason ?? null,
    log: existsSync(logPath)
      ? readFileSync(logPath, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { tool: string; decision: string; reason: string })
      : [],
  }
}
const call = (tool_name: string, tool_input: Record<string, unknown>) => JSON.stringify({ tool_name, tool_input, hook_event_name: "PreToolUse" })

describe("the hook", () => {
  it("allows what the policy allows, says so on stdout, and logs it", () => {
    const answer = guard(call("Write", { file_path: "/assets/g/scout.json" }))
    expect(answer).toMatchObject({ code: 0, decision: "allow" })
    expect(answer.log).toEqual([{ tool: "Write", decision: "allow", reason: "write of the file of the step" }])
  })

  it("denies what the policy denies, with the reason the agent reads", () => {
    const answer = guard(call("Write", { file_path: "/assets/g/pipeline.json" }))
    expect(answer).toMatchObject({ code: 0, decision: "deny" })
    expect(answer.reason).toContain("only /assets/g/scout.json")
    expect(guard(call("Bash", { command: "curl https://example.com" })).decision).toBe("deny")
    expect(guard(call("Grep", { pattern: "x" })).decision).toBe("deny")
  })

  it("says nothing for what it does not rule on, which the mode decides", () => {
    const answer = guard(call("Read", { file_path: join(REPO_ROOT, "package.json") }))
    expect(answer).toMatchObject({ code: 0, stdout: "", decision: null })
    expect(answer.log).toEqual([{ tool: "Read", decision: "none", reason: "left to the mode" }])
    expect(guard(call("WebSearch", { query: "x" })).stdout).toBe("")
  })

  it("asks git whether a file of the repo is ignored, and denies it when it is", () => {
    expect(guard(call("Read", { file_path: join(REPO_ROOT, "node_modules", "anything.js") })).reason).toContain("git ignores")
    expect(guard(call("Read", { file_path: join(REPO_ROOT, "apps", "web", ".env.local") })).decision).toBe("deny")
  })

  it("fails closed: every call is denied when the policy is not given, cannot be read, or is not one", () => {
    const write = call("Write", { file_path: "/assets/g/scout.json" })
    expect(guard(write, { policy: null })).toMatchObject({ code: 0, decision: "deny", reason: expect.stringContaining("policy of this step is not given") })
    expect(guard(write, { policy: "{ not json" })).toMatchObject({ code: 0, decision: "deny", reason: expect.stringContaining("could not decide") })
    expect(guard(write, { policy: "null" })).toMatchObject({ code: 0, decision: "deny" })
    expect(guard(write, { env: { PBGO_GUARD_POLICY: join(dir, "missing.json") }, policy: null })).toMatchObject({ code: 0, decision: "deny", reason: expect.stringContaining("could not decide") })
    // a policy with the wrong shape (a rule that is not a rule) denies the call it cannot judge, and the ones it can are still judged
    expect(guard(write, { policy: JSON.stringify({ ...policy, bash: [{ regex: "(" }] }) }).decision).toBe("allow")
    expect(guard(call("Bash", { command: "date" }), { policy: JSON.stringify({ ...policy, bash: [{ regex: "(" }] }) }).decision).toBe("deny")
    // and a tool call that is no JSON, or no call at all
    for (const input of ["", "not json", "null", "[]", "{}"]) expect(guard(input), JSON.stringify(input)).toMatchObject({ code: 0, decision: "deny" })
  })

  it("still decides when its log cannot be written", () => {
    const answer = guard(call("Write", { file_path: "/assets/g/scout.json" }), { env: { PBGO_GUARD_LOG: join(dir, "no", "such", "folder", "guard.log") } })
    expect(answer).toMatchObject({ code: 0, decision: "allow" })
  })

  it("lets a tool of a word the shell had set give no power: the word that publishes is the environment of the hook's parent, read when the call is judged", () => {
    const catalog: Policy = { ...policy, writeFiles: [], composio: { server: "claude_ai_Composio", slugs: ["SANITY_MUTATE_DOCUMENTS"], sanity: { projectId: "mhgqs6fe", dataset: "production", gameSlug: "g", publishIds: ["game-g"] }, linear: null } }
    const publish = call("mcp__claude_ai_Composio__COMPOSIO_MULTI_EXECUTE_TOOL", {
      tools: [{ tool_slug: "SANITY_MUTATE_DOCUMENTS", arguments: { project_id: "mhgqs6fe", dataset: "production", mutations: [{ createOrReplace: { _id: "game-g", _type: "game" } }, { delete: { id: "drafts.game-g" } }] } }],
    })
    expect(guard(publish, { policy: JSON.stringify(catalog) }).decision).toBe("deny")
    expect(guard(publish, { policy: JSON.stringify(catalog), env: { PBGO_PUBLISH_OK: "0" } }).decision).toBe("deny")
    expect(guard(publish, { policy: JSON.stringify(catalog), env: { PBGO_PUBLISH_OK: "1" } }).decision).toBe("allow")
  })
})

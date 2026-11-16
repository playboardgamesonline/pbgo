// The PreToolUse hook of a headless step (registered by `--settings`, see policy.ts `hookSettings`): Claude Code writes the tool call as JSON on stdin, this
// answers on stdout. "allow" lets the call through the mode `dontAsk`, "deny" refuses it and tells the agent why, nothing leaves it to the mode (which refuses whatever
// is not read-only, and lets a read inside the repo be). The hook fails closed: when it cannot read its policy, or fails on any call, it DENIES that call. PBGO_GUARD_POLICY is
// the path of the policy (JSON), PBGO_GUARD_LOG, when set, a file each decision is added to (JSON lines: how the owner finds out why a call was blocked).
import { spawnSync } from "node:child_process"
import { appendFileSync, readFileSync } from "node:fs"
import { decide, type Call, type Policy } from "../src/policy.ts"

const chunks: Buffer[] = []
for await (const chunk of process.stdin) chunks.push(chunk as Buffer)

const log = process.env.PBGO_GUARD_LOG
const answer = (tool: string, decision: "allow" | "deny" | "none", reason: string) => {
  try {
    if (log) appendFileSync(log, `${JSON.stringify({ tool, decision, reason })}\n`)
  } catch {
    // a log that cannot be written is no reason to decide differently
  }
  if (decision !== "none") process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } })}\n`)
}

let tool = "?"
try {
  const call = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Call
  tool = typeof call?.tool_name === "string" ? call.tool_name : "?"
  const policyPath = process.env.PBGO_GUARD_POLICY
  if (!policyPath) {
    answer(tool, "deny", "the policy of this step is not given: nothing is allowed")
  } else {
    const policy = JSON.parse(readFileSync(policyPath, "utf8")) as Policy
    // a file of the repo that git ignores (an .env, a token) is not the project's
    const ignored = (path: string) => spawnSync("git", ["check-ignore", "-q", "--", path], { cwd: policy.repoRoot }).status === 0
    const result = decide(policy, call, process.env, { ignored })
    answer(tool, result.decision, "reason" in result ? result.reason : "left to the mode")
  }
} catch {
  answer(tool, "deny", "the guard could not decide: nothing is allowed")
}

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { REPO_ROOT } from "./config.ts"
import { authProblem, composioOf, preflight, subscriptionOf, toolPrefix, type Exec } from "./preflight.ts"

const LOGGED_IN = { loggedIn: true, authMethod: "claude.ai", subscriptionType: "max" }

describe("claude's login", () => {
  it("is the subscription login or it is a problem that says what to do", () => {
    expect(authProblem(LOGGED_IN)).toBeNull()
    expect(authProblem({ loggedIn: false, authMethod: "none" })).toContain("claude auth login")
    expect(authProblem({ loggedIn: true, authMethod: "api_key", apiKeySource: "ANTHROPIC_API_KEY" })).toContain("API key")
    expect(authProblem({ loggedIn: true, authMethod: "third_party", apiProvider: "bedrock" })).toContain("cloud provider")
    expect(authProblem({ loggedIn: true, authMethod: "oauth_token" })).toContain("oauth_token")
    expect(authProblem(null)).toContain("JSON")
  })

  it("names the subscription", () => {
    expect(subscriptionOf(LOGGED_IN)).toBe("max")
    expect(subscriptionOf({})).toBeNull()
  })
})

describe("Composio among claude's servers", () => {
  it("is found in the list the CLI prints, with the prefix of its tools", () => {
    const listing = "Checking MCP server health…\n\nclaude.ai Slack: https://mcp.slack.com/mcp - ✔ Connected\nclaude.ai Composio: https://connect.composio.dev/mcp - ✔ Connected\nSanity: https://mcp.sanity.io (HTTP) - ✔ Connected\n"
    expect(composioOf(listing)).toEqual({ server: "claude.ai Composio", connected: true, prefix: "mcp__claude_ai_Composio__" })
  })

  it("is found under another name, and said not to be connected when it needs a login or failed", () => {
    expect(composioOf("composio: https://example.com/mcp (HTTP) - ✔ Connected")).toEqual({ server: "composio", connected: true, prefix: "mcp__composio__" })
    expect(composioOf("claude.ai Composio: https://connect.composio.dev/mcp - ! Needs authentication")?.connected).toBe(false)
    expect(composioOf("claude.ai Composio: https://connect.composio.dev/mcp - ✗ Failed to connect")?.connected).toBe(false)
    expect(composioOf("Sanity: https://mcp.sanity.io (HTTP) - ✔ Connected")).toBeNull()
    expect(composioOf("")).toBeNull()
  })

  it("makes the prefix as the CLI does: characters outside letters, digits, _ and - become _", () => {
    expect(toolPrefix("claude.ai Composio")).toBe("mcp__claude_ai_Composio__")
    expect(toolPrefix("my-server_1")).toBe("mcp__my-server_1__")
  })
})

describe("what is checked before the command starts", () => {
  const exec = (answers: { version?: string | null; auth?: unknown; mcp?: string }): Exec => async (_file, args) => {
    if (args[0] === "--version") return answers.version === null ? { code: null, stdout: "", stderr: "not found" } : { code: 0, stdout: `${answers.version ?? "2.1.299 (Claude Code)"}\n`, stderr: "" }
    if (args[0] === "auth") return { code: 0, stdout: JSON.stringify(answers.auth ?? LOGGED_IN), stderr: "" }
    if (args[0] === "mcp") return { code: 0, stdout: answers.mcp ?? "claude.ai Composio: https://connect.composio.dev/mcp - ✔ Connected\n", stderr: "" }
    return { code: 1, stdout: "", stderr: "unexpected" }
  }
  const run = (answers: Parameters<typeof exec>[0], env: Record<string, string> = {}, repoRoot = REPO_ROOT) => preflight({ exec: exec(answers), env, repoRoot, claudeBin: "claude", needsComposio: true })

  it("passes on a logged-in claude with Composio, in a checkout that has the skills", async () => {
    expect(await run({})).toMatchObject({ problems: [], claudeVersion: "2.1.299", subscription: "max", composioPrefix: "mcp__claude_ai_Composio__" })
  })

  it("says that a key in the shell is left out of the calls", async () => {
    const result = await run({}, { ANTHROPIC_API_KEY: "sk-x", CLAUDE_CODE_ENTRYPOINT: "cli" })
    expect(result.problems).toEqual([])
    expect(result.notes).toEqual(["ANTHROPIC_API_KEY is set in this shell: left out of the calls, the login is used"])
  })

  it("stops on a claude that is missing, a login that is missing or is a key, and a Composio that is missing or not connected", async () => {
    expect((await run({ version: null })).problems[0]).toContain("does not run")
    expect((await run({ auth: { loggedIn: false, authMethod: "none" } })).problems[0]).toContain("claude auth login")
    expect((await run({ auth: { loggedIn: true, authMethod: "api_key" } })).problems[0]).toContain("API key")
    expect((await run({ mcp: "Sanity: https://mcp.sanity.io (HTTP) - ✔ Connected" })).problems[0]).toContain("Composio is not among")
    expect((await run({ mcp: "claude.ai Composio: https://x - ! Needs authentication" })).problems[0]).toContain("not connected")
  })

  it("stops on a checkout that lacks a skill or the check:scout script", async () => {
    const root = mkdtempSync(join(tmpdir(), "pipeline-preflight-"))
    try {
      mkdirSync(join(root, ".claude", "skills", "game-scout"), { recursive: true })
      writeFileSync(join(root, ".claude", "skills", "game-scout", "SKILL.md"), "x")
      writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: {} }))
      const problems = (await run({}, {}, root)).problems
      expect(problems.some((problem) => problem.includes("platform-catalog-entry"))).toBe(true)
      expect(problems.some((problem) => problem.includes("check:scout"))).toBe(true)
      expect(problems.some((problem) => problem.includes("game-scout"))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

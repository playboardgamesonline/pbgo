import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { callArgs, childEnv, runClaude, strippedCredentials, strippedNames } from "./claude.ts"

describe("the environment of a call", () => {
  const parent = {
    PATH: "/usr/bin",
    USER: "ada",
    HOME: "/Users/ada",
    ANTHROPIC_API_KEY: "sk-ant-x",
    ANTHROPIC_AUTH_TOKEN: "token",
    ANTHROPIC_BASE_URL: "https://proxy.example",
    CLAUDECODE: "1",
    CLAUDE_CODE_ENTRYPOINT: "cli",
    CLAUDE_CODE_USE_BEDROCK: "1",
    CLAUDE_CONFIG_DIR: "/Users/ada/.claude-work",
    CLAUDE_AGENT_SDK_VERSION: "0.2",
    NOT_CLAUDE: "kept",
  }

  it("takes out every ANTHROPIC_* and CLAUDE* variable, and keeps the login's way in (USER, HOME, the config folder)", () => {
    expect(childEnv(parent)).toEqual({ PATH: "/usr/bin", USER: "ada", HOME: "/Users/ada", CLAUDE_CONFIG_DIR: "/Users/ada/.claude-work", NOT_CLAUDE: "kept" })
  })

  it("adds what the call needs after the filter, so that a variable of the command is never taken out", () => {
    expect(childEnv(parent, { PBGO_GUARD_POLICY: "/p.json", CLAUDE_X: "mine" })).toMatchObject({ PBGO_GUARD_POLICY: "/p.json", CLAUDE_X: "mine" })
  })

  it("takes out the variables that give a call a power of this command's, whoever set them: a shell that has PBGO_PUBLISH_OK set never publishes by it", () => {
    const shell = { PATH: "/usr/bin", PBGO_PUBLISH_OK: "1", PBGO_GUARD_POLICY: "/elsewhere.json", PBGO_GUARD_LOG: "/elsewhere.log", PBGO_ASSETS_DIR: "/a" }
    expect(childEnv(shell)).toEqual({ PATH: "/usr/bin", PBGO_ASSETS_DIR: "/a" })
    expect(childEnv(shell, { PBGO_PUBLISH_OK: "0", PBGO_GUARD_POLICY: "/mine.json" })).toEqual({ PATH: "/usr/bin", PBGO_ASSETS_DIR: "/a", PBGO_PUBLISH_OK: "0", PBGO_GUARD_POLICY: "/mine.json" })
  })

  it("names what it left out, and which of those carry a key or another source of credentials", () => {
    expect(strippedNames(parent).sort()).toEqual(["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDECODE", "CLAUDE_AGENT_SDK_VERSION", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_USE_BEDROCK"].sort())
    expect(strippedCredentials(parent).sort()).toEqual(["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_USE_BEDROCK"].sort())
  })
})

describe("the arguments of a call", () => {
  const base = { prompt: "/game-scout Love Letter --out /a/scout.json", name: "add-game: Love Letter", model: "sonnet", budgetUsd: 3, settingsPath: "/a/.pipeline/scout.settings.json", tools: ["ToolSearch", "WebSearch", "WebFetch"] }
  const value = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

  it("is headless, streams, never asks, and leaves the owner's settings out", () => {
    const args = callArgs({ ...base, session: { id: "u1", resume: false } })
    expect(args.slice(0, 2)).toEqual(["-p", base.prompt])
    expect(value(args, "--output-format")).toBe("stream-json")
    expect(args).toContain("--verbose")
    expect(value(args, "--permission-mode")).toBe("dontAsk")
    // the project's own settings (its skills) and nothing of the owner's, nor the local ones of the checkout: a rule of theirs would widen the policy
    expect(value(args, "--setting-sources")).toBe("project")
    expect(value(args, "--settings")).toBe(base.settingsPath)
    expect(value(args, "--model")).toBe("sonnet")
    expect(value(args, "--max-budget-usd")).toBe("3")
    expect(args).not.toContain("--bare")
  })

  it("makes the session of the game on the first call and resumes it on the others", () => {
    const first = callArgs({ ...base, session: { id: "u1", resume: false } })
    expect(value(first, "--session-id")).toBe("u1")
    expect(value(first, "--name")).toBe("add-game: Love Letter")
    expect(first).not.toContain("--resume")
    const next = callArgs({ ...base, session: { id: "u1", resume: true } })
    expect(value(next, "--resume")).toBe("u1")
    expect(next).not.toContain("--session-id")
  })

  it("leaves no session behind for a bookkeeping call, and asks for its answer as JSON", () => {
    const args = callArgs({ ...base, session: { id: "u1", resume: false }, ephemeral: true, jsonSchema: { type: "object" } })
    expect(args).toContain("--no-session-persistence")
    expect(args).not.toContain("--session-id")
    expect(args).not.toContain("--resume")
    expect(JSON.parse(value(args, "--json-schema") ?? "")).toEqual({ type: "object" })
  })

  it("ends with the allowed tools, so that no later word is taken for one more tool", () => {
    const args = callArgs({ ...base, session: { id: "u1", resume: false } })
    expect(args.slice(args.indexOf("--allowedTools"))).toEqual(["--allowedTools", "ToolSearch", "WebSearch", "WebFetch"])
  })
})

describe("running a call", () => {
  const events: unknown[] = []
  const script = (body: string) => ["-e", body]
  const run = (body: string, onEvent: (event: unknown) => void | "stop" = (event) => void events.push(event)) =>
    runClaude({ bin: process.execPath, args: script(body), cwd: tmpdir(), env: { PATH: process.env.PATH }, onEvent })

  it("reads the events line by line, even when a line comes in two pieces", async () => {
    events.length = 0
    const outcome = await run(`process.stdout.write('{"type":"a"}\\n{"type":"b",'); setTimeout(() => process.stdout.write('"n":1}\\n{"type":"c"}\\n'), 30)`)
    expect(events).toEqual([{ type: "a" }, { type: "b", n: 1 }, { type: "c" }])
    expect(outcome).toMatchObject({ code: 0, interrupted: false, stopped: false, spawnError: null })
    expect(outcome.raw).toContain('"type":"c"')
  })

  it("keeps what is not JSON with the errors, never in the events", async () => {
    events.length = 0
    const outcome = await run(`console.log('a warning, not JSON'); console.log('{"type":"a"}'); console.error('and this')`)
    expect(events).toEqual([{ type: "a" }])
    expect(outcome.stderr).toContain("a warning, not JSON")
    expect(outcome.stderr).toContain("and this")
  })

  it("has stdin closed: a call that reads it ends at once", async () => {
    events.length = 0
    const outcome = await run(`process.stdin.on("data", () => {}); process.stdin.on("end", () => console.log('{"type":"closed"}'))`)
    expect(events).toEqual([{ type: "closed" }])
    expect(outcome.code).toBe(0)
  })

  it("ends a call that an event asked to stop", async () => {
    const outcome = await run(`console.log('{"type":"init"}'); setInterval(() => {}, 1000)`, () => "stop")
    expect(outcome.stopped).toBe(true)
    expect(outcome.interrupted).toBe(false)
  })

  it("says when claude cannot be started", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pipeline-claude-"))
    try {
      const outcome = await runClaude({ bin: join(dir, "no-such-claude"), args: [], cwd: dir, env: {}, onEvent: () => {} })
      expect(outcome.spawnError).toContain("command not found")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

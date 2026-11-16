// `--check`: is this machine ready for the pipeline. The preflight looks at what the CLI says; this goes one step further with one short call (about a cent, a
// small model) that proves, from a headless run, what the pipeline relies on: the login is the one in use (`apiKeySource: none`), the guard lets a write inside
// the game's folder through and refuses one in the repo, a command it does not know and a file of the repo that git ignores, a skill's file can be read, and
// Composio's tools are there.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { callArgs, childEnv } from "./claude.ts"
import { linearTuning } from "./config.ts"
import { EXIT, type Deps, type Io } from "./pipeline.ts"
import { hookSettings, type Policy } from "./policy.ts"
import { preflight } from "./preflight.ts"
import { palette } from "./render.ts"
import { RunTracker } from "./stream.ts"

export async function runCheck(io: Io, deps: Deps): Promise<number> {
  const pal = palette(deps.color)
  const check = await preflight({ exec: deps.exec, env: deps.env, repoRoot: deps.repoRoot, claudeBin: deps.claudeBin, needsComposio: true })
  io.out(`claude ${check.claudeVersion ?? "not found"}${check.subscription ? ` · claude.ai (${check.subscription})` : ""}`)
  for (const note of check.notes) io.out(pal.dim(`  ${note}`))
  if (check.problems.length > 0) {
    for (const problem of check.problems) io.err(pal.red(`✗ ${problem}`))
    return EXIT.failed
  }
  io.out(`${pal.green("✓")} login, skills and Composio are there. One short call now, to try the guard from a headless run…`)

  const dir = mkdtempSync(join(tmpdir(), "add-game-check-"))
  const refused = join(deps.repoRoot, "PBGO_CHECK_REFUSED.txt")
  // a file of the project that a skill reads, and a file that git ignores (it needs no existing file: the guard asks git about the path)
  const skillFile = join(deps.repoRoot, ".claude", "skills", "game-scout", "SKILL.md")
  const ignoredFile = join(deps.repoRoot, "node_modules", ".modules.yaml")
  try {
    const allowed = join(dir, "allowed.txt")
    rmSync(refused, { force: true })
    const policy: Policy = { repoRoot: deps.repoRoot, workDir: dir, writeFiles: [allowed], readFiles: [], bash: [], composio: null }
    const work = join(dir, ".pipeline")
    mkdirSync(work, { recursive: true })
    const policyPath = join(work, "check.policy.json")
    const settingsPath = join(work, "check.settings.json")
    writeFileSync(policyPath, JSON.stringify(policy))
    writeFileSync(settingsPath, JSON.stringify(hookSettings({ nodePath: process.execPath, guardFile: join(deps.repoRoot, "packages", "pipeline", "hook", "guard.ts") })))
    const tuning = linearTuning(deps.env)
    const search = `${check.composioPrefix}COMPOSIO_SEARCH_TOOLS`
    const args = callArgs({
      prompt: `This is a self-test of a command-line tool. Do these six things in order, one tool call each, never retry a refused call and never try another way, then reply with six lines. 1) Use the Write tool to create ${allowed} containing OK. 2) Use the Write tool to create ${refused} containing NO. 3) Use the Bash tool to run exactly: curl --version 4) Use the Read tool to read the first line of ${skillFile} 5) Use the Read tool to read the first line of ${ignoredFile} 6) Use the ToolSearch tool with the query select:${search} and say whether it found that tool.`,
      session: { id: deps.uuid(), resume: false },
      name: "add-game: check",
      model: tuning.model,
      budgetUsd: tuning.budgetUsd,
      settingsPath,
      tools: ["ToolSearch", search],
      ephemeral: true,
    })
    const tracker = new RunTracker()
    const outcome = await deps.run({
      bin: deps.claudeBin,
      args,
      cwd: deps.repoRoot,
      env: childEnv(deps.env, { PBGO_GUARD_POLICY: policyPath, PBGO_GUARD_LOG: join(work, "guard.log"), PBGO_PUBLISH_OK: "0" }),
      onEvent: (event) => {
        tracker.feed(event)
      },
    })
    const result = tracker.result
    const lines: [boolean, string][] = []
    if (outcome.spawnError || !result || !result.ok) {
      io.err(pal.red(`✗ the call failed: ${outcome.spawnError ?? result?.failure ?? "no result"}`))
      return EXIT.failed
    }
    lines.push([tracker.apiKeySource === "none", `the call runs on your login (apiKeySource: ${tracker.apiKeySource ?? "unknown"})`])
    lines.push([existsSync(allowed), "the guard lets a write inside the game's folder through"])
    lines.push([!existsSync(refused) && tracker.denials.some((denial) => denial.tool === "Write" && denial.target.includes("PBGO_CHECK_REFUSED")), "the guard refuses a write in the repo"])
    lines.push([tracker.denials.some((denial) => denial.tool === "Bash"), "a command that is on no list is refused"])
    lines.push([tracker.calls.some((call) => call.name === "Read" && call.target === skillFile) && !tracker.denials.some((denial) => denial.target === skillFile), "a file of the project (a skill's) can be read"])
    lines.push([tracker.denials.some((denial) => denial.tool === "Read" && denial.target === ignoredFile), "a file of the repo that git ignores is refused"])
    lines.push([tracker.toolReferences.includes(search), "Composio's tools are found by a headless run"])
    for (const [ok, text] of lines) io.out(`${ok ? pal.green("✓") : pal.red("✗")} ${text}`)
    return lines.every(([ok]) => ok) ? EXIT.ok : EXIT.failed
  } finally {
    rmSync(refused, { force: true })
    rmSync(dir, { recursive: true, force: true })
  }
}

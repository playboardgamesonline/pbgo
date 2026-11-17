import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { briefOf } from "./brief.ts"
import { REPO_ROOT } from "./config.ts"
import { USAGE, VERBS } from "./flow.ts"
import { gameOf, STEPS } from "./steps.ts"

// The skill `/add-game` is a text that an agent follows, and `pnpm game-flow` is what it follows it with: this keeps the one to the other, the way the other skills' tests keep them to the code they name.
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8")
const SKILL = read(".claude/skills/add-game/SKILL.md")
const README = read(".claude/skills/README.md")
const root = JSON.parse(read("package.json")) as { scripts: Record<string, string> }

/** The `pnpm game-flow …` commands of the skill, each as the words after `game-flow`. */
const commands = [...SKILL.matchAll(/`pnpm game-flow ([^`]+)`/g)].map((found) => found[1] ?? "")

describe("the skill /add-game", () => {
  it("is a skill of the GAME agent that names its ten steps", () => {
    expect(SKILL).toMatch(/^---\nname: add-game\ndescription: "\[GAME agent\] /)
    const description = /description: "([^"]+)"/.exec(SKILL)?.[1] ?? ""
    for (const step of STEPS) expect(description, step.skill).toContain(step.skill)
  })

  it("has a table of the steps that is the steps of the command, in order, with the skill of each", () => {
    STEPS.forEach((step, at) => {
      expect(SKILL, step.id).toContain(`| ${at + 1} | ${step.title} | \`${step.skill}\` |`)
      expect(existsSync(join(REPO_ROOT, step.skillFile)), step.skillFile).toBe(true)
      expect(README, step.skill).toContain(`- \`${step.skill}\` —`)
    })
  })

  it("names every verb of the command, and only verbs it has", () => {
    const used = new Set(commands.map((command) => command.split(/\s+/)[0] ?? ""))
    for (const verb of VERBS) expect(used, verb).toContain(verb)
    for (const verb of used) expect(VERBS as readonly string[], verb).toContain(verb)
  })

  it("names only options that the command has", () => {
    const options = new Set(commands.flatMap((command) => [...command.matchAll(/--[a-z-]+/g)].map((found) => found[0])))
    expect(options.size).toBeGreaterThan(0)
    for (const option of options) expect(USAGE, option).toContain(option)
  })

  it("asks of a sub-agent what its brief tells it to give: the three words of its status, and the same report", () => {
    const brief = briefOf({ step: STEPS[0] ?? (() => { throw new Error("no step") })(), game: gameOf("/assets", "Love Letter", "love-letter"), scratch: "/scratch", reportPath: "/scratch/r.md", has: { scout: false, rulesPdf: false }, round: 1 })
    expect(brief).toContain("STATUS: done | questions | blocked")
    for (const word of ["done", "questions", "blocked"]) expect(SKILL, word).toContain(`\`${word}\``)
    for (const tool of ["Agent tool", "subagent_type", "SendMessage", "haiku"]) expect(SKILL, tool).toContain(tool)
  })

  it("is run through a script of the root that exists, and no longer through the terminal command that it replaced", () => {
    expect(root.scripts["game-flow"]).toBe("node --disable-warning=ExperimentalWarning packages/pipeline/bin/game-flow.ts")
    expect(existsSync(join(REPO_ROOT, "packages/pipeline/bin/game-flow.ts"))).toBe(true)
    expect(root.scripts["add-game"]).toBeUndefined()
    expect(existsSync(join(REPO_ROOT, "scripts", "add-game.sh"))).toBe(false)
    for (const gone of ["pnpm add-" + "game", "claude" + " -p"]) expect(SKILL, gone).not.toContain(gone)
  })

  it("is listed with the other skills, as the one that runs them", () => {
    expect(README).toContain("- `add-game` —")
  })
})

describe("the terminal pipeline that it replaced", () => {
  // a ratchet: the command, its policy hook and its session launcher are gone, and nothing tracked by git says to run them
  it("is named by no file of the repo", () => {
    const patterns = ["pnpm add-" + "game", "scripts/add-" + "game.sh", "claude" + " -p", "pipeline-" + "policy"]
    const found = spawnSync("git", ["grep", "-n", "-I", "--untracked", ...patterns.flatMap((pattern) => ["-e", pattern]), "--", ".", ":(exclude)pnpm-lock.yaml"], { cwd: REPO_ROOT, encoding: "utf8" })
    // git grep exits 1 when it finds nothing
    expect(found.stdout, found.stdout).toBe("")
  })
})

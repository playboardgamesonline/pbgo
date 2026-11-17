import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// `scripts/check-game.mjs` reads files only and is run by Node itself: this runs it as `pnpm check:game` does, on the template (always there, and a game that has not got far: its engine is the demo, its
// flags are off), to check the two kinds of gate. `--stage` is every check up to a stage; `--only` is one stage alone, for a step that is done out of order (`pnpm add-game` gates the Studio's forms by it).
const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const check = (...args: string[]) => {
  const run = spawnSync(process.execPath, ["scripts/check-game.mjs", "template", ...args], { cwd: REPO, encoding: "utf8", timeout: 30_000 })
  return { status: run.status, out: run.stdout, err: run.stderr }
}

describe("pnpm check:game --only", () => {
  it("is a gate for one stage: exit 0 when the checks of that stage pass, and the other stages are said not to count", () => {
    const run = check("--only", "scaffold")
    expect(run.status).toBe(0)
    expect(run.out).toContain("scaffold\n")
    expect(run.out).toMatch(/^engine \(not this gate\)$/m)
    expect(run.out).toMatch(/^live \(not this gate\)$/m)
    expect(run.out).toContain("The stage scaffold passes.")
  })

  it("exits 1 when a check of that stage fails, and says how many", () => {
    const run = check("--only", "engine")
    expect(run.status).toBe(1)
    expect(run.out).toMatch(/Not ready: \d+ to fix in the stage engine\./)
    expect(run.out).toContain("still the template's demo engine")
  })

  it("does not count the stages before it, which is what --stage does: the content of a game whose engine is not written passes its own gate", () => {
    expect(check("--only", "content").status).toBe(0)
    expect(check("--stage", "content").status).toBe(1)
    expect(check("--stage", "content").out).toContain("Not ready for after content")
  })

  it("is not a gate without a flag, and refuses both flags together and a stage that does not exist", () => {
    expect(check().status).toBe(0)
    const both = check("--stage", "engine", "--only", "engine")
    expect(both.status).toBe(2)
    expect(both.err).toContain("exclude each other")
    for (const args of [["--only", "nope"], ["--only"], ["--stage", "nope"]]) {
      const run = check(...args)
      expect(run.status, args.join(" ")).toBe(2)
      expect(run.err, args.join(" ")).toContain("The stages are scaffold, engine, binding, board, content, live")
    }
  })

  it("finds the slug whichever way the flags come", () => {
    const run = spawnSync(process.execPath, ["scripts/check-game.mjs", "--only", "scaffold", "template"], { cwd: REPO, encoding: "utf8", timeout: 30_000 })
    expect(run.status).toBe(0)
    expect(run.stdout).toContain("template has got as far as")
  })
})

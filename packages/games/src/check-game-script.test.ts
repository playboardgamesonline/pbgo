import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// `scripts/check-game.mjs` reads files only and is run by Node itself: this runs it as `pnpm check:game` does, on the template (always there, and a game that has not got far: its engine is the demo, its
// flags are off), to check the two kinds of gate. `--stage` is every check up to a stage; `--only` is one stage alone, for a step that is done out of order (`/add-game` gates the Studio's forms by it).
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

describe("pnpm check:game for a game that is not in the repo yet", () => {
  const run = (assets: string, slug: string) => spawnSync(process.execPath, ["scripts/check-game.mjs", slug], { cwd: REPO, encoding: "utf8", timeout: 30_000, env: { ...process.env, PBGO_ASSETS_DIR: assets } })

  it("says where the game is in the flow, in its own folder or in the folder of its line, and how to start it when it is in neither", () => {
    const assets = mkdtempSync(join(tmpdir(), "check-game-flow-"))
    try {
      mkdirSync(join(assets, "the-line", "zzz-game-in-a-line"), { recursive: true })
      writeFileSync(join(assets, "the-line", "zzz-game-in-a-line", "pipeline.json"), JSON.stringify({ name: "Zzz Game In A Line", steps: { scout: { status: "gate" } } }))
      mkdirSync(join(assets, "zzz-flat-game"))
      writeFileSync(join(assets, "zzz-flat-game", "pipeline.json"), JSON.stringify({ name: "Zzz Flat Game", steps: { scout: { status: "validated" } } }))
      const nested = run(assets, "zzz-game-in-a-line")
      expect(nested.status).toBe(2)
      expect(nested.stderr).toContain('It is in the flow (scout gate): `/add-game "Zzz Game In A Line"` goes on.')
      expect(run(assets, "zzz-flat-game").stderr).toContain("It is in the flow (scout validated)")
      const nowhere = run(assets, "zzz-nowhere")
      expect(nowhere.status).toBe(2)
      expect(nowhere.stderr).toContain('`/add-game "<Game Name>"` starts one')
    } finally {
      rmSync(assets, { recursive: true, force: true })
    }
  })
})

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { ExecResult } from "./exec.ts"
import { runFlow, USAGE, type FlowDeps, type RulebookFetch } from "./flow.ts"
import { readState, stepOf, type PipelineState } from "./state.ts"
import { STEPS } from "./steps.ts"

const NOW = new Date("2026-11-17T10:00:00")
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))
const SCOUT = {
  version: 1,
  scoutedAt: "2026-11-15",
  name: "Sample Game",
  slug: "sample-game",
  type: "base-game",
  baseGame: null,
  suggestion: null,
  edition: {
    publisher: "Sample Publisher",
    year: 2024,
    label: "Second edition",
    bggVersionId: 654321,
    rules: { language: "en", url: "https://example.com/rules.pdf", version: "v2.1", date: "2024-03" },
    confidence: "high",
  },
  bgg: { id: 123456, type: "boardgame", year: 2019, rank: 812, rating: 7.4, ratings: 18200, weight: 1.86, weights: 940 },
  facts: { playersMin: 2, playersMax: 6, duration: 30, minAge: 8, complexity: 1.86 },
  existing: { catalog: "none" },
  notes: [],
  sources: [{ label: "Publisher page", url: "https://example.com/sample-game" }],
}
const OK: ExecResult = { code: 0, stdout: "ok\n", stderr: "" }

type World = {
  assets: string
  repo: string
  scratch: string
  calls: { file: string; args: string[] }[]
  exec: (file: string, args: string[]) => ExecResult
  fetched: { url: string; dest: string }[]
  fetch: RulebookFetch
  missing: string[] | null
  since: (string | null)[]
  delay: number
  run: (...argv: string[]) => Promise<{ code: number; out: string; err: string }>
}

let w: World
const roots: string[] = []

beforeEach(() => {
  const assets = mkdtempSync(join(tmpdir(), "flow-assets-"))
  const repo = mkdtempSync(join(tmpdir(), "flow-repo-"))
  const scratch = mkdtempSync(join(tmpdir(), "flow-scratch-"))
  roots.push(assets, repo, scratch)
  mkdirSync(join(repo, "games"), { recursive: true })
  const out: string[] = []
  const err: string[] = []
  const world: World = {
    assets,
    repo,
    scratch,
    calls: [],
    exec: () => OK,
    fetched: [],
    fetch: { ok: true, bytes: 2048 },
    missing: [],
    since: [],
    delay: 0,
    run: async (...argv) => {
      out.length = 0
      err.length = 0
      const deps: FlowDeps = {
        assets,
        repoRoot: repo,
        gamesDocs: join(repo, "docs", "games"),
        exec: async (file, args) => {
          world.calls.push({ file, args })
          if (world.delay > 0) await new Promise((done) => setTimeout(done, world.delay))
          return world.exec(file, args)
        },
        fetchRulebook: async (url, dest) => {
          world.fetched.push({ url, dest })
          if (world.fetch.ok) writeFileSync(dest, "%PDF-")
          return world.fetch
        },
        missingPublished: async (_ids, since) => {
          world.since.push(since)
          return world.missing
        },
        now: () => NOW,
        out: (text) => out.push(text),
        err: (text) => err.push(text),
      }
      const code = await runFlow(argv, deps)
      return { code, out: out.join("\n"), err: err.join("\n") }
    },
  }
  w = world
})

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const stateOf = (slug: string): PipelineState => {
  const state = readState(join(w.assets, slug))
  if (!state) throw new Error(`no state for ${slug}`)
  return state
}
const report = (name: string, text: string): string => {
  const file = join(w.scratch, name)
  writeFileSync(file, text)
  return file
}
const writeScout = (slug: string, scout: object = SCOUT) => writeFileSync(join(w.assets, slug, "scout.json"), JSON.stringify(scout))
const makeGameFolder = (slug: string) => mkdirSync(join(w.repo, "games", slug), { recursive: true })

describe("start and status", () => {
  it("makes the state of a game with every step not started, and says what is next", async () => {
    const result = await w.run("start", "The Crew")
    expect(result.code).toBe(0)
    const state = stateOf("the-crew")
    expect(state.name).toBe("The Crew")
    expect(STEPS.every((step) => stepOf(state, step.id).status === "pending")).toBe(true)
    expect(result.out).toContain("0/10 validated")
    expect(result.out).toContain("Next [begin]: pnpm game-flow begin the-crew scout")
    expect(result.out).toContain("Linear has nothing for it yet")
  })

  it("finds a game that is in the flow already, by its name or its slug", async () => {
    await w.run("start", "The Crew")
    const again = await w.run("start", "the crew")
    expect(again.code).toBe(0)
    expect(again.out).toContain("The Crew is in the flow already")
    expect((await w.run("status", "the-crew")).out).toContain("The Crew (the-crew)")
    expect((await w.run("status", "The Crew")).code).toBe(0)
  })

  it("does not take a game that has a folder in the repo unless it is told how far it has got", async () => {
    makeGameFolder("love-letter")
    const refused = await w.run("start", "Love Letter")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("--adopt-through")
    expect(existsSync(join(w.assets, "love-letter"))).toBe(false)
    const adopted = await w.run("start", "Love Letter", "--adopt-through", "game-new")
    expect(adopted.code).toBe(0)
    const state = stateOf("love-letter")
    expect(STEPS.map((step) => stepOf(state, step.id).status)).toEqual(["validated", "validated", "validated", "validated", "validated", "pending", "pending", "pending", "pending", "pending"])
    expect(adopted.out).toContain("5/10 validated")
    expect(adopted.out).toContain("Next [begin]: pnpm game-flow begin love-letter game-sanity-create")
  })

  it("lists the games that are in the flow, and says so when there are none", async () => {
    expect((await w.run("status")).out).toContain("No game is in the flow")
    await w.run("start", "The Crew")
    const listed = await w.run("status")
    expect(listed.out).toContain("the-crew  The Crew: 0/10 validated")
  })

  it("says it all as JSON, for a program that asks", async () => {
    await w.run("start", "The Crew")
    const result = await w.run("status", "the-crew", "--json")
    const data = JSON.parse(result.out) as { slug: string; steps: { id: string; status: string; skill: string }[]; next: { step: string; action: string } }
    expect(data.slug).toBe("the-crew")
    expect(data.steps.map((step) => step.id)).toEqual(STEPS.map((step) => step.id))
    expect(data.steps[0]).toMatchObject({ status: "pending", skill: "game-scout" })
    expect(data.next).toMatchObject({ step: "scout", action: "begin" })
  })

  it("reads the state the terminal command left for The Crew: the scout at its gate, its check failed", async () => {
    mkdirSync(join(w.assets, "the-crew"), { recursive: true })
    writeFileSync(
      join(w.assets, "the-crew", "pipeline.json"),
      JSON.stringify({
        version: 1,
        name: "The Crew",
        aliases: ["The Crew"],
        slug: "the-crew",
        createdAt: "2026-11-17T08:10:06.445Z",
        updatedAt: "2026-11-17T08:11:21.295Z",
        session: { id: "a2ab886c-2360-466f-90e8-888d25d5f020", started: true },
        linear: { parent: { id: "", identifier: "", url: "", title: "The Crew: add the game", applied: "In Progress", commented: false }, labelId: '""', error: null },
        steps: { scout: { status: "gate", gate: 0, rounds: 1, costUsd: 0.43, startedAt: "2026-11-17T08:10:42.539Z", validatedAt: null, report: "BGG_API_TOKEN is not set", links: [], check: { ok: false, lines: ["no scout file was written"] }, failure: null, issue: null } },
      }),
    )
    const result = await w.run("status", "the-crew")
    expect(result.code).toBe(0)
    expect(result.out).toContain("1 …")
    expect(result.out).toContain("at its gate (validate) · check failed")
    expect(result.out).toContain("linear  not made yet")
    expect(result.out).toContain("Next [wait-owner]: scout waits for the owner at its gate")
    // a change the owner asks for opens a new round at the same step
    const change = await w.run("begin", "the-crew", "scout", "--change", "--scratch", w.scratch)
    expect(change.code).toBe(0)
    expect(stepOf(stateOf("the-crew"), "scout")).toMatchObject({ status: "running", rounds: 2, gate: 0 })
    // and Linear has nothing for it, whatever the old file said
    expect((await w.run("linear", "the-crew", "--scratch", w.scratch)).out).toContain("11 issues to make")
  })

  it("shows one step in full with --step: its report, its check, its links", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    writeScout("the-crew", { ...SCOUT, name: "The Crew", slug: "the-crew" })
    const file = report("scout-report.md", "STATUS: done\nSUMMARY: the Quest for Planet Nine\nLINKS: https://example.com/the-crew")
    await w.run("gate", "the-crew", "scout", "--report", file)
    const shown = await w.run("status", "the-crew", "--step", "scout")
    expect(shown.out).toContain("━━━ Scout · The Crew · round 1 ━━━")
    expect(shown.out).toContain("the Quest for Planet Nine")
    expect(shown.out).toContain("https://example.com/the-crew")
    expect(shown.out).toContain("✓ ok")
  })
})

describe("begin", () => {
  it("writes the brief of the sub-agent and the place of its report, and marks the step running", async () => {
    await w.run("start", "The Crew")
    const result = await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    expect(result.code).toBe(0)
    expect(result.out).toContain("Scout · step 1 of 10 · round 1 · skill game-scout")
    expect(result.out).toContain(`Read ${join(w.scratch, "brief-the-crew-scout.md")} and follow it.`)
    expect(result.out).toContain(`report  ${join(w.scratch, "report-the-crew-scout-r1.md")}`)
    expect(result.out).toContain("pnpm game-flow gate the-crew scout")
    const brief = readFileSync(join(w.scratch, "brief-the-crew-scout.md"), "utf8")
    expect(brief).toContain("# Scout · step 1 of 10 · The Crew (the-crew)")
    expect(brief).toContain(`Run the skill \`game-scout\` with the Skill tool, with this argument: \`The Crew --out ${join(w.assets, "the-crew", "scout.json")}\``)
    expect(brief).toContain("STATUS: done | questions | blocked")
    expect(stepOf(stateOf("the-crew"), "scout")).toMatchObject({ status: "running", rounds: 1, gate: 0 })
  })

  it("keeps the order of the steps: a step does not begin before the one that comes first is validated", async () => {
    await w.run("start", "The Crew")
    const result = await w.run("begin", "the-crew", "catalog-entry", "--scratch", w.scratch)
    expect(result.code).toBe(1)
    expect(result.err).toContain("scout is not validated yet")
    expect(stepOf(stateOf("the-crew"), "catalog-entry").status).toBe("pending")
  })

  it("opens a new round with a fresh brief for a step whose sub-agent is gone, and says it is the second", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    const again = await w.run("begin", "the-crew", "scout", "--scratch", w.scratch, "--again")
    expect(again.code).toBe(0)
    expect(again.out).toContain("round 2")
    expect(readFileSync(join(w.scratch, "brief-the-crew-scout.md"), "utf8")).toContain("This is round 2 of the step")
    // each round has a report file of its own: the first is never overwritten
    expect(stepOf(stateOf("the-crew"), "scout")).toMatchObject({ rounds: 2, reportPath: join(w.scratch, "report-the-crew-scout-r2.md") })
  })

  it("does not reopen a step that waits at its gate unless the owner asked for a change", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    writeScout("the-crew", { ...SCOUT, name: "The Crew", slug: "the-crew" })
    await w.run("gate", "the-crew", "scout", "--report", report("r.md", "STATUS: done"))
    const refused = await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("waits at its gate")
    const change = await w.run("begin", "the-crew", "scout", "--change", "--scratch", w.scratch)
    expect(change.code).toBe(0)
    expect(change.out).toContain("A round for the change the owner asked for")
    expect(change.out).toContain("for a fresh sub-agent when that one is gone")
    expect(readFileSync(join(w.scratch, "brief-the-crew-scout.md"), "utf8")).toContain("This is round 2 of the step")
    expect(stepOf(stateOf("the-crew"), "scout")).toMatchObject({ status: "running", rounds: 2, check: null })
  })

  it("waits for the game's folder in the checkout for a step that works in it, and has nothing to make when the game folder is there", async () => {
    await w.run("start", "The Crew", "--adopt-through", "game-new")
    const waiting = await w.run("begin", "the-crew", "game-sanity-create", "--scratch", w.scratch)
    expect(waiting.code).toBe(1)
    expect(waiting.err).toContain("games/the-crew is not in this checkout")
    expect((await w.run("status", "the-crew")).out).toContain("games/the-crew is not in this checkout, and studio forms works in it")
    makeGameFolder("the-crew")
    expect((await w.run("begin", "the-crew", "game-sanity-create", "--scratch", w.scratch)).code).toBe(0)
    // the game folder, for a game that already has one
    await w.run("start", "Skyjo", "--adopt-through", "platform-assets")
    makeGameFolder("skyjo")
    const nothing = await w.run("begin", "skyjo", "game-new", "--scratch", w.scratch)
    expect(nothing.code).toBe(1)
    expect(nothing.err).toContain("has nothing to make")
    expect((await w.run("status", "skyjo")).out).toContain("games/skyjo is already here, so game folder has nothing to make")
  })
})

describe("gate", () => {
  it("records the report, runs the machine's check and shows both: the scout file that was never written fails it", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    const file = report("r.md", "STATUS: done\nSUMMARY: stopped\nLINKS: https://example.com/page")
    const failed = await w.run("gate", "the-crew", "scout", "--report", file)
    expect(failed.code).toBe(1)
    expect(failed.out).toContain("✗ no scout file was written")
    expect(failed.out).toContain("https://example.com/page")
    expect(failed.out).toContain("pnpm game-flow validate the-crew scout")
    expect(stepOf(stateOf("the-crew"), "scout")).toMatchObject({ status: "gate", check: { ok: false } })
    // the scout file is there and passes
    writeScout("the-crew", { ...SCOUT, name: "The Crew", slug: "the-crew" })
    const ok = await w.run("gate", "the-crew", "scout", "--report", file)
    expect(ok.code).toBe(0)
    expect(ok.out).toContain("✓ ok")
    expect(w.calls.at(-1)).toEqual({ file: "pnpm", args: ["check:scout", join(w.assets, "the-crew", "scout.json"), "--online"] })
  })

  it("is for a finished step: questions go to the owner, and a blocked step is told as failed", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    const asking = await w.run("gate", "the-crew", "scout", "--report", report("q.md", "STATUS: questions\nQUESTIONS: 1. Which edition?"))
    expect(asking.code).toBe(1)
    expect(asking.err).toContain("asked questions")
    const blocked = await w.run("gate", "the-crew", "scout", "--report", report("b.md", "STATUS: blocked\nSUMMARY: no BGG token"))
    expect(blocked.code).toBe(1)
    expect(blocked.err).toContain("pnpm game-flow fail the-crew scout")
    expect(stepOf(stateOf("the-crew"), "scout").status).toBe("running")
  })

  it("refuses a report that is not there, and takes no escape sequence of what the agent wrote", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    expect((await w.run("gate", "the-crew", "scout", "--report", join(w.scratch, "nope.md"))).err).toContain("no report at")
    const ESC = String.fromCharCode(27)
    await w.run("gate", "the-crew", "scout", "--report", report("e.md", `STATUS: done\n${ESC}[2JSUMMARY: clean`))
    expect(stepOf(stateOf("the-crew"), "scout").report).toBe("STATUS: done\nSUMMARY: clean")
  })

  it("checks the game folder with no sub-agent and no report, as pnpm check:game says it", async () => {
    await w.run("start", "Skyjo", "--adopt-through", "platform-assets")
    makeGameFolder("skyjo")
    w.exec = () => ({ code: 0, stdout: "scaffold\n  ✓ registered\nskyjo has got as far as: scaffold.\n", stderr: "" })
    const result = await w.run("gate", "skyjo", "game-new")
    expect(result.code).toBe(0)
    expect(result.out).toContain("(no report)")
    expect(w.calls.at(-1)).toEqual({ file: process.execPath, args: [join(w.repo, "scripts", "check-game.mjs"), "skyjo", "--stage", "scaffold"] })
    expect((await w.run("validate", "skyjo", "game-new")).code).toBe(0)
    expect(stepOf(stateOf("skyjo"), "game-new").status).toBe("validated")
  })

  it("gates the forms by their stage alone, and the engine, the board and going live by every stage up to theirs", async () => {
    await w.run("start", "Skyjo", "--adopt-through", "game-new")
    makeGameFolder("skyjo")
    await w.run("begin", "skyjo", "game-sanity-create", "--scratch", w.scratch)
    await w.run("gate", "skyjo", "game-sanity-create")
    expect(w.calls.at(-1)?.args.slice(1)).toEqual(["skyjo", "--only", "content"])
    await w.run("validate", "skyjo", "game-sanity-create")
    await w.run("start", "Coup", "--adopt-through", "game-assets")
    makeGameFolder("coup")
    await w.run("begin", "coup", "engine-rules", "--scratch", w.scratch)
    await w.run("gate", "coup", "engine-rules")
    expect(w.calls.at(-1)?.args.slice(1)).toEqual(["coup", "--stage", "engine"])
  })

  it("runs the seed on the art folder for the game's art, and the public API for the pictures", async () => {
    await w.run("start", "Skyjo", "--adopt-through", "game-sanity-create")
    makeGameFolder("skyjo")
    w.exec = () => ({ code: 0, stdout: "Seeding\nArt (2 of 5 slots have a file)\n  cover: ok\n  logo: none\n\nDone.\n", stderr: "" })
    await w.run("begin", "skyjo", "game-assets", "--scratch", w.scratch)
    const art = await w.run("gate", "skyjo", "game-assets")
    expect(art.code).toBe(0)
    expect(art.out).toContain("Art (2 of 5 slots have a file)")
    expect(art.out).not.toContain("Done.")
    expect(w.calls.at(-1)).toEqual({ file: "pnpm", args: ["-C", "games/skyjo", "content:seed", "--dry-run", "--art-dir", join(w.assets, "skyjo")] })
    await w.run("start", "Coup", "--adopt-through", "rules-spec")
    writeScout("coup")
    await w.run("begin", "coup", "platform-assets", "--scratch", w.scratch)
    await w.run("gate", "coup", "platform-assets")
    expect(w.calls.at(-1)).toEqual({ file: "pnpm", args: ["catalog:pictures", "coup"] })
  })
})

describe("validate", () => {
  it("refuses a step whose check does not pass, and says how to ask for a change", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    writeScout("the-crew", { ...SCOUT, name: "The Crew", slug: "the-crew" })
    await w.run("gate", "the-crew", "scout", "--report", report("r.md", "STATUS: done"))
    w.exec = () => ({ code: 1, stdout: "fail  scout.json\n  - the complexity is missing\n", stderr: "" })
    const refused = await w.run("validate", "the-crew", "scout")
    expect(refused.code).toBe(1)
    expect(refused.out).toContain("✗ fail  scout.json")
    expect(refused.err).toContain("pnpm game-flow begin the-crew scout --change")
    expect(stepOf(stateOf("the-crew"), "scout").status).toBe("gate")
  })

  it("moves the game's folder to the slug the scout settled, and keeps the name it was asked for as an alias", async () => {
    await w.run("start", "Sample")
    await w.run("begin", "sample", "scout", "--scratch", w.scratch)
    writeScout("sample")
    writeFileSync(join(w.assets, "sample", "notes.txt"), "kept")
    await w.run("gate", "sample", "scout", "--report", report("r.md", "STATUS: done"))
    const result = await w.run("validate", "sample", "scout")
    expect(result.code).toBe(0)
    expect(result.out).toContain("✓ scout validated")
    expect(result.out).toContain('the game is "Sample Game", slug sample-game')
    expect(existsSync(join(w.assets, "sample"))).toBe(false)
    expect(readFileSync(join(w.assets, "sample-game", "notes.txt"), "utf8")).toBe("kept")
    const state = stateOf("sample-game")
    expect(state).toMatchObject({ name: "Sample Game", slug: "sample-game" })
    expect(state.aliases).toEqual(["Sample", "Sample Game", "sample"])
    expect(stepOf(state, "scout")).toMatchObject({ status: "validated", validatedAt: NOW.toISOString() })
    expect(result.out).toContain("Next [begin]: pnpm game-flow begin sample-game catalog-entry")
    expect((await w.run("status", "Sample")).out).toContain("Sample Game (sample-game)")
  })

  it("does not move a game to a slug that has a folder in the repo", async () => {
    await w.run("start", "Sample")
    await w.run("begin", "sample", "scout", "--scratch", w.scratch)
    writeScout("sample")
    await w.run("gate", "sample", "scout", "--report", report("r.md", "STATUS: done"))
    makeGameFolder("sample-game")
    const refused = await w.run("validate", "sample", "scout")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("games/sample-game exists already")
    expect(existsSync(join(w.assets, "sample", "pipeline.json"))).toBe(true)
  })

  it("stamps the spec as validated, with the day, when the owner validates it", async () => {
    await w.run("start", "The Crew", "--adopt-through", "catalog-entry")
    writeScout("the-crew")
    mkdirSync(join(w.repo, "docs", "games", "the-crew"), { recursive: true })
    writeFileSync(join(w.repo, "docs", "games", "the-crew", "rules.md"), "# The Crew: rules spec\n")
    await w.run("begin", "the-crew", "rules-spec", "--scratch", w.scratch)
    await w.run("gate", "the-crew", "rules-spec", "--report", report("r.md", "STATUS: done"))
    expect(w.calls.at(-1)).toEqual({ file: "pnpm", args: ["check:rules", "the-crew", "--name", "The Crew"] })
    const result = await w.run("validate", "the-crew", "rules-spec")
    expect(result.code).toBe(0)
    expect(w.calls.map((call) => call.args)).toContainEqual(["check:rules", "the-crew", "--name", "The Crew", "--stamp", "--date", "2026-11-17"])
    expect(stepOf(stateOf("the-crew"), "rules-spec").status).toBe("validated")
  })

  it("does not validate a spec that cannot be stamped", async () => {
    await w.run("start", "The Crew", "--adopt-through", "catalog-entry")
    writeScout("the-crew")
    mkdirSync(join(w.repo, "docs", "games", "the-crew"), { recursive: true })
    writeFileSync(join(w.repo, "docs", "games", "the-crew", "rules.md"), "# The Crew: rules spec\n")
    await w.run("begin", "the-crew", "rules-spec", "--scratch", w.scratch)
    await w.run("gate", "the-crew", "rules-spec", "--report", report("r.md", "STATUS: done"))
    w.exec = (_file, args) => (args.includes("--stamp") ? { code: 1, stdout: "fail  docs/games/the-crew/rules.md\n", stderr: "" } : OK)
    const refused = await w.run("validate", "the-crew", "rules-spec")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("cannot be stamped")
    expect(stepOf(stateOf("the-crew"), "rules-spec").status).toBe("gate")
  })

  it("has a second gate for the catalog entry, the word that makes the drafts public, and judges it on what the platform's Sanity shows", async () => {
    await w.run("start", "The Crew", "--adopt-through", "scout")
    writeScout("the-crew")
    await w.run("begin", "the-crew", "catalog-entry", "--scratch", w.scratch)
    const sentence = "STATUS: done\nSUMMARY: two drafts\nLINKS: https://pbgo.sanity.studio/intent/edit/id=game-the-crew;type=game\nValidate publishes 2 documents (game-the-crew, publisher-kosmos)."
    const gated = await w.run("gate", "the-crew", "catalog-entry", "--report", report("r.md", sentence))
    expect(gated.code).toBe(0)
    expect(gated.out).toContain("publish makes 2 documents public (game-the-crew, publisher-kosmos)")
    // no check at the first gate: nothing is published yet
    expect(stepOf(stateOf("the-crew"), "catalog-entry").check).toBeNull()
    const first = await w.run("validate", "the-crew", "catalog-entry")
    expect(first.code).toBe(0)
    expect(first.out).toContain("Gate 2 of 2 (publish)")
    expect(stepOf(stateOf("the-crew"), "catalog-entry")).toMatchObject({ status: "gate", gate: 1, gateAt: NOW.toISOString() })
    // the skill said it published, and the platform's Sanity does not show one of the documents as written since the owner's ok (a game that was in the catalog before counts only if it was written again)
    w.missing = ["publisher-kosmos"]
    const notYet = await w.run("validate", "the-crew", "catalog-entry")
    expect(notYet.code).toBe(1)
    expect(notYet.out).toContain("not published since the owner's ok: publisher-kosmos")
    expect(w.since.at(-1)).toBe(NOW.toISOString())
    expect(stepOf(stateOf("the-crew"), "catalog-entry").status).toBe("gate")
    w.missing = []
    const done = await w.run("check", "the-crew", "catalog-entry")
    expect(done.out).toContain("published: game-the-crew, publisher-kosmos")
    expect((await w.run("validate", "the-crew", "catalog-entry")).code).toBe(0)
    expect(stepOf(stateOf("the-crew"), "catalog-entry").status).toBe("validated")
  })

  it("keeps the report that named the documents when the sub-agent reports again at the second gate, and judges what is published", async () => {
    await w.run("start", "The Crew", "--adopt-through", "scout")
    writeScout("the-crew")
    await w.run("begin", "the-crew", "catalog-entry", "--scratch", w.scratch)
    await w.run("gate", "the-crew", "catalog-entry", "--report", report("r.md", "STATUS: done\nLINKS: https://pbgo.sanity.studio/x\nValidate publishes 1 document (game-the-crew)"))
    await w.run("validate", "the-crew", "catalog-entry")
    const again = await w.run("gate", "the-crew", "catalog-entry", "--report", report("p.md", "STATUS: done\nSUMMARY: published and read back"))
    expect(again.code).toBe(0)
    expect(again.out).toContain("Report of the second gate")
    expect(again.out).toContain("published: game-the-crew")
    const step = stepOf(stateOf("the-crew"), "catalog-entry")
    expect(step.report).toContain("Validate publishes 1 document (game-the-crew)")
    expect(step.gate).toBe(1)
    expect((await w.run("validate", "the-crew", "catalog-entry")).code).toBe(0)
  })

  it("does not go to the second gate when the report does not say which documents it would publish", async () => {
    await w.run("start", "The Crew", "--adopt-through", "scout")
    writeScout("the-crew")
    await w.run("begin", "the-crew", "catalog-entry", "--scratch", w.scratch)
    const gated = await w.run("gate", "the-crew", "catalog-entry", "--report", report("r.md", "STATUS: done\nSUMMARY: the drafts"))
    expect(gated.out).toContain('The report does not say which documents publish would make public')
    const refused = await w.run("validate", "the-crew", "catalog-entry")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("Validate publishes N documents")
    expect(stepOf(stateOf("the-crew"), "catalog-entry").gate).toBe(0)
  })

  it("does not take a Sanity that cannot be read for a publication, and says to try again", async () => {
    await w.run("start", "The Crew", "--adopt-through", "scout")
    writeScout("the-crew")
    await w.run("begin", "the-crew", "catalog-entry", "--scratch", w.scratch)
    await w.run("gate", "the-crew", "catalog-entry", "--report", report("r.md", "STATUS: done\nValidate publishes 1 document (game-the-crew)"))
    await w.run("validate", "the-crew", "catalog-entry")
    w.missing = null
    const unconfirmed = await w.run("check", "the-crew", "catalog-entry")
    expect(unconfirmed.code).toBe(1)
    expect(unconfirmed.out).toContain("could not be read to confirm the publication")
    expect((await w.run("validate", "the-crew", "catalog-entry")).code).toBe(1)
    expect(stepOf(stateOf("the-crew"), "catalog-entry").status).toBe("gate")
  })

  it("says that a step is validated already, and refuses one that has no gate to answer", async () => {
    await w.run("start", "The Crew", "--adopt-through", "scout")
    expect((await w.run("validate", "the-crew", "scout")).out).toContain("scout is validated already")
    const pending = await w.run("validate", "the-crew", "catalog-entry")
    expect(pending.code).toBe(1)
    expect(pending.err).toContain("not started")
  })
})

describe("fail and redo", () => {
  it("records why a step cannot go on, and the next round opens it again", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    const failed = await w.run("fail", "the-crew", "scout", "--reason", "BGG_API_TOKEN is not set")
    expect(failed.code).toBe(0)
    expect(stepOf(stateOf("the-crew"), "scout")).toMatchObject({ status: "failed", failure: "BGG_API_TOKEN is not set" })
    expect((await w.run("status", "the-crew")).out).toContain("failed: BGG_API_TOKEN is not set")
    expect((await w.run("fail", "the-crew", "scout")).code).toBe(2)
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    expect(stepOf(stateOf("the-crew"), "scout")).toMatchObject({ status: "running", failure: null, rounds: 2 })
  })

  it("takes a step and the ones after it back to not started, and keeps the Linear issues", async () => {
    await w.run("start", "The Crew", "--adopt-through", "rules-spec")
    const state = stateOf("the-crew")
    stepOf(state, "catalog-entry").issue = { id: "i", identifier: "GAM-43", url: "u", title: "t", applied: "Done", commented: true }
    writeFileSync(join(w.assets, "the-crew", "pipeline.json"), JSON.stringify(state))
    const result = await w.run("redo", "the-crew", "catalog-entry")
    expect(result.code).toBe(0)
    const after = stateOf("the-crew")
    expect(STEPS.slice(0, 3).map((step) => stepOf(after, step.id).status)).toEqual(["validated", "pending", "pending"])
    expect(stepOf(after, "catalog-entry").issue?.identifier).toBe("GAM-43")
  })
})

describe("rulebook", () => {
  it("fetches the rulebook the scout found next to its file, and never over one that is there", async () => {
    await w.run("start", "Sample")
    writeScout("sample")
    const result = await w.run("rulebook", "sample")
    expect(result.code).toBe(0)
    expect(w.fetched).toEqual([{ url: "https://example.com/rules.pdf", dest: join(w.assets, "sample", "rules.pdf") }])
    expect(result.out).toContain("rules.pdf: 2 KB")
    const again = await w.run("rulebook", "sample")
    expect(again.out).toContain("is there already: it is kept")
    expect(w.fetched).toHaveLength(1)
  })

  it("says where the PDF has to be when it could not be fetched, or when the scout found no address", async () => {
    await w.run("start", "Sample")
    expect((await w.run("rulebook", "sample")).err).toContain("no scout file yet")
    writeScout("sample")
    w.fetch = { ok: false, reason: "www.example.com answered 404" }
    const failed = await w.run("rulebook", "sample")
    expect(failed.code).toBe(1)
    expect(failed.out).toContain("The rulebook was not fetched (www.example.com answered 404)")
    expect(failed.out).toContain("rules.pdf: the owner puts it there")
    writeScout("sample", { ...SCOUT, edition: { ...SCOUT.edition, rules: null } })
    const none = await w.run("rulebook", "sample")
    expect(none.code).toBe(1)
    expect(none.out).toContain("The scout found no address for the rulebook")
  })
})

describe("linear", () => {
  const answer = (parentState = "In Progress") => ({
    labelId: "label-1",
    issues: ["parent", ...STEPS.map((step) => step.id)].map((key, index) => ({ key, id: `id-${key}`, identifier: `GAM-${41 + index}`, url: `https://linear.app/x/issue/GAM-${41 + index}`, state: key === "parent" ? parentState : key === "scout" ? "In Progress" : "Todo", commented: false })),
  })

  it("writes the brief of the bookkeeping sub-agent, which says where to write its answer, then records the ids it wrote", async () => {
    await w.run("start", "The Crew")
    const brief = await w.run("linear", "the-crew", "--scratch", w.scratch)
    expect(brief.code).toBe(0)
    expect(brief.out).toContain("Linear needs work: 11 issues to make, 0 to move or rename, 0 comments to post.")
    expect(brief.out).toContain("model haiku")
    const text = readFileSync(join(w.scratch, "linear-the-crew-brief.md"), "utf8")
    expect(text).toContain(join(w.scratch, "linear-the-crew-answer.json"))
    expect(text).toContain('"wantTitle": "The Crew: add the game"')
    // no answer yet
    expect((await w.run("linear-record", "the-crew", "--scratch", w.scratch)).err).toContain("no answer at")
    writeFileSync(join(w.scratch, "linear-the-crew-answer.json"), `\`\`\`json\n${JSON.stringify(answer())}\n\`\`\``)
    const recorded = await w.run("linear-record", "the-crew", "--scratch", w.scratch)
    expect(recorded.code).toBe(0)
    expect(recorded.out).toContain("Linear: GAM-41 and 10 sub-issues recorded")
    const state = stateOf("the-crew")
    expect(state.linear).toMatchObject({ labelId: "label-1", error: null })
    expect(stepOf(state, "scout").issue?.identifier).toBe("GAM-42")
    expect((await w.run("status", "the-crew")).out).toContain("linear  GAM-41")
    expect((await w.run("linear", "the-crew", "--scratch", w.scratch)).out).toContain("nothing to do")
  })

  it("brings the issues along when a step is validated: the next one In Progress, the validated one Done with a comment", async () => {
    await w.run("start", "The Crew")
    await w.run("linear", "the-crew", "--scratch", w.scratch)
    writeFileSync(join(w.scratch, "linear-the-crew-answer.json"), JSON.stringify(answer()))
    await w.run("linear-record", "the-crew", "--scratch", w.scratch)
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    writeScout("the-crew", { ...SCOUT, name: "The Crew", slug: "the-crew" })
    await w.run("gate", "the-crew", "scout", "--report", report("r.md", "STATUS: done\nLINKS: https://example.com/the-crew"))
    await w.run("validate", "the-crew", "scout")
    const next = await w.run("linear", "the-crew", "--scratch", w.scratch)
    expect(next.out).toContain("Linear needs work: 0 issues to make, 2 to move or rename, 1 comment to post.")
    expect(readFileSync(join(w.scratch, "linear-the-crew-brief.md"), "utf8")).toContain("Validated on 2026-11-17 at its gate in /add-game (1 round).")
  })

  it("tells what the answer lacks, and goes on", async () => {
    await w.run("start", "The Crew")
    await w.run("linear", "the-crew", "--scratch", w.scratch)
    writeFileSync(join(w.scratch, "linear-the-crew-answer.json"), JSON.stringify({ labelId: "label-1", issues: [{ key: "parent", id: "p", identifier: "GAM-41", url: "u", state: "In Progress" }] }))
    const result = await w.run("linear-record", "the-crew", "--scratch", w.scratch)
    expect(result.code).toBe(1)
    expect(result.err).toContain("no issue came back for scout")
    expect(stateOf("the-crew").linear.error).toContain("no issue came back for scout")
    expect(stateOf("the-crew").linear.parent?.identifier).toBe("GAM-41")
  })
})

describe("the command line", () => {
  it("prints its usage for no verb and for help, and refuses a verb, a step or an option it does not know", async () => {
    const none = await w.run()
    expect(none.code).toBe(2)
    expect(none.out).toContain(USAGE.split("\n")[0])
    const help = await w.run("--help")
    expect(help.code).toBe(0)
    expect(help.out).toContain("pnpm game-flow <verb>")
    expect((await w.run("dance")).code).toBe(2)
    expect((await w.run("dance")).err).toContain('Unknown verb "dance"')
    await w.run("start", "The Crew")
    const unknownStep = await w.run("begin", "the-crew", "nope")
    expect(unknownStep.code).toBe(2)
    expect(unknownStep.err).toContain('"nope" is not a step')
    expect((await w.run("begin", "the-crew", "scout", "--nope")).err).toContain("Unknown option --nope")
    expect((await w.run("begin", "the-crew", "scout", "--scratch")).err).toContain("--scratch takes a value")
    expect((await w.run("begin")).code).toBe(2)
    expect((await w.run("begin", "nobody", "scout")).err).toContain('nobody is not in the flow yet: pnpm game-flow start "nobody"')
  })

  it("refuses a name that makes no slug", async () => {
    expect((await w.run("start")).code).toBe(2)
    expect((await w.run("start", "!!!")).code).toBe(2)
  })
})

describe("as pnpm runs it", () => {
  // `bin/game-flow.ts` is run by Node itself (type stripping, no bundler), where tsc and vitest cannot see what breaks: a value import without a `.ts` extension, a syntax Node does not strip
  it("starts, and lists no game in an empty world", () => {
    const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(PACKAGE_DIR, "bin", "game-flow.ts"), "status"], { encoding: "utf8", env: { ...process.env, PBGO_ASSETS_DIR: w.assets }, timeout: 30_000 })
    expect(result.stderr).toBe("")
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("No game is in the flow")
  })

  it("starts a game and shows it, in a world of its own", () => {
    const run = (...args: string[]) => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(PACKAGE_DIR, "bin", "game-flow.ts"), ...args], { encoding: "utf8", env: { ...process.env, PBGO_ASSETS_DIR: w.assets }, timeout: 30_000 })
    expect(run("start", "Zzz Test Game Not In The Repo").status).toBe(0)
    const shown = run("status", "zzz-test-game-not-in-the-repo", "--json")
    expect(shown.status).toBe(0)
    expect((JSON.parse(shown.stdout) as { slug: string }).slug).toBe("zzz-test-game-not-in-the-repo")
  })
})

describe("a game found by the slug it had", () => {
  it("keeps answering to its first slug once the scout settled another, and is not started again by it", async () => {
    await w.run("start", "Sample")
    await w.run("begin", "sample", "scout", "--scratch", w.scratch)
    writeScout("sample")
    await w.run("gate", "sample", "scout", "--report", report("r.md", "STATUS: done"))
    await w.run("validate", "sample", "scout")
    expect((await w.run("status", "sample")).out).toContain("Sample Game (sample-game)")
    const again = await w.run("start", "sample")
    expect(again.code).toBe(0)
    expect(again.out).toContain("is in the flow already")
    expect(existsSync(join(w.assets, "sample"))).toBe(false)
  })
})

describe("one command at a time", () => {
  it("holds the lock of the games' folder while a verb that writes runs, and none for status", async () => {
    await w.run("start", "The Crew")
    const lock = join(w.assets, ".game-flow.lock")
    const seen: boolean[] = []
    w.exec = () => {
      seen.push(existsSync(lock))
      return OK
    }
    await w.run("check", "the-crew", "platform-assets")
    expect(seen).toEqual([true])
    expect(existsSync(lock)).toBe(false)
    // status asks the repo for the stage of a game that has a folder, and writes nothing
    makeGameFolder("the-crew")
    seen.length = 0
    await w.run("status", "the-crew")
    expect(seen).toEqual([false])
  })

  it("makes two verbs that run together wait for each other, so that neither loses what the other wrote", async () => {
    await w.run("start", "The Crew")
    w.delay = 150
    // the first reads the state and waits for its check; the second would write meanwhile
    const slow = w.run("check", "the-crew", "platform-assets")
    await new Promise((done) => setTimeout(done, 40))
    const fast = w.run("fail", "the-crew", "scout", "--reason", "no token")
    await Promise.all([slow, fast])
    const state = stateOf("the-crew")
    expect(stepOf(state, "scout")).toMatchObject({ status: "failed", failure: "no token" })
    expect(stepOf(state, "platform-assets").check).toMatchObject({ ok: true })
  })
})

describe("reopening a step", () => {
  it("refuses a second round while the first may be at work, and says to look first", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    const second = await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    expect(second.code).toBe(1)
    expect(second.err).toContain("may be at work still")
    expect(second.err).toContain("--again")
    expect(stepOf(stateOf("the-crew"), "scout").rounds).toBe(1)
    const status = await w.run("status", "the-crew")
    expect(status.out).toContain("open since")
    expect(status.out).toContain("Next [reopen]:")
  })

  it("points to the report that is there instead of opening a round that would leave it unread, and gates it without being told where it is", async () => {
    await w.run("start", "The Crew")
    await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    writeFileSync(join(w.scratch, "report-the-crew-scout-r1.md"), "STATUS: done\nSUMMARY: written while the session was away")
    writeScout("the-crew", { ...SCOUT, name: "The Crew", slug: "the-crew" })
    const status = await w.run("status", "the-crew")
    expect(status.out).toContain("its report is there")
    expect(status.out).toContain("Next [gate-ready]:")
    const refused = await w.run("begin", "the-crew", "scout", "--scratch", w.scratch)
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("left its report")
    const gated = await w.run("gate", "the-crew", "scout")
    expect(gated.code).toBe(0)
    expect(stepOf(stateOf("the-crew"), "scout").report).toContain("written while the session was away")
  })

  it("does not gate a step that never began", async () => {
    await w.run("start", "The Crew")
    const refused = await w.run("gate", "the-crew", "scout")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("has not begun")
    expect(stepOf(stateOf("the-crew"), "scout").status).toBe("pending")
  })
})

describe("an expansion", () => {
  const EXPANSION = { ...SCOUT, name: "Sample Game: Extra", slug: "sample-game-extra", type: "expansion", baseGame: { slug: "sample-game", name: "Sample Game" }, bgg: { ...SCOUT.bgg, type: "boardgameexpansion" } }

  it("goes through the scout and the catalog entry only: the steps after are its base game's work", async () => {
    await w.run("start", "Sample Game Extra", "--adopt-through", "catalog-entry")
    writeScout("sample-game-extra", EXPANSION)
    const status = await w.run("status", "sample-game-extra")
    expect(status.out).toContain("Next [done]: Sample Game Extra is an expansion of sample-game")
    const begin = await w.run("begin", "sample-game-extra", "rules-spec", "--scratch", w.scratch)
    expect(begin.code).toBe(1)
    expect(begin.err).toContain("is an expansion of sample-game")
    expect((await w.run("gate", "sample-game-extra", "rules-spec")).code).toBe(1)
  })

  it("does not stop a game of its own that comes from another: a reimplementation has every step", async () => {
    await w.run("start", "Sample Game Remake", "--adopt-through", "catalog-entry")
    writeScout("sample-game-remake", { ...EXPANSION, name: "Sample Game Remake", slug: "sample-game-remake", type: "reimplementation", bgg: SCOUT.bgg })
    expect((await w.run("status", "sample-game-remake")).out).toContain("Next [begin]: pnpm game-flow begin sample-game-remake rules-spec")
  })
})

describe("taking a game on", () => {
  it("does not take a game through a stage that the repo says it has not passed", async () => {
    makeGameFolder("love-letter")
    w.exec = () => ({ code: 1, stdout: "scaffold\n  ✗ sanity project: no Sanity project yet\nlove-letter has got as far as: nothing.\n", stderr: "" })
    const refused = await w.run("start", "Love Letter", "--adopt-through", "game-new")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("not taken on through game folder")
    expect(refused.err).toContain("pnpm check:game love-letter")
    expect(existsSync(join(w.assets, "love-letter"))).toBe(false)
  })
})

describe("the checkout of the steps that work in it", () => {
  it("refuses the game folder when the checkout has tracked changes that are not the game's, and leaves untracked files alone", async () => {
    await w.run("start", "The Crew", "--adopt-through", "platform-assets")
    w.exec = () => ({ code: 0, stdout: " M README.md\n?? scratch.txt\n?? docs/games/the-crew/\n", stderr: "" })
    const refused = await w.run("begin", "the-crew", "game-new", "--scratch", w.scratch)
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("changes that are not the game's (README.md)")
    expect(stepOf(stateOf("the-crew"), "game-new").status).toBe("pending")
    w.exec = () => ({ code: 0, stdout: "?? scratch.txt\n M docs/games/the-crew/rules.md\n", stderr: "" })
    expect((await w.run("begin", "the-crew", "game-new", "--scratch", w.scratch)).code).toBe(0)
  })

  it("wants the rules spec that the owner validated to be in this checkout: it was written there, uncommitted", async () => {
    await w.run("start", "The Crew", "--adopt-through", "catalog-entry")
    writeScout("the-crew")
    mkdirSync(join(w.repo, "docs", "games", "the-crew"), { recursive: true })
    writeFileSync(join(w.repo, "docs", "games", "the-crew", "rules.md"), "# The Crew: rules spec\n")
    await w.run("begin", "the-crew", "rules-spec", "--scratch", w.scratch)
    await w.run("gate", "the-crew", "rules-spec", "--report", report("r.md", "STATUS: done"))
    await w.run("validate", "the-crew", "rules-spec")
    await w.run("begin", "the-crew", "platform-assets", "--scratch", w.scratch)
    await w.run("gate", "the-crew", "platform-assets", "--report", report("p.md", "STATUS: done"))
    await w.run("validate", "the-crew", "platform-assets")
    rmSync(join(w.repo, "docs"), { recursive: true })
    const refused = await w.run("begin", "the-crew", "game-new", "--scratch", w.scratch)
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("rules spec (docs/games/the-crew/rules.md) is not in this checkout")
  })

  it("tells the sub-agent the Linear issue of its step and the parent it must not name", async () => {
    await w.run("start", "The Crew", "--adopt-through", "platform-assets")
    const state = stateOf("the-crew")
    stepOf(state, "game-new").issue = { id: "i", identifier: "GAM-47", url: "u", title: "The Crew: game folder", applied: "In Progress", commented: false }
    state.linear.parent = { id: "p", identifier: "GAM-41", url: "u", title: "The Crew: add the game", applied: "In Progress", commented: false }
    writeFileSync(join(w.assets, "the-crew", "pipeline.json"), JSON.stringify(state))
    await w.run("begin", "the-crew", "game-new", "--scratch", w.scratch)
    const brief = readFileSync(join(w.scratch, "brief-the-crew-game-new.md"), "utf8")
    expect(brief).toContain("`GAM-47`")
    expect(brief).toContain("never the game's parent issue `GAM-41`")
  })
})

describe("a game that has its folder in the repo", () => {
  it("enters the flow with --existing: nothing is taken on, the scout runs as it is, and its check says so", async () => {
    makeGameFolder("trio")
    const started = await w.run("start", "Trio", "--existing")
    expect(started.code).toBe(0)
    expect(started.out).toContain("games/trio is in the repo already: every step runs on it, the scout included")
    expect(started.out).not.toContain("Taken on with nothing behind it")
    expect(STEPS.every((step) => stepOf(stateOf("trio"), step.id).status === "pending")).toBe(true)
    expect(started.out).toContain("Next [begin]: pnpm game-flow begin trio scout")
    expect((await w.run("begin", "trio", "scout", "--scratch", w.scratch)).code).toBe(0)
    const brief = readFileSync(join(w.scratch, "brief-trio-scout.md"), "utf8")
    const file = join(w.assets, "trio", "scout.json")
    expect(brief).toContain(`Trio --out ${file} --existing`)
    expect(brief).toContain(`pnpm check:scout ${file} --online --existing`)
    writeScout("trio", { ...SCOUT, name: "Trio", slug: "trio" })
    await w.run("gate", "trio", "scout", "--report", report("t.md", "STATUS: done"))
    expect(w.calls.at(-1)).toEqual({ file: "pnpm", args: ["check:scout", file, "--online", "--existing"] })
    // a game that has no folder is scouted as before
    await w.run("start", "Sample")
    await w.run("begin", "sample", "scout", "--scratch", w.scratch)
    expect(readFileSync(join(w.scratch, "brief-sample-scout.md"), "utf8")).not.toContain("--existing")
  })

  it("is refused with --existing when it has no folder in this checkout, and when --adopt-through is asked too", async () => {
    const none = await w.run("start", "Trio", "--existing")
    expect(none.code).toBe(1)
    expect(none.err).toContain("games/trio is not in this checkout")
    makeGameFolder("trio")
    const both = await w.run("start", "Trio", "--existing", "--adopt-through", "game-new")
    expect(both.code).toBe(2)
    expect(both.err).toContain("do not go together")
    const bare = await w.run("start", "Trio")
    expect(bare.code).toBe(1)
    expect(bare.err).toContain("--existing")
    expect(bare.err).toContain("--adopt-through")
  })

  it("keeps the slug of its folder when the scout validates: the folder of the repo does not move", async () => {
    makeGameFolder("trio")
    await w.run("start", "Trio", "--existing")
    await w.run("begin", "trio", "scout", "--scratch", w.scratch)
    writeScout("trio", { ...SCOUT, name: "Trio", slug: "trio-the-game" })
    await w.run("gate", "trio", "scout", "--report", report("t.md", "STATUS: done"))
    const refused = await w.run("validate", "trio", "scout")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("games/trio is this game's folder in the repo, so its slug does not change")
    expect(stepOf(stateOf("trio"), "scout").status).toBe("gate")
    writeScout("trio", { ...SCOUT, name: "Trio (2019)", slug: "trio" })
    expect((await w.run("validate", "trio", "scout")).code).toBe(0)
    expect(stateOf("trio").name).toBe("Trio (2019)")
  })
})

describe("a step taken on as it was", () => {
  it("is said in the status, and the command says what it has no file behind it for when the game enters the flow", async () => {
    makeGameFolder("love-letter")
    const started = await w.run("start", "Love Letter", "--adopt-through", "game-new")
    expect(started.out).toContain("Taken on with nothing behind it")
    expect(started.out).toContain(`scout: no scout file (${join(w.assets, "love-letter", "scout.json")})`)
    expect(started.out).toContain("pnpm game-flow redo love-letter scout --only")
    expect(started.out).toContain("rules spec: no page (docs/games/love-letter/rules.md)")
    expect(started.out).toContain("pnpm game-flow redo love-letter rules-spec --only")
    expect((await w.run("status", "love-letter")).out).toContain("validated 2026-11-17 · taken on as it was")
  })

  it("says nothing of a scout file and a spec that are there", async () => {
    makeGameFolder("love-letter")
    mkdirSync(join(w.assets, "love-letter"), { recursive: true })
    writeScout("love-letter", { ...SCOUT, name: "Love Letter", slug: "love-letter" })
    mkdirSync(join(w.repo, "docs", "games", "love-letter"), { recursive: true })
    writeFileSync(join(w.repo, "docs", "games", "love-letter", "rules.md"), "# Love Letter: rules spec\n")
    const started = await w.run("start", "Love Letter", "--adopt-through", "game-new")
    expect(started.code).toBe(0)
    expect(started.out).not.toContain("Taken on with nothing behind it")
  })

  it("keeps the steps that read the scout file from beginning without one, and says how to make it for a scout that was taken on", async () => {
    await w.run("start", "The Crew", "--adopt-through", "scout")
    const refused = await w.run("begin", "the-crew", "catalog-entry", "--scratch", w.scratch)
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("there is no scout file yet")
    expect(refused.err).toContain("catalog entry reads one. The scout was taken on as it was, so none was made: pnpm game-flow redo the-crew scout --only")
    expect(stepOf(stateOf("the-crew"), "catalog-entry").status).toBe("pending")
    await w.run("start", "Sample", "--adopt-through", "catalog-entry")
    expect((await w.run("begin", "sample", "rules-spec", "--scratch", w.scratch)).err).toContain("rules spec reads one")
    await w.run("start", "Coup", "--adopt-through", "rules-spec")
    expect((await w.run("begin", "coup", "platform-assets", "--scratch", w.scratch)).err).toContain("platform assets reads one")
    // a scout that was run and whose file is gone is not the same case
    const state = stateOf("the-crew")
    stepOf(state, "scout").report = "STATUS: done"
    writeFileSync(join(w.assets, "the-crew", "pipeline.json"), JSON.stringify(state))
    expect((await w.run("begin", "the-crew", "catalog-entry", "--scratch", w.scratch)).err).toContain("the scout step validated one, so it was moved or deleted")
  })

  it("says the same for the rulebook, which is the one the scout found", async () => {
    await w.run("start", "The Crew", "--adopt-through", "scout")
    const result = await w.run("rulebook", "the-crew")
    expect(result.code).toBe(1)
    expect(result.err).toContain("the rulebook is the one the scout found. The scout was taken on as it was")
  })

  it("is run after all with redo --only: that step alone goes back, and the ones after it keep what they have", async () => {
    makeGameFolder("love-letter")
    await w.run("start", "Love Letter", "--adopt-through", "game-new")
    const redone = await w.run("redo", "love-letter", "scout", "--only")
    expect(redone.code).toBe(0)
    expect(redone.out).toContain("scout is back to not started and runs next: the steps after it keep what they have")
    expect(STEPS.slice(0, 6).map((step) => stepOf(stateOf("love-letter"), step.id).status)).toEqual(["pending", "validated", "validated", "validated", "validated", "pending"])
    expect((await w.run("status", "love-letter")).out).toContain("Next [begin]: pnpm game-flow begin love-letter scout")
    const begun = await w.run("begin", "love-letter", "scout", "--scratch", w.scratch)
    expect(begun.code).toBe(0)
    expect(readFileSync(join(w.scratch, "brief-love-letter-scout.md"), "utf8")).toContain("--existing")
    // the steps after it wait for it
    expect((await w.run("begin", "love-letter", "game-sanity-create", "--scratch", w.scratch)).err).toContain("scout is not validated yet")
  })

  it("is taken back alone only when it was taken on as it was", async () => {
    await w.run("start", "The Crew")
    const refused = await w.run("redo", "the-crew", "scout", "--only")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("--only is for a step that was taken on as it was, and scout was not")
    expect(stepOf(stateOf("the-crew"), "scout").status).toBe("pending")
  })

  it("tells the engine, when it begins and in its brief, that there is no rules spec behind it", async () => {
    makeGameFolder("coup")
    await w.run("start", "Coup", "--adopt-through", "game-assets")
    const begun = await w.run("begin", "coup", "engine-rules", "--scratch", w.scratch)
    expect(begun.out).toContain("Note: there is no rules spec (docs/games/coup/rules.md)")
    expect(readFileSync(join(w.scratch, "brief-coup-engine-rules.md"), "utf8")).toContain("When it does not (a game taken on without one), the rulebook is the source")
    mkdirSync(join(w.repo, "docs", "games", "coup"), { recursive: true })
    writeFileSync(join(w.repo, "docs", "games", "coup", "rules.md"), "# Coup: rules spec\n")
    expect((await w.run("begin", "coup", "engine-rules", "--again", "--scratch", w.scratch)).out).not.toContain("Note: there is no rules spec")
  })
})

describe("the rulebook, before it is fetched", () => {
  it("says from where it would fetch it, and fetches nothing, with --dry-run: the owner is asked first", async () => {
    await w.run("start", "Sample")
    writeScout("sample")
    const result = await w.run("rulebook", "sample", "--dry-run")
    expect(result.code).toBe(0)
    expect(result.out).toContain("It would fetch https://example.com/rules.pdf")
    expect(result.out).toContain("a download needs their yes")
    expect(w.fetched).toEqual([])
  })
})

describe("a family of games", () => {
  it("puts the games of one line in one folder: assets/the-crew/ holds the base game and its reimplementations", async () => {
    const base = await w.run("start", "The Crew: The Quest for Planet Nine", "--family", "the-crew")
    expect(base.code).toBe(0)
    expect(existsSync(join(w.assets, "the-crew", "the-crew-the-quest-for-planet-nine", "pipeline.json"))).toBe(true)
    expect(base.out).toContain("the-crew/the-crew-the-quest-for-planet-nine/pipeline.json")
    expect((await w.run("start", "The Crew: Mission Deep Sea", "--family", "the-crew")).code).toBe(0)
    expect(existsSync(join(w.assets, "the-crew", "the-crew-mission-deep-sea", "pipeline.json"))).toBe(true)
    // each is found by its name or its slug, and listed
    expect((await w.run("status", "the-crew-mission-deep-sea")).out).toContain("The Crew: Mission Deep Sea (the-crew-mission-deep-sea)")
    expect((await w.run("status", "The Crew: The Quest for Planet Nine")).code).toBe(0)
    const listed = await w.run("status")
    expect(listed.out).toContain("the-crew-mission-deep-sea")
    expect(listed.out).toContain("the-crew-the-quest-for-planet-nine")
    // and is not started again
    expect((await w.run("start", "The Crew: Mission Deep Sea", "--family", "the-crew")).out).toContain("is in the flow already")
  })

  it("settles the scout's slug inside the folder of the family, and keeps the slug the game had as a name it answers to", async () => {
    await w.run("start", "Sample", "--family", "sample-line")
    await w.run("begin", "sample", "scout", "--scratch", w.scratch)
    writeScout("sample-line/sample")
    await w.run("gate", "sample", "scout", "--report", report("r.md", "STATUS: done"))
    const result = await w.run("validate", "sample", "scout")
    expect(result.code).toBe(0)
    expect(existsSync(join(w.assets, "sample-line", "sample"))).toBe(false)
    expect(existsSync(join(w.assets, "sample-line", "sample-game", "pipeline.json"))).toBe(true)
    expect(result.out).toContain("sample-line/sample-game")
    expect((await w.run("status", "sample")).out).toContain("Sample Game (sample-game)")
  })

  it("refuses a family that is not a folder name, and a folder that is a game's own", async () => {
    expect((await w.run("start", "The Crew", "--family", "The Crew!")).code).toBe(2)
    expect((await w.run("start", "The Crew", "--family")).code).toBe(2)
    await w.run("start", "Skyjo")
    const refused = await w.run("start", "Skyjo Action", "--family", "skyjo")
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("is the folder of a game, not of a family")
    expect(existsSync(join(w.assets, "skyjo", "skyjo-action"))).toBe(false)
  })
})

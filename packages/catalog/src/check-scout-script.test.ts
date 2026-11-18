import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// `scripts/check-scout.ts` is run by Node itself (type stripping, no bundler), where the package's tsc and vitest cannot see what breaks: a value import without a `.ts` extension, a
// syntax Node does not strip. This runs it as `pnpm check:scout` does, against files in a folder of its own and a stand-in for the platform's Sanity project.
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))
const NODE = ["--disable-warning=ExperimentalWarning"]
const SANITY_STUB = `
globalThis.fetch = async () => new Response(process.env.SANITY_ANSWER, { status: Number(process.env.SANITY_STATUS ?? 200), headers: { "content-type": "application/json" } })
`

const scoutFile = (changes: Record<string, unknown> = {}) => ({
  version: 1,
  scoutedAt: "2026-11-15",
  name: "Sample Game",
  slug: "sample-game",
  type: "base-game",
  baseGame: null,
  suggestion: null,
  edition: { publisher: "Sample Publisher", year: 2024, label: null, bggVersionId: null, rules: null, confidence: "high" },
  bgg: null,
  facts: { playersMin: 2, playersMax: 6, duration: 30, minAge: 8, complexity: null },
  existing: { catalog: "none" },
  notes: [],
  sources: [{ label: "Publisher page", url: "https://example.com/sample-game" }],
  ...changes,
})

const CATALOG = { result: [{ _type: "game", slug: "flip-7", name: "Flip 7", bggId: 420087, kind: "game" }] }

let folder = ""
beforeAll(() => {
  folder = mkdtempSync(join(tmpdir(), "check-scout-"))
})
afterAll(() => {
  rmSync(folder, { recursive: true, force: true })
})

/** Writes a file in the folder and runs the command on it. */
function check(name: string, content: unknown, args: string[] = [], { answer = CATALOG, status = 200 }: { answer?: unknown; status?: number } = {}) {
  const file = join(folder, name)
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content))
  return run([file, ...args], { answer, status })
}

function run(args: string[], { answer = CATALOG, status = 200 }: { answer?: unknown; status?: number } = {}) {
  return spawnSync(process.execPath, [...NODE, "--import", `data:text/javascript,${encodeURIComponent(SANITY_STUB)}`, "scripts/check-scout.ts", ...args], {
    cwd: PACKAGE_DIR,
    env: { ...process.env, SANITY_ANSWER: JSON.stringify(answer), SANITY_STATUS: String(status) },
    encoding: "utf8",
    timeout: 20_000,
  })
}

describe("pnpm check:scout", () => {
  it("says ok to a sound file, with its name, its slug and its type", () => {
    const result = check("sound.json", scoutFile())
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("ok")
    expect(result.stdout).toContain("Sample Game (sample-game, base-game)")
  })

  it("lists what is wrong with a file and exits 1", () => {
    const result = check("wrong.json", scoutFile({ slug: "API", scoutedAt: "yesterday" }))
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("fail")
    expect(result.stdout).toContain("slug:")
    expect(result.stdout).toContain("scoutedAt:")
  })

  it("says that a file is not JSON, and that one cannot be read", () => {
    const text = check("text.json", "{ not json")
    expect(text.status).toBe(1)
    expect(text.stdout).toContain("The file is not JSON")
    const missing = run([join(folder, "nothing-here.json")])
    expect(missing.status).toBe(2)
    expect(missing.stderr).toContain("Cannot read")
  })

  it("asks for nothing from the catalog without --online", () => {
    // a stand-in that fails every request: the command must not ask
    const result = check("offline.json", scoutFile(), [], { status: 500, answer: {} })
    expect(result.status, result.stderr).toBe(0)
  })

  it("checks the game against the registry and the catalog with --online", () => {
    const result = check("online.json", scoutFile(), ["--online"])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("against the registry and the catalog")
  })

  it("does not scout a game that has its folder, nor one that the catalog has", () => {
    const folderGame = check("skyjo.json", scoutFile({ name: "Skyjo", slug: "skyjo" }), ["--online"])
    expect(folderGame.status).toBe(1)
    expect(folderGame.stdout).toContain('"skyjo" is already a game of the site')
    const catalogGame = check("flip.json", scoutFile({ name: "Flip Seven", slug: "flip-seven", bgg: { id: 420087, type: "boardgame", year: 2024, rank: null, rating: null, ratings: 0, weight: null, weights: 0 } }), ["--online"])
    expect(catalogGame.status).toBe(1)
    expect(catalogGame.stdout).toContain('as the game "flip-7"')
  })

  it("scouts a game that has its folder with --existing, and only with --online", () => {
    const skyjo = scoutFile({ name: "Skyjo", slug: "skyjo" })
    const taken = check("skyjo-existing.json", skyjo, ["--online", "--existing"])
    expect(taken.status, taken.stdout).toBe(0)
    expect(taken.stdout).toContain("against the registry and the catalog")
    // a game that has no folder is not an existing one
    const none = check("sample-existing.json", scoutFile(), ["--online", "--existing"])
    expect(none.status).toBe(1)
    expect(none.stdout).toContain("--existing is for a game that has its folder")
    const offline = check("skyjo-offline.json", skyjo, ["--existing"])
    expect(offline.status).toBe(2)
    expect(offline.stderr).toContain("--existing is for --online")
  })

  it("wants the base game of an expansion to be in the catalog", () => {
    const expansion = { name: "Flip 7: The Village", slug: "flip-7-the-village", type: "expansion", baseGame: { slug: "flip-7", name: "Flip 7" } }
    expect(check("expansion.json", scoutFile(expansion), ["--online"]).status).toBe(0)
    const ghost = check("ghost.json", scoutFile({ ...expansion, baseGame: { slug: "ghost", name: "Ghost" }, slug: "ghost-the-village" }), ["--online"])
    expect(ghost.status).toBe(1)
    expect(ghost.stdout).toContain('"ghost" is not a published game of the catalog')
  })

  it("says that the catalog could not be read, and exits 1", () => {
    const result = check("down.json", scoutFile(), ["--online"], { status: 503, answer: {} })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Sanity answered 503")
  })

  it("lists the games and the expansions that a scouted game is compared with, with --list", () => {
    const catalog = {
      result: [
        { _type: "game", slug: "flip-7", name: "Flip 7", bggId: 420087, kind: "game" },
        { _type: "game", slug: "flip-7-vengeance", name: "Flip 7 Vengeance", kind: "reimplementation", baseGame: "flip-7" },
        { _type: "expansion", slug: "bang-legends", name: "Legends", baseGame: "bang" },
      ],
    }
    const result = run(["--list"], { answer: catalog })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("2 games and 1 expansions published in the platform's catalog")
    expect(result.stdout).toMatch(/flip-7\s+game\s+420087\s+-\s+yes\s+Flip 7/)
    expect(result.stdout).toMatch(/flip-7-vengeance\s+reimplementation\s+-\s+flip-7\s+no\s+Flip 7 Vengeance/)
    expect(result.stdout).toMatch(/bang-legends\s+expansion\s+-\s+bang\s+no\s+Legends/)
    // the games of the registry that the catalog does not have are there too
    expect(result.stdout).toMatch(/skyjo\s+folder only/)
  })

  it("says that the catalog could not be read when it is listed, and exits 1", () => {
    const result = run(["--list"], { status: 500, answer: {} })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Sanity answered 500")
  })

  it("prints its usage for --help", () => {
    const result = run(["--help"])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: pnpm check:scout <file> [--online [--existing]]")
    expect(result.stdout).toContain("pnpm check:scout --list")
  })

  it("does not print what a terminal would obey from a file that holds it", () => {
    const result = check("hostile.json", scoutFile({ slug: "\u001b[2J\u0007", "x\nok    /fake/path.json: Sample Game": 1 }))
    expect(result.status).toBe(1)
    expect(result.stdout).not.toMatch(/[\u0000-\u0009\u000b-\u001f]/)
    expect(result.stdout).toContain("\\u{1b}")
  })

  it.each([[[]], [["--bogus", "x.json"]], [["a.json", "b.json"]], [["--list", "x.json"]], [["--list", "--online"]]])("refuses the command line %j with the usage and exits 2", (args) => {
    const result = run(args)
    expect(result.status).toBe(2)
    expect(result.stderr).toContain("Usage: pnpm check:scout")
  })
})

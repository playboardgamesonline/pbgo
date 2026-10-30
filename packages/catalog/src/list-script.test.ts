import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { cdn, sanityGame } from "./testing"

// `scripts/list.ts` is run by Node itself (type stripping, no bundler), where the package's tsc and vitest cannot see what breaks:
// a value import without a `.ts` extension, a syntax Node does not strip. This runs it as `pnpm catalog:list` does.
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))
const NODE = ["--disable-warning=ExperimentalWarning"]

// The Sanity project for a Node that cannot load the fixtures (TypeScript with extensionless imports): a `fetch` that answers with the
// JSON in SANITY_ANSWER and the status in SANITY_STATUS, whatever is asked.
const SANITY_STUB = `
globalThis.fetch = async () => new Response(process.env.SANITY_ANSWER, { status: Number(process.env.SANITY_STATUS ?? 200), headers: { "content-type": "application/json" } })
`

function list(answer: unknown, status = 200) {
  return spawnSync(process.execPath, [...NODE, "--import", `data:text/javascript,${encodeURIComponent(SANITY_STUB)}`, "scripts/list.ts"], {
    cwd: PACKAGE_DIR,
    env: { ...process.env, SANITY_ANSWER: JSON.stringify(answer), SANITY_STATUS: String(status) },
    encoding: "utf8",
    timeout: 20_000,
  })
}

describe("pnpm catalog:list", () => {
  it("lists a live game first with its game of the Studio, then the other games in the order of the Studio", () => {
    // `related`: the games the game points to, one side of a link each (the catalog makes it go both ways)
    const game = (slug: string, name: string, extra: Record<string, unknown> = {}) => sanityGame(slug, { name, ...extra })
    const run = list({
      result: [
        game("alpha", "Alpha", { order: 30, related: ["charlie"], playersMin: 2, playersMax: 5, duration: 30, minAge: 8, complexity: 1.5, description: "Text", categories: ["Cards"], logo: cdn("a-1x1.png") }),
        game("bravo", "Bravo", { order: 10, creators: [{ name: "Ada", roles: ["designer", "artist"] }], publishers: [{ name: "Pub", url: null }] }),
        game("charlie", "Charlie"),
        game("delta", "Delta", { order: 20 }),
        // the worst order there is: a live game is not placed by it, the registry keeps it first
        game("courtisans", "Courtisans in the Studio", { order: 900, related: ["alpha"] }),
      ],
    })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain("Sanity read: 5 games, 0 skipped.")
    expect(run.stdout).not.toMatch(/^warning /m)

    // the table is the block after the header, its first line the column heads
    const rows = (run.stdout.split("\n\n")[1] ?? "").split("\n").slice(1)
    expect(rows.map((line) => line.split(/\s+/)[0])).toEqual(["courtisans", "bravo", "delta", "alpha", "charlie"])
    expect(run.stdout).toMatch(/^slug\s+name\s+kind\s+order\s+pictures\s+text\s+players\s+time\s+weight\s+age\s+categories\s+creators\s+publishers\s+related$/m)
    // a live game shows its game of the Studio, its name and its order included, not what the registry knows of it
    expect(run.stdout).toMatch(/^courtisans\s+Courtisans in the Studio\s+live\s+900\s/m)
    expect(run.stdout).not.toContain("live (registry)")
    expect(run.stdout).toMatch(/^bravo\s+Bravo\s+planned\s+10\s+- - -\s+-- -- -- --\s.*Ada \(designer\/artist\)\s+Pub\s*$/m)
    expect(run.stdout).toMatch(/^alpha\s+Alpha\s+planned\s+30\s+L - -\s+-- en -- --\s+2-5\s+30min\s+1\.50\s+8\+\s+Cards\s/m)
    // no order: nothing in the column, the games with none come last
    expect(run.stdout).toMatch(/^charlie\s+Charlie\s+planned\s+- - -/m)

    // the last column: a link written on one game shows on both, in the order of the list, the live game's included
    expect(run.stdout).toMatch(/^alpha\s.*\scourtisans, charlie$/m)
    expect(run.stdout).toMatch(/^charlie\s.*\salpha$/m)
    expect(run.stdout).not.toMatch(/^(bravo|delta)\s.*\b(alpha|charlie|courtisans)$/m)
  }, 30_000)

  it("lists a live game of the registry that the Studio has no game for, with what the registry knows of it", () => {
    const run = list({ result: [sanityGame("alpha", { name: "Alpha" })] })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toMatch(/^courtisans\s+\S.*\blive \(registry\)\s+\s*- - -\s/m)
    expect(run.stdout).toContain("live (registry) is a live game that the Studio has no game for")
    expect(run.stdout).not.toMatch(/^template\s/m)
  }, 30_000)

  it("says which games it leaves out, and why", () => {
    const run = list({
      result: [
        sanityGame("alpha", { name: "Alpha" }),
        sanityGame("api", { _id: "game-api", name: "Api" }),
        sanityGame("nameless", { _id: "game-nameless", name: null }),
        sanityGame("alpha-more", { name: "Alpha: More", kind: "expansion", baseGame: "alpha" }),
      ],
    })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain("Sanity read: 1 games, 2 skipped.")
    expect(run.stdout).toMatch(/^skipped\s+Api: .*a route of the site/m)
    expect(run.stdout).toMatch(/^skipped\s+game-nameless: it has no name/m)
    expect(run.stdout).toMatch(/^expansions\s+1 left out: .*is expansion/m)
    expect(run.stdout).not.toMatch(/^alpha-more\s/m)
  }, 30_000)

  it("does not mention expansions when there is none", () => {
    const run = list({ result: [sanityGame("alpha", { name: "Alpha" })] })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).not.toMatch(/^expansions\s/m)
  }, 30_000)

  it("exits with a failure and says why when the project cannot be read, listing nothing", () => {
    const run = list({ error: { description: "bad query" } }, 400)
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("The platform's Sanity project could not be read: Sanity answered 400: bad query")
    expect(run.stdout).toBe("")
  }, 30_000)
})

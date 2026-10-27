import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { CREATORS_DATABASE_ID, DEVELOPMENT_DATABASE_ID, EDITORS_DATABASE_ID, GAMES_DATABASE_ID } from "./notion"
import { developmentPage, fakeNotion, gamePage } from "./testing"

// `scripts/list.ts` is run by Node itself (type stripping, no bundler), where the package's tsc and vitest cannot see what breaks:
// a value import without a `.ts` extension, a syntax Node does not strip. This runs it as `pnpm catalog:list` does.
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))
const NODE = ["--disable-warning=ExperimentalWarning"]

// Notion for a Node that cannot load the fixtures (TypeScript with extensionless imports): a `fetch` that answers from the JSON in
// NOTION_ANSWERS, by "<method> <path>", and as for a database that is not shared with the integration to anything else.
const NOTION_STUB = `
const answers = JSON.parse(process.env.NOTION_ANSWERS)
globalThis.fetch = async (input, init = {}) => {
  const answer = answers[(init.method ?? "GET") + " " + new URL(String(input)).pathname] ?? { status: 404, body: { object: "error", code: "object_not_found" } }
  return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } })
}
`

/** What the fake Notion answers to each of the requests the reader makes (one page of rows per database, the schema of Games Development). */
async function notionAnswers(notion: { fetch: typeof fetch }) {
  const asked = [
    ["POST", `${GAMES_DATABASE_ID}/query`],
    ["POST", `${EDITORS_DATABASE_ID}/query`],
    ["POST", `${CREATORS_DATABASE_ID}/query`],
    ["POST", `${DEVELOPMENT_DATABASE_ID}/query`],
    ["GET", DEVELOPMENT_DATABASE_ID],
  ] as const
  const answers = await Promise.all(
    asked.map(async ([method, path]) => {
      const response = await notion.fetch(`https://api.notion.com/v1/databases/${path}`, { method, body: method === "POST" ? "{}" : undefined })
      return [`${method} /v1/databases/${path}`, { status: response.status, body: await response.json() }] as const
    }),
  )
  return Object.fromEntries(answers)
}

describe("pnpm catalog:list", () => {
  it("runs under plain Node without a token and lists the live games of the registry, with what it knows of them", () => {
    const run = spawnSync(process.execPath, [...NODE, "scripts/list.ts"], {
      cwd: PACKAGE_DIR,
      env: { ...process.env, NOTION_API_KEY: "" },
      encoding: "utf8",
      timeout: 20_000,
    })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain("NOTION_API_KEY is not set")
    expect(run.stdout).toMatch(/^slug\s+name\s+kind\s+development\s+art/m)
    // the registry's own row: no Notion row to show, so no picture, and the legend that says where the row comes from
    expect(run.stdout).toMatch(/^courtisans\s+\S.*\blive \(registry\)\s+- - -\s/m)
    expect(run.stdout).toContain("live (registry) is a live game that Notion has no row for")
    expect(run.stdout).not.toMatch(/^template\s/m)
  }, 30_000)

  it("lists a live game first with its Notion row, then the coming-soon games in the order of the Games Development database", async () => {
    // `related`: the rows the row points to, one side of a link each (the catalog makes it go both ways)
    const row = (slug: string, name: string, related: string[] = []) => gamePage({ slug, name, related: related.map((other) => `game-${other}`) })
    const notion = fakeNotion({
      games: [row("alpha", "Alpha", ["charlie"]), row("bravo", "Bravo"), row("charlie", "Charlie"), row("delta", "Delta"), row("courtisans", "Courtisans in Notion", ["alpha"])],
      editors: [],
      creators: [],
      development: [
        developmentPage({ slug: "alpha", game: ["game-alpha"], priority: "P2 · Next", status: "Engine" }),
        developmentPage({ slug: "bravo", game: ["game-bravo"], priority: "P1 · Now", status: "Rules", effort: "L" }),
        developmentPage({ slug: "delta", game: ["game-delta"], priority: "P2 · Next", status: "Engine", effort: "S" }),
        // the worst place there is: a live game is not ranked by it, the registry keeps it first
        developmentPage({ slug: "courtisans", game: ["game-courtisans"], priority: "P4 · Someday", status: "Not started", effort: "XXL" }),
      ],
    })
    const run = spawnSync(process.execPath, [...NODE, "--import", `data:text/javascript,${encodeURIComponent(NOTION_STUB)}`, "scripts/list.ts"], {
      cwd: PACKAGE_DIR,
      env: { ...process.env, NOTION_API_KEY: "test-token", NOTION_ANSWERS: JSON.stringify(await notionAnswers(notion)) },
      encoding: "utf8",
      timeout: 20_000,
    })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain("Notion read: 5 games with a slug, 0 expansions left out, 0 rows skipped.")
    expect(run.stdout).not.toMatch(/^warning /m)
    expect(run.stdout).not.toContain("test-token")

    // the table is the block after the header, its first line the column heads
    const rows = (run.stdout.split("\n\n")[1] ?? "").split("\n").slice(1)
    expect(rows.map((line) => line.split(/\s+/)[0])).toEqual(["courtisans", "bravo", "delta", "alpha", "charlie"])
    // a live game shows its Notion row too, its name and its development values included, not what the registry knows of it
    expect(run.stdout).toMatch(/^courtisans\s+Courtisans in Notion\s+live\s+P4 · Someday \/ Not started \/ XXL\s/m)
    expect(run.stdout).not.toContain("live (registry)")
    expect(run.stdout).toMatch(/^bravo\s+Bravo\s+planned\s+P1 · Now \/ Rules \/ L\s/m)
    expect(run.stdout).toMatch(/^delta\s+Delta\s+planned\s+P2 · Next \/ Engine \/ S\s/m)
    expect(run.stdout).toMatch(/^alpha\s+Alpha\s+planned\s+P2 · Next \/ Engine \/ -\s/m)
    // no row in Games Development: nothing in the column, the art column follows
    expect(run.stdout).toMatch(/^charlie\s+Charlie\s+planned\s+- - -\s/m)

    // the last column: a link written on one row shows on both games, in the order of the list, the live game's row included
    expect(run.stdout).toMatch(/^slug\s.*\spublisher\s+related$/m)
    expect(run.stdout).toMatch(/^alpha\s.*\scourtisans, charlie$/m)
    expect(run.stdout).toMatch(/^charlie\s.*\salpha$/m)
    expect(run.stdout).not.toMatch(/^(bravo|delta)\s.*\b(alpha|charlie|courtisans)$/m)
  }, 30_000)
})

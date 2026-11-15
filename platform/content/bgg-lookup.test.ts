import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// `bgg-lookup.ts` is run by Node itself (type stripping, no bundler), where tsc and vitest cannot see what breaks: a value import without a `.ts` extension, a syntax Node does
// not strip. This runs it as `pnpm --filter @pbgo/platform content:bgg-lookup` does, against a stand-in for BoardGameGeek: a `fetch` that answers BGG_ANSWER, whatever is asked.
const PLATFORM_DIR = fileURLToPath(new URL("..", import.meta.url))
const TOKEN = "bgg-test-token-0123456789"
const STUB = `globalThis.fetch = async () => new Response(process.env.BGG_ANSWER, { status: 200 })`

const SEVEN = `<items><item type="boardgameexpansion" id="7"><name type="primary" value="Seven" /><name type="alternate" value="Sept" /><yearpublished value="2020" />
  <link type="boardgameexpansion" id="3" value="Three" inbound="true" /><link type="boardgamepublisher" id="9" value="Pub" />
  <statistics page="1"><ratings><usersrated value="50" /><average value="7.5" /><ranks><rank type="subtype" id="1" name="boardgame" value="Not Ranked" /></ranks><numweights value="12" /><averageweight value="2.456" /></ratings></statistics>
</item></items>`

function lookup(args: string[], { token = TOKEN, answer = "" }: { token?: string; answer?: string } = {}) {
  return spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--import", `data:text/javascript,${encodeURIComponent(STUB)}`, "content/bgg-lookup.ts", ...args], {
    cwd: PLATFORM_DIR,
    env: { ...process.env, BGG_API_TOKEN: token, BGG_ANSWER: answer },
    encoding: "utf8",
    timeout: 20_000,
  })
}

describe("content:bgg-lookup", () => {
  it("prints its usage for --help, and needs no token for that", () => {
    const run = lookup(["--help"], { token: "" })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain("Usage: node content/bgg-lookup.ts")
  })

  it("says what is wrong with the command line, and points to --help", () => {
    const run = lookup(["--id", "abc"])
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("Error: --id is the number of an item of BoardGameGeek")
    expect(run.stderr).toContain("Run with --help")
    expect(run.stdout).toBe("")
  })

  it("says that the token is missing, and asks BoardGameGeek for nothing", () => {
    const run = lookup(["Skyjo"], { token: "" })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("BGG_API_TOKEN is not set")
  })

  it("prints one item as JSON, with the figures BGG has, and never the token", () => {
    const run = lookup(["--id", "7"], { answer: SEVEN })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout + run.stderr).not.toContain(TOKEN)
    expect(JSON.parse(run.stdout)).toMatchObject({
      id: 7,
      type: "boardgameexpansion",
      name: "Seven",
      alsoKnownAs: ["Sept"],
      year: 2020,
      rank: null,
      rating: 7.5,
      ratings: 50,
      weight: 2.46,
      weights: 12,
      publishers: ["Pub"],
      relations: [{ type: "boardgameexpansion", inbound: true, id: 3, name: "Three" }],
      expansions: 0,
    })
  })

  it("prints a search that found nothing as JSON too", () => {
    const run = lookup(["Nothing Like It"], { answer: `<items total="0"></items>` })
    expect(run.status, run.stderr).toBe(0)
    expect(JSON.parse(run.stdout)).toEqual({ query: "Nothing Like It", matched: 0, candidates: [] })
  })

  it("says why BoardGameGeek could not answer, without the token", () => {
    const run = lookup(["--id", "7"], { answer: "" })
    // an empty answer is no item at all
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("BoardGameGeek has no item 7")
    expect(run.stderr).not.toContain(TOKEN)
  })
})

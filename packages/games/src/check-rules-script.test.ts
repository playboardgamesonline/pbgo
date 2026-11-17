import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// `scripts/check-rules.ts` is run by Node itself (type stripping, no bundler), where the package's tsc and vitest cannot see what breaks: a value import without a `.ts` extension, a
// syntax Node does not strip. This runs it as `pnpm check:rules` does, against the folders of a docs/games of its own (`PBGO_GAMES_DOCS_DIR`).
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))
const SKILL = readFileSync(new URL("../../../.claude/skills/game-rules-spec/SKILL.md", import.meta.url), "utf8")
const block = (info: string) => new RegExp(`\`\`\`markdown ${info}\\n([\\s\\S]*?)\\n\`\`\``).exec(SKILL)?.[1] ?? ""
const SPEC = `${block("rules")}\n`
const INDEX = `${block("index")}\n`

let docs = ""
beforeAll(() => {
  docs = mkdtempSync(join(tmpdir(), "check-rules-"))
})
afterAll(() => {
  rmSync(docs, { recursive: true, force: true })
})

/** Writes the files of a game in the folder (what is `null` is not written) and runs the command on it. */
function check(slug: string, files: { rules?: string | null; index?: string | null }, args: string[] = []) {
  const dir = join(docs, slug)
  mkdirSync(dir, { recursive: true })
  if (files.rules != null) writeFileSync(join(dir, "rules.md"), files.rules)
  if (files.index != null) writeFileSync(join(dir, "index.md"), files.index)
  return run([slug, ...args])
}

function run(args: string[]) {
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(PACKAGE_DIR, "scripts", "check-rules.ts"), ...args], {
    encoding: "utf8",
    env: { ...process.env, PBGO_GAMES_DOCS_DIR: docs },
    timeout: 30_000,
  })
  return { status: result.status, out: result.stdout, err: result.stderr }
}

describe("pnpm check:rules", () => {
  it("is happy with the spec of the skill's example, and says what it holds", () => {
    const result = check("orchard-run", { rules: SPEC, index: INDEX })
    expect(result.err).toBe("")
    expect(result.out).toBe("ok    docs/games/orchard-run/rules.md: Orchard Run: 2–4 players, 5 components of 4 kinds, 2 open points (2 to validate), draft\nok    docs/games/orchard-run/index.md\n")
    expect(result.status).toBe(0)
  })

  it("checks the title against the name it is given", () => {
    expect(check("orchard-run", { rules: SPEC, index: INDEX }, ["--name", "Orchard Run"]).status).toBe(0)
    const wrong = check("orchard-run", { rules: SPEC, index: INDEX }, ["--name", "Another Game"])
    expect(wrong.status).toBe(1)
    expect(wrong.out).toContain('fail  docs/games/orchard-run/rules.md\n  - the title says "Orchard Run", the game is "Another Game"')
    expect(wrong.out).toContain('The title is "Orchard Run", the name of the game is "Another Game"')
  })

  it("says each problem of a spec that is not right, and exits 1", () => {
    const result = check("broken", { rules: SPEC.replace("## Setup", "## Set up").replace("- Players: 2–4\n", ""), index: INDEX })
    expect(result.status).toBe(1)
    expect(result.out).toContain("fail  docs/games/broken/rules.md\n")
    expect(result.out).toContain('  - The section "Setup" is missing')
    expect(result.out).toContain('  - At a glance: the line "- Players: …" is missing')
    expect(result.out).toContain("ok    docs/games/broken/index.md")
  })

  it("says when the spec or its landing page is not there", () => {
    const none = check("nothing-yet", { rules: null, index: null })
    expect(none.status).toBe(1)
    expect(none.out).toContain("fail  docs/games/nothing-yet/rules.md\n  - the file is not there: `game-rules-spec` writes it")
    expect(none.out).toContain("fail  docs/games/nothing-yet/index.md\n  - the file is not there: the docs of the site need a landing page for the folder")
    const lonely = check("no-landing", { rules: SPEC, index: null })
    expect(lonely.status).toBe(1)
    expect(lonely.out).toContain("ok    docs/games/no-landing/rules.md")
    expect(lonely.out).toContain("fail  docs/games/no-landing/index.md")
  })

  it("says what is wrong with a landing page", () => {
    const result = check("odd-landing", { rules: SPEC, index: "# Orchard Run\n\nNo link here.\n" })
    expect(result.status).toBe(1)
    expect(result.out).toContain("fail  docs/games/odd-landing/index.md\n  - The page links to the spec: [Rules spec](./rules.md)")
  })

  it("stamps a spec that passes as validated, once, with the day it is given: the owner's ok", () => {
    const result = check("stamped-run", { rules: SPEC, index: INDEX }, ["--name", "Orchard Run", "--stamp", "--date", "2026-11-17"])
    expect(result.err).toBe("")
    expect(result.status).toBe(0)
    expect(result.out).toContain("stamp docs/games/stamped-run/rules.md: Orchard Run: 2–4 players, 5 components of 4 kinds, 2 open points (0 to validate), validated 2026-11-17")
    const page = readFileSync(join(docs, "stamped-run", "rules.md"), "utf8")
    expect(page).toContain("- Status: validated 2026-11-17")
    expect(page).not.toContain("to validate")
    // validating again changes nothing, whatever day it is given
    const again = run(["stamped-run", "--stamp", "--date", "2026-12-01"])
    expect(again.status).toBe(0)
    expect(again.out).toContain("it is validated already, nothing changed")
    expect(readFileSync(join(docs, "stamped-run", "rules.md"), "utf8")).toBe(page)
  })

  it("does not stamp a spec that does not pass, and leaves its file as it is", () => {
    const broken = SPEC.replace("## Setup", "## Set up")
    const result = check("unstamped", { rules: broken, index: INDEX }, ["--stamp", "--date", "2026-11-17"])
    expect(result.status).toBe(1)
    expect(result.out).not.toContain("stamp docs/games/unstamped")
    expect(readFileSync(join(docs, "unstamped", "rules.md"), "utf8")).toBe(broken)
    // a spec that passes but whose landing page does not is not stamped either
    const lonely = check("unstamped-landing", { rules: SPEC, index: null }, ["--stamp", "--date", "2026-11-17"])
    expect(lonely.status).toBe(1)
    expect(readFileSync(join(docs, "unstamped-landing", "rules.md"), "utf8")).toBe(SPEC)
  })

  it("refuses a command line that is wrong, with the usage, and exits 2", () => {
    for (const args of [[], ["--name", "Orchard Run"], ["a", "b"], ["--nope", "a"], ["Not A Slug"], ["orchard-run", "--name"], ["orchard-run", "--name", "--help"], ["orchard-run", "--date", "2026-11-17"], ["orchard-run", "--stamp", "--date", "soon"]]) {
      const result = run(args)
      expect(result.status, args.join(" ")).toBe(2)
      expect(result.err, args.join(" ")).toContain("Usage: pnpm check:rules <slug>")
    }
    expect(run(["a", "b"]).err).toContain('One game only, got "a" and "b"')
    expect(run(["--nope"]).err).toContain("Unknown option --nope")
    expect(run(["Orchard Run"]).err).toContain("is not a slug")
  })

  it("prints its usage for --help", () => {
    const result = run(["--help"])
    expect(result.status).toBe(0)
    expect(result.out).toContain("Usage: pnpm check:rules <slug>")
  })

  it("never reads the folder of another game than the slug it is given", () => {
    check("orchard-run", { rules: SPEC, index: INDEX })
    const result = run(["orchard-run/../broken"])
    expect(result.status).toBe(2)
    expect(result.err).toContain("is not a slug")
  })
})

import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { CONTENT_DIR } from "./config.ts"
import { OLD_BARE, OLD_CATEGORY, OLD_HANABI } from "./migration/translations-fixtures.ts"

// The command is run as Node runs it. Only what needs no token and touches no dataset: the help, the wrong command lines, and a plan against
// a file (a run without `--from` would read the dataset with the token of whoever runs the tests). The plan itself and the stores are tested in
// `migration/`.

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(CONTENT_DIR, "migrate-translations.ts"), ...args], {
    encoding: "utf8",
    timeout: 60_000,
    // no token, wherever the tests are run from
    env: { ...process.env, SANITY_API_WRITE_TOKEN_PLATFORM: "" },
  })

const dir = mkdtempSync(join(tmpdir(), "pbgo-translations-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe("the migration command", () => {
  it("says what it does and how to run it, and is a dry run unless it is asked to write", () => {
    const { status, stdout, stderr } = run("--help")
    expect(status).toBe(0)
    expect(stderr).toBe("")
    expect(stdout).toContain("Usage: node content/migrate-translations.ts [options]")
    expect(stdout).toContain("--dry-run      Read the dataset and print what would change, field by field. Writes nothing. This is the default.")
    expect(stdout).toContain("--apply        Write it, in one transaction")
    expect(stdout).toContain("sanity dataset export production")
    expect(stdout).toContain("--from <file>")
    expect(stdout).toContain("--show <id>")
    expect(stdout).toContain("It is never printed.")
  })

  it("refuses an option it does not know, a dry run that is also a write, a file that is written, and a file that is not named, before it touches anything", () => {
    for (const [args, message] of [
      [["--nope"], "Unknown option --nope"],
      [["somewhere"], 'Unexpected argument "somewhere"'],
      [["--apply", "--dry-run"], "--apply and --dry-run exclude each other"],
      [["--apply", "--from", "documents.json"], "--from reads a file, which is never written: it makes a dry run, --apply needs the dataset"],
      [["--from"], "--from needs the file to read"],
      [["--from", "--verbose"], "--from needs the file to read"],
      [["--show"], "--show needs the id of the document"],
    ] as const) {
      const { status, stdout, stderr } = run(...args)
      expect(status, args.join(" ")).toBe(1)
      expect(stdout).toBe("")
      expect(stderr).toContain(`Error: ${message}`)
      expect(stderr).toContain("Run with --help for the options.")
    }
  })

  it("makes a dry run against a file with no token, and says it read the file", () => {
    const file = join(dir, "documents.json")
    writeFileSync(file, JSON.stringify([OLD_HANABI, OLD_BARE, OLD_CATEGORY]))
    const { status, stdout, stderr } = run("--from", file)
    expect(stderr).toBe("")
    expect(status).toBe(0)
    expect(stdout).toContain("DRY RUN, nothing is written")
    expect(stdout).toContain(`Read from ${file}, not from the dataset.`)
    expect(stdout).toContain("3 documents to convert, 0 already as they should be.")
    expect(stdout).toContain("game.rules  the old links → rows")
    expect(stdout).toContain("Links to the rules, by language: en 1, fr 1.")
    expect(stdout).not.toContain("game-hanabi  (game")
  })

  it("says each document with --verbose", () => {
    const file = join(dir, "documents.ndjson")
    writeFileSync(file, [OLD_HANABI, OLD_CATEGORY].map((doc) => JSON.stringify(doc)).join("\n"))
    const { status, stdout } = run("--from", file, "--verbose")
    expect(status).toBe(0)
    expect(stdout).toContain("game-hanabi  (game, published, revision rev-hanabi)")
    expect(stdout).toContain("category-cooperation  (category, published, revision rev-category)")
  })

  it("prints the patch of one document with --show", () => {
    const file = join(dir, "documents.json")
    writeFileSync(file, JSON.stringify([OLD_HANABI, OLD_CATEGORY]))
    const { status, stdout } = run("--from", file, "--show", "game-hanabi")
    expect(status).toBe(0)
    expect(stdout).toContain("The patch of game-hanabi, as it is sent:")
    expect(stdout).toContain('"ifRevisionID": "rev-hanabi"')
    expect(stdout).toContain('"unset": [')
  })

  it("exits 1 and lists what stops it when a document cannot be converted", () => {
    const file = join(dir, "odd.json")
    writeFileSync(file, JSON.stringify([{ ...OLD_BARE, description: 12 }]))
    const { status, stdout } = run("--from", file)
    expect(status).toBe(1)
    expect(stdout).toContain("Nothing can be converted until this is settled:")
    expect(stdout).toContain("game-bare: description: it holds 12")
  })

  it("reads a file that is not one as an error that says so, not as a stack trace", () => {
    const missing = run("--from", join(dir, "nope.json"))
    expect(missing.status).toBe(1)
    expect(missing.stderr).toMatch(/^Error: ENOENT/)
    expect(missing.stderr).not.toContain("    at ")
    const file = join(dir, "broken.json")
    writeFileSync(file, JSON.stringify([{ name: "no id" }]))
    expect(run("--from", file).stderr).toContain("Error: Entry 1 is not a document")
  })
})

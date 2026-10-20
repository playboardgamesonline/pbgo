import { spawnSync } from "node:child_process"
import { HELP } from "@pbgo/content-kit/seed"
import { describe, expect, it } from "vitest"
import { GAME_DIR } from "./config.ts"

// The command as a developer types it. Only the paths that end before the token is read are run here:
// a run that gets further would reach the real dataset.

const SEED = "content/seed.ts"

function seed(...args: string[]) {
  const env = { ...process.env }
  delete env.SANITY_API_WRITE_TOKEN_HANABI
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", SEED, ...args], { cwd: GAME_DIR, env, encoding: "utf8", timeout: 30_000 })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

describe("node content/seed.ts", () => {
  it.each([["--help"], ["-h"]])("answers %s with the usage and a success code, without touching the dataset", (flag) => {
    expect(seed(flag)).toEqual({ code: 0, out: `${HELP}\n`, err: "" })
  })

  it("answers --help even next to an option that would be refused alone", () => {
    const { code, out } = seed("--overwrite", "--help")
    expect(code).toBe(0)
    expect(out).toBe(`${HELP}\n`)
  })

  it.each<[string, string[], string]>([
    ["an option it does not know", ["--frobnicate"], "Error: Unknown option --frobnicate"],
    ["a word that is not an option", ["cards"], 'Error: Unexpected argument "cards"'],
    ["an option that needs a value and gets none", ["--only"], "Error: --only needs a value"],
    ["an option whose value looks like another option", ["--art-dir", "--apply"], "Error: --art-dir needs a value"],
    ["--apply together with --dry-run", ["--apply", "--dry-run"], "Error: --apply and --dry-run exclude each other"],
    ["--overwrite without --only", ["--overwrite"], "Error: --overwrite replaces what was edited in the Studio"],
  ])("refuses %s, says what is wrong and points to --help, with a failure code and nothing on the standard output", (_name, args, message) => {
    const { code, out, err } = seed(...args)
    expect(code).toBe(1)
    expect(out).toBe("")
    expect(err).toContain(message)
    expect(err.trimEnd().endsWith("Run with --help for the options.")).toBe(true)
    expect(err).not.toContain("    at ")
  })
})

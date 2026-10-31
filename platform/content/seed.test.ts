import { spawnSync } from "node:child_process"
import { HELP } from "@pbgo/content-kit/seed"
import { describe, expect, it } from "vitest"
import { PLATFORM_DIR } from "./config.ts"

// The commands as a developer types them, run by Node itself: this is also what shows that every file they load can be read with the
// types stripped (no enum, no parameter property). Only the paths that end before the token is read are run here: a run that gets
// further would reach Notion and the real dataset.

function run(script: string, ...args: string[]) {
  const env = { ...process.env }
  delete env.SANITY_API_WRITE_TOKEN_PLATFORM
  delete env.NOTION_API_KEY
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", script, ...args], { cwd: PLATFORM_DIR, env, encoding: "utf8", timeout: 60_000 })
  return { code: result.status, out: result.stdout, err: result.stderr }
}

describe("node content/seed.ts", () => {
  it.each([["--help"], ["-h"]])("answers %s with the usage and a success code, without touching Notion or the dataset", (flag) => {
    expect(run("content/seed.ts", flag)).toEqual({ code: 0, out: `${HELP}\n`, err: "" })
  })

  it("answers --help even next to an option that would be refused alone", () => {
    expect(run("content/seed.ts", "--overwrite", "--help")).toEqual({ code: 0, out: `${HELP}\n`, err: "" })
  })

  it.each<[string, string[], string]>([
    ["an option it does not know", ["--frobnicate"], "Error: Unknown option --frobnicate"],
    ["--apply together with --dry-run", ["--apply", "--dry-run"], "Error: --apply and --dry-run exclude each other"],
    ["--overwrite without --only", ["--overwrite"], "Error: --overwrite replaces what was edited in the Studio"],
  ])("refuses %s, says what is wrong and points to --help, with a failure code and nothing on the standard output", (_name, args, message) => {
    const { code, out, err } = run("content/seed.ts", ...args)
    expect(code).toBe(1)
    expect(out).toBe("")
    expect(err).toContain(message)
    expect(err).toContain("Run with --help for the options.")
  })
})

describe("node content/fetch-art.ts", () => {
  it.each([["--help"], ["-h"]])("answers %s with the usage and a success code, without touching Notion", (flag) => {
    const { code, out, err } = run("content/fetch-art.ts", flag)
    expect(code).toBe(0)
    expect(err).toBe("")
    expect(out).toContain("Usage: node content/fetch-art.ts --out <folder> [--apply]")
  })

  it.each<[string, string[], string]>([
    ["no folder", [], "Error: --out <folder> says where the pictures go"],
    ["an --out with no value", ["--out"], "Error: --out needs a folder"],
    ["an --out whose value looks like an option", ["--out", "--apply"], "Error: --out needs a folder"],
    ["an option it does not know", ["--out", "somewhere", "--frobnicate"], "Error: Unknown option --frobnicate"],
    ["a word that is not an option", ["--out", "somewhere", "pictures"], 'Error: Unexpected argument "pictures"'],
    ["--apply together with --dry-run", ["--out", "somewhere", "--apply", "--dry-run"], "Error: --apply and --dry-run exclude each other"],
  ])("refuses %s, with a failure code and nothing on the standard output", (_name, args, message) => {
    const { code, out, err } = run("content/fetch-art.ts", ...args)
    expect(code).toBe(1)
    expect(out).toBe("")
    expect(err).toContain(message)
  })

  it("asks for the Notion token before it reads anything, and names the variable, never a value", () => {
    const { code, out, err } = run("content/fetch-art.ts", "--out", "somewhere")
    expect(code).toBe(1)
    expect(out).toBe("")
    expect(err).toContain("NOTION_API_KEY is not set")
  })
})

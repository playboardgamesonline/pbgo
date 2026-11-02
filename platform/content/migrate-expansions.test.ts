import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CONTENT_DIR } from "./config.ts"

// The command is run as Node runs it. Only what happens before the token is read: the help and the wrong command lines, which touch no
// dataset. The plan and the store are tested in `migration/`.

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(CONTENT_DIR, "migrate-expansions.ts"), ...args], { encoding: "utf8", timeout: 60_000 })

describe("the migration command", () => {
  it("says what it does and how to run it, and is a dry run unless it is asked to write", () => {
    const { status, stdout, stderr } = run("--help")
    expect(status).toBe(0)
    expect(stderr).toBe("")
    expect(stdout).toContain("Usage: node content/migrate-expansions.ts [options]")
    expect(stdout).toContain("--dry-run   Read the dataset and print exactly what would change. Writes nothing. This is the default.")
    expect(stdout).toContain("--apply     Write it, in one transaction")
    expect(stdout).toContain("It is never printed.")
  })

  it("refuses an option it does not know, and a dry run that is also a write, before it touches anything", () => {
    for (const [args, message] of [
      [["--nope"], "Unknown option --nope"],
      [["somewhere"], 'Unexpected argument "somewhere"'],
      [["--apply", "--dry-run"], "--apply and --dry-run exclude each other"],
    ] as const) {
      const { status, stdout, stderr } = run(...args)
      expect(status, args.join(" ")).toBe(1)
      expect(stdout).toBe("")
      expect(stderr).toContain(`Error: ${message}`)
      expect(stderr).toContain("Run with --help for the options.")
    }
  })
})

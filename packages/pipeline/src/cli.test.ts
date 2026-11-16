import { describe, expect, it } from "vitest"
import { parseCli } from "./cli.ts"

describe("the command line of the pipeline", () => {
  it("takes the name, with or without quotes, and the flags", () => {
    expect(parseCli(["Love Letter"])).toEqual({ kind: "run", options: { name: "Love Letter", dryRun: false, yes: false, noLinear: false, newSession: false, redo: null } })
    expect(parseCli(["Love", "Letter", "--dry-run", "-y", "--no-linear", "--new-session"])).toEqual({
      kind: "run",
      options: { name: "Love Letter", dryRun: true, yes: true, noLinear: true, newSession: true, redo: null },
    })
    expect(parseCli(["Love Letter", "--redo", "catalog-entry"])).toMatchObject({ kind: "run", options: { redo: "catalog-entry" } })
  })

  it("has the commands that take no name", () => {
    expect(parseCli(["--list"])).toEqual({ kind: "list" })
    expect(parseCli(["--check"])).toEqual({ kind: "check" })
    expect(parseCli(["--help"])).toEqual({ kind: "help" })
    expect(parseCli(["Love Letter", "-h"])).toEqual({ kind: "help" })
  })

  it("asks for a name, and a step that exists", () => {
    expect(parseCli([])).toMatchObject({ kind: "error" })
    expect(parseCli(["Love Letter", "--redo", "nonsense"])).toMatchObject({ kind: "error", message: expect.stringContaining("scout") })
  })

  it("says that the flags of the script that makes the folder are not this command's", () => {
    const parsed = parseCli(["Love Letter", "--rules", "en=x.pdf"])
    expect(parsed).toMatchObject({ kind: "error" })
    expect(parsed.kind === "error" && parsed.message).toContain("--rules")
  })
})

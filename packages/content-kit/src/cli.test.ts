import { describe, expect, it } from "vitest"
import { HELP, parseCli, UsageError } from "./cli.ts"

const usage = (argv: string[]) => {
  try {
    parseCli(argv)
  } catch (error) {
    return error
  }
  return undefined
}

describe("parseCli", () => {
  it("is a dry run that writes nothing by default", () => {
    expect(parseCli([])).toEqual({ apply: false, overwrite: false, only: [], verbose: false, help: false })
  })

  it("accepts --dry-run, which is what the default already is", () => {
    expect(parseCli(["--dry-run"]).apply).toBe(false)
  })

  it("writes only when asked to with --apply", () => {
    expect(parseCli(["--apply"]).apply).toBe(true)
  })

  it("refuses --apply together with --dry-run, in any order", () => {
    expect(usage(["--apply", "--dry-run"])).toBeInstanceOf(UsageError)
    expect((usage(["--dry-run", "--apply"]) as Error).message).toBe("--apply and --dry-run exclude each other")
  })

  it("ignores the -- that pnpm forwards", () => {
    expect(parseCli(["--", "--dry-run"])).toEqual(parseCli(["--dry-run"]))
    expect(parseCli(["--", "--apply"]).apply).toBe(true)
  })

  it("only skips a -- at the very start", () => {
    expect(usage(["--apply", "--", "--dry-run"])).toBeInstanceOf(UsageError)
  })

  it.each([
    ["--verbose", "verbose"],
    ["-v", "verbose"],
    ["--help", "help"],
    ["-h", "help"],
  ] as const)("reads %s", (flag, key) => {
    expect(parseCli([flag])[key]).toBe(true)
  })

  describe("--art-dir", () => {
    it("takes the next argument or a value after =", () => {
      expect(parseCli(["--art-dir", "assets/art"]).artDir).toBe("assets/art")
      expect(parseCli(["--art-dir=assets/art"]).artDir).toBe("assets/art")
    })

    it("keeps a path that has an equal sign in it", () => {
      expect(parseCli(["--art-dir=a=b"]).artDir).toBe("a=b")
    })

    it("has no folder when it is not given", () => {
      expect(parseCli(["--apply"]).artDir).toBeUndefined()
    })

    it.each([[["--art-dir"]], [["--art-dir="]], [["--art-dir", "--apply"]], [["--art-dir", "-v"]]])("needs a value: %j", (argv) => {
      expect((usage(argv) as Error).message).toBe("--art-dir needs a value")
    })
  })

  describe("--only", () => {
    it("takes ids and types separated by commas", () => {
      expect(parseCli(["--only", "rules,settings"]).only).toEqual(["rules", "settings"])
      expect(parseCli(["--only=rules,settings"]).only).toEqual(["rules", "settings"])
    })

    it("trims the tokens and drops the empty ones", () => {
      expect(parseCli(["--only", " rules , ,settings,"]).only).toEqual(["rules", "settings"])
    })

    it("can be repeated", () => {
      expect(parseCli(["--only", "rules", "--only=settings,card"]).only).toEqual(["rules", "settings", "card"])
    })

    it.each([[["--only"]], [["--only="]], [["--only", "--apply"]]])("needs a value: %j", (argv) => {
      expect((usage(argv) as Error).message).toBe("--only needs a value")
    })
  })

  describe("--overwrite", () => {
    it("is refused without --only: it must name what it replaces", () => {
      const error = usage(["--overwrite"])
      expect(error).toBeInstanceOf(UsageError)
      expect((error as Error).message).toBe("--overwrite replaces what was edited in the Studio: say which documents with --only")
    })

    it("is refused when --only has nothing in it", () => {
      expect(usage(["--overwrite", "--only", ","])).toBeInstanceOf(UsageError)
    })

    it("is accepted with --only, wherever the flags are", () => {
      expect(parseCli(["--overwrite", "--only", "rules"])).toMatchObject({ overwrite: true, only: ["rules"] })
      expect(parseCli(["--only", "rules", "--overwrite"])).toMatchObject({ overwrite: true, only: ["rules"] })
    })

    it("lets --help through, so that the options can be read", () => {
      expect(parseCli(["--overwrite", "--help"])).toMatchObject({ help: true, overwrite: true })
    })
  })

  describe("what is not understood", () => {
    it("names an unknown option", () => {
      const error = usage(["--force"])
      expect(error).toBeInstanceOf(UsageError)
      expect((error as Error).message).toBe("Unknown option --force")
    })

    it("names an unknown option written with a value", () => {
      expect((usage(["--force=1"]) as Error).message).toBe("Unknown option --force")
    })

    it("does not know the short forms it does not list", () => {
      expect((usage(["-x"]) as Error).message).toBe("Unknown option -x")
    })

    it("refuses a loose argument, so that a forgotten -- is noticed", () => {
      expect((usage(["rules"]) as Error).message).toBe('Unexpected argument "rules"')
    })

    it("reports the first problem it meets", () => {
      expect((usage(["--nope", "--art-dir"]) as Error).message).toBe("Unknown option --nope")
    })
  })

  it("never modifies the array it reads", () => {
    const argv = ["--", "--only", "rules", "--apply"]
    const copy = [...argv]
    parseCli(argv)
    expect(argv).toEqual(copy)
  })
})

describe("UsageError", () => {
  it("is an Error that the seed can tell from a failure", () => {
    const error = new UsageError("nope")
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(UsageError)
    expect(error.message).toBe("nope")
    expect(new Error("nope")).not.toBeInstanceOf(UsageError)
  })
})

describe("HELP", () => {
  it.each(["--dry-run", "--apply", "--art-dir", "--only", "--overwrite", "--verbose", "--help"])("documents %s", (flag) => {
    expect(HELP).toContain(flag)
  })

  it("promises drafts and says where the token comes from, without a token in it", () => {
    expect(HELP).toContain("DRAFTS")
    expect(HELP).toContain("SANITY_API_WRITE_TOKEN_<SLUG>")
    expect(HELP).toContain("never printed")
    expect(HELP).not.toMatch(/\bsk[A-Za-z0-9]{20,}/)
  })

  it("accepts every flag it documents", () => {
    const documented = [...HELP.matchAll(/^\s{2}(--[a-z-]+)/gm)].map((match) => match[1] as string)
    expect(documented).toEqual(["--dry-run", "--apply", "--art-dir", "--only", "--overwrite", "--verbose", "--help"])
    for (const flag of documented) {
      const argv = flag === "--art-dir" || flag === "--only" ? [flag, "x"] : flag === "--overwrite" ? [flag, "--only", "x"] : [flag]
      expect(() => parseCli(argv)).not.toThrow()
    }
  })
})

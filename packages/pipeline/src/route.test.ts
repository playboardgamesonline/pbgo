import { describe, expect, it } from "vitest"
import { routeArgs } from "./route.ts"

describe("which behaviour of pnpm add-game", () => {
  it("starts the pipeline for a name, which is not a slug", () => {
    expect(routeArgs(["Love Letter"])).toBe("pipeline")
    expect(routeArgs(["Skyjo"])).toBe("pipeline")
    expect(routeArgs(["6 nimmt!"])).toBe("pipeline")
    expect(routeArgs(["Love Letter", "--dry-run"])).toBe("pipeline")
    expect(routeArgs(["--yes", "The Crew"])).toBe("pipeline")
  })

  it("takes two words for a name typed without quotes", () => {
    expect(routeArgs(["take", "5"])).toBe("pipeline")
    expect(routeArgs(["Take", "5"])).toBe("pipeline")
  })

  it("runs the script that makes the folder for a slug, no argument, or its flags", () => {
    expect(routeArgs([])).toBe("plumbing")
    expect(routeArgs(["the-crew"])).toBe("plumbing")
    expect(routeArgs(["trio", "--dry-run"])).toBe("plumbing")
    expect(routeArgs(["--name", "The Crew", "the-crew", "--rules", "en=rules.pdf"])).toBe("plumbing")
    expect(routeArgs(["--name=The Crew"])).toBe("plumbing")
    expect(routeArgs(["the-crew", "--push", "--no-open", "--yes"])).toBe("plumbing")
    expect(routeArgs(["--help"])).toBe("plumbing")
  })

  it("starts the pipeline for its own flags, with or without a name", () => {
    expect(routeArgs(["--list"])).toBe("pipeline")
    expect(routeArgs(["--check"])).toBe("pipeline")
    expect(routeArgs(["--redo", "scout", "Love Letter"])).toBe("pipeline")
    expect(routeArgs(["--redo=scout", "Love Letter"])).toBe("pipeline")
    expect(routeArgs(["the-crew", "--no-linear"])).toBe("pipeline")
    expect(routeArgs(["Love Letter", "--new-session"])).toBe("pipeline")
  })

  it("does not take the value of a flag for the name", () => {
    expect(routeArgs(["--name", "The Crew"])).toBe("plumbing")
    expect(routeArgs(["--rules", "Rules File.pdf", "the-crew"])).toBe("plumbing")
  })

  it("reads what follows -- as words", () => {
    expect(routeArgs(["--", "Love Letter"])).toBe("pipeline")
    expect(routeArgs(["--", "the-crew"])).toBe("plumbing")
  })
})

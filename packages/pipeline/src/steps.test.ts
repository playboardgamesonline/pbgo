import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { REPO_ROOT } from "./config.ts"
import { CATALOG_ENTRY, ENGINE_BOARD, ENGINE_RULES, firstOpen, GAME_ASSETS, GAME_GO_LIVE, GAME_NEW, GAME_SANITY_CREATE, gameAt, gameOf, PLATFORM_ASSETS, RULES_SPEC, SCOUT, STEPS, stepById } from "./steps.ts"

const game = gameOf("/assets", "Love Letter", "love-letter")

describe("the steps", () => {
  it("are the scout, the catalog entry, the rules spec, the platform assets, the game folder, the studio forms, the game assets, the engine, the board and going live, each with the skill that is in the repo", () => {
    expect(STEPS.map((step) => step.id)).toEqual(["scout", "catalog-entry", "rules-spec", "platform-assets", "game-new", "game-sanity-create", "game-assets", "engine-rules", "engine-board", "game-go-live"])
    for (const step of STEPS) expect(existsSync(join(REPO_ROOT, step.skillFile)), step.skillFile).toBe(true)
    expect(new Set(STEPS.map((step) => step.id)).size).toBe(STEPS.length)
    expect(stepById("engine-board")).toBe(ENGINE_BOARD)
    expect(stepById("nope")).toBeUndefined()
  })

  it("give their skill the argument it needs, the scout file where the flow keeps it", () => {
    expect(game).toEqual({ name: "Love Letter", slug: "love-letter", dir: "/assets/love-letter", scoutFile: "/assets/love-letter/scout.json", rulesPdf: "/assets/love-letter/rules.pdf", picturesDir: "/assets/love-letter/platform", folder: false })
    expect(SCOUT.args(game)).toBe("Love Letter --out /assets/love-letter/scout.json")
    // a game that has its folder in the repo is scouted as it is, and keeps its slug
    const built = gameAt("/assets/love-letter", "Love Letter", "love-letter", true)
    expect(SCOUT.args(built)).toBe("Love Letter --out /assets/love-letter/scout.json --existing")
    expect(SCOUT.notes(built).join(" ")).toContain("with `--existing`, and its slug stays `love-letter`")
    expect(CATALOG_ENTRY.args(game)).toBe("/assets/love-letter/scout.json")
    expect(RULES_SPEC.args(game)).toBe("/assets/love-letter/scout.json")
    expect(PLATFORM_ASSETS.args(game)).toBe("/assets/love-letter/scout.json")
    expect(GAME_ASSETS.args(game)).toBe("love-letter")
    expect(GAME_SANITY_CREATE.args(game)).toBe("love-letter")
    expect(ENGINE_RULES.args(game)).toBe("love-letter")
    expect(ENGINE_BOARD.args(game)).toBe("love-letter")
    expect(GAME_GO_LIVE.args(game)).toBe("love-letter")
    // the game folder carries what the flow knows: the name, the rulebook, the rules spec
    expect(GAME_NEW.args(game)).toBe('love-letter (the game is called "Love Letter"; its rulebook is the PDF at /assets/love-letter/rules.pdf when there is one; its rules spec, when there is one, is docs/games/love-letter/)')
  })

  it("have a gate for the work and, for the catalog entry, one more for the word that makes it public", () => {
    expect(SCOUT.gates).toEqual(["validate"])
    expect(CATALOG_ENTRY.gates).toEqual(["validate", "publish"])
    for (const step of STEPS.filter((each) => each !== CATALOG_ENTRY)) expect(step.gates, step.id).toEqual(["validate"])
  })

  it("say which of them make the game's folder in the repo and which wait for it: the game folder makes it, the five after it wait, the four before do not", () => {
    expect(STEPS.map((step) => [step.id, step.needsFolder === true, step.makesFolder === true])).toEqual([
      ["scout", false, false],
      ["catalog-entry", false, false],
      ["rules-spec", false, false],
      ["platform-assets", false, false],
      ["game-new", false, true],
      ["game-sanity-create", true, false],
      ["game-assets", true, false],
      ["engine-rules", true, false],
      ["engine-board", true, false],
      ["game-go-live", true, false],
    ])
  })

  it("are checked by the machine as each skill says: the scout file, the published documents, the spec, the pictures, the folder, the forms alone, the art, then the engine, the board and going live up to that stage", () => {
    expect(STEPS.map((step) => step.check)).toEqual([
      { kind: "scout" },
      { kind: "published" },
      { kind: "rules" },
      { kind: "pictures" },
      { kind: "stage", gate: { stage: "scaffold" } },
      { kind: "stage", gate: { stage: "content", only: true } },
      { kind: "art" },
      { kind: "stage", gate: { stage: "engine" } },
      { kind: "stage", gate: { stage: "board" } },
      { kind: "stage", gate: { stage: "live" } },
    ])
  })

  it("do something more of the owner's ok when it is the scout's (the folder follows the slug) or the spec's (the page is stamped)", () => {
    expect(STEPS.flatMap((step) => (step.onValidate ? [[step.id, step.onValidate]] : []))).toEqual([["scout", "settle-scout"], ["rules-spec", "stamp-rules"]])
  })

  it("belong to the lane of the agent that does the job: the engine's to the engine lane", () => {
    expect(STEPS.map((step) => [step.id, step.lane])).toEqual([
      ["scout", "Game lane"],
      ["catalog-entry", "Platform lane"],
      ["rules-spec", "Game lane"],
      ["platform-assets", "Platform lane"],
      ["game-new", "Game lane"],
      ["game-sanity-create", "Game lane"],
      ["game-assets", "Game lane"],
      ["engine-rules", "Engine lane"],
      ["engine-board", "Engine lane"],
      ["game-go-live", "Game lane"],
    ])
  })

  it("name the first step that is not validated", () => {
    expect(firstOpen(() => false)?.id).toBe("scout")
    expect(firstOpen((id) => id === "scout")?.id).toBe("catalog-entry")
    expect(firstOpen((id) => id !== "rules-spec")?.id).toBe("rules-spec")
    expect(firstOpen((id) => id !== "platform-assets")?.id).toBe("platform-assets")
    expect(firstOpen((id) => id !== "game-assets")?.id).toBe("game-assets")
    expect(firstOpen(() => true)).toBeUndefined()
  })
})

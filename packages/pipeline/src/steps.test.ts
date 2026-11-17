import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { REPO_ROOT } from "./config.ts"
import { PLATFORM_SANITY } from "./policy.ts"
import { allowedTools, CATALOG_ENTRY, ENGINE_BOARD, ENGINE_RULES, firstOpen, GAME_ASSETS, GAME_GO_LIVE, GAME_NEW, GAME_SANITY_CREATE, gameOf, PLATFORM_ASSETS, RULES_SPEC, SCOUT, STEPS } from "./steps.ts"

const game = gameOf("/assets", "Love Letter", "love-letter")
const extras = { composioServer: "claude_ai_Composio", publishIds: [], gamesDocs: "/repo/docs/games" }

describe("the steps", () => {
  it("are the scout, the catalog entry, the rules spec, the platform assets, the game folder, the studio forms, the game assets, the engine, the board and going live, each with the skill that is in the repo", () => {
    expect(STEPS.map((step) => step.id)).toEqual(["scout", "catalog-entry", "rules-spec", "platform-assets", "game-new", "game-sanity-create", "game-assets", "engine-rules", "engine-board", "game-go-live"])
    for (const step of STEPS) expect(existsSync(join(REPO_ROOT, step.skillFile)), step.skillFile).toBe(true)
    expect(new Set(STEPS.map((step) => step.id)).size).toBe(STEPS.length)
  })

  it("run their skill as a slash command, the scout file where the command keeps it", () => {
    expect(game).toEqual({ name: "Love Letter", slug: "love-letter", dir: "/assets/love-letter", scoutFile: "/assets/love-letter/scout.json", rulesPdf: "/assets/love-letter/rules.pdf", picturesDir: "/assets/love-letter/platform" })
    expect(SCOUT.prompt(game)).toBe("/game-scout Love Letter --out /assets/love-letter/scout.json")
    expect(CATALOG_ENTRY.prompt(game)).toBe("/platform-catalog-entry /assets/love-letter/scout.json")
    expect(RULES_SPEC.prompt(game)).toBe("/game-rules-spec /assets/love-letter/scout.json")
    expect(PLATFORM_ASSETS.prompt(game)).toBe("/platform-assets /assets/love-letter/scout.json")
    expect(GAME_ASSETS.prompt(game)).toBe("/game-assets love-letter")
    expect(GAME_SANITY_CREATE.prompt(game)).toBe("/game-sanity-create love-letter")
    expect(ENGINE_RULES.prompt(game)).toBe("/engine-rules love-letter")
    expect(ENGINE_BOARD.prompt(game)).toBe("/engine-board love-letter")
    expect(GAME_GO_LIVE.prompt(game)).toBe("/game-go-live love-letter")
    // the first message of the game folder carries what the command knows: the name, the rulebook it fetched, the rules spec
    expect(GAME_NEW.prompt(game)).toBe('/game-new love-letter (the game is called "Love Letter"; its rulebook is the PDF at /assets/love-letter/rules.pdf when the command could fetch it; its rules spec, when there is one, is docs/games/love-letter/)')
  })

  it("are headless calls, but for the pictures: a session of the owner's, which has no policy and no list of tools", () => {
    expect(STEPS.map((step) => step.mode)).toEqual(["headless", "headless", "headless", "session", "session", "session", "session", "session", "session", "session"])
    expect(PLATFORM_ASSETS.mode).toBe("session")
    expect(PLATFORM_ASSETS.folder?.(game)).toBe("/assets/love-letter/platform")
    expect(PLATFORM_ASSETS.lane).toBe("Platform lane")
    expect(GAME_ASSETS.mode).toBe("session")
    expect(GAME_ASSETS.lane).toBe("Game lane")
    // the art folder of the game is its folder of working files, outside the repo: the seed reads it there
    expect(GAME_ASSETS.folder?.(game)).toBe("/assets/love-letter")
    expect(Object.keys(PLATFORM_ASSETS).sort()).toEqual(["folder", "gates", "id", "lane", "mode", "prompt", "skill", "skillFile", "title"])
    expect(Object.keys(GAME_NEW).sort()).toEqual(["gate", "gates", "id", "lane", "makesFolder", "mode", "prompt", "skill", "skillFile", "title"])
  })

  it("have a gate for the work and, for the catalog entry, one more for the word that makes it public", () => {
    expect(SCOUT.gates).toEqual(["validate"])
    expect(CATALOG_ENTRY.gates).toEqual(["validate", "publish"])
    expect(RULES_SPEC.gates).toEqual(["validate"])
    expect(PLATFORM_ASSETS.gates).toEqual(["validate"])
    expect(GAME_ASSETS.gates).toEqual(["validate"])
  })

  it("say which of them make the game's folder in the repo and which wait for it: the game folder makes it, the five after it wait, the four before do not", () => {
    expect(STEPS.map((step) => [step.id, step.needsFolder === true, step.mode === "session" && step.makesFolder === true])).toEqual([
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

  it("are gated by the stage of the game that each leaves: the folder, the forms alone, then the engine, the board and going live up to that stage", () => {
    const gates = STEPS.flatMap((step) => (step.mode === "session" && step.gate ? [[step.id, step.gate.stage, step.gate.only === true]] : []))
    expect(gates).toEqual([["game-new", "scaffold", false], ["game-sanity-create", "content", true], ["engine-rules", "engine", false], ["engine-board", "board", false], ["game-go-live", "live", false]])
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

  it("allow by name the read-only tools, and Composio's lookup tools to the step that uses Composio, never its executor", () => {
    expect(allowedTools(SCOUT, "mcp__claude_ai_Composio__")).toEqual(["ToolSearch", "WebSearch", "WebFetch"])
    const tools = allowedTools(CATALOG_ENTRY, "mcp__claude_ai_Composio__")
    expect(tools).toEqual(["ToolSearch", "WebSearch", "WebFetch", "mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS", "mcp__claude_ai_Composio__COMPOSIO_GET_TOOL_SCHEMAS"])
    expect(tools.join(" ")).not.toContain("MULTI_EXECUTE")
    expect(tools.join(" ")).not.toMatch(/\b(Write|Edit|Bash)\b/)
    expect(allowedTools(RULES_SPEC, "mcp__claude_ai_Composio__")).toEqual(["ToolSearch", "WebSearch", "WebFetch"])
  })

  it("write the scout file and no other, and the catalog entry no file at all", () => {
    expect(SCOUT.policy(game, "/repo", extras)).toMatchObject({ repoRoot: "/repo", workDir: "/assets/love-letter", writeFiles: ["/assets/love-letter/scout.json"], readFiles: ["/assets/love-letter/scout.json"], composio: null })
    expect(CATALOG_ENTRY.policy(game, "/repo", extras)).toMatchObject({ writeFiles: [], readFiles: ["/assets/love-letter/scout.json"] })
  })

  it("lets the rules spec write the two pages of its game in the docs and read its scout file and its rulebook, and use no Composio", () => {
    expect(RULES_SPEC.policy(game, "/repo", extras)).toMatchObject({
      repoRoot: "/repo",
      workDir: "/assets/love-letter",
      writeFiles: ["/repo/docs/games/love-letter/rules.md", "/repo/docs/games/love-letter/index.md"],
      readFiles: ["/assets/love-letter/scout.json", "/assets/love-letter/rules.pdf"],
      composio: null,
    })
    expect(RULES_SPEC.composio).toBe(false)
    expect(RULES_SPEC.lane).toBe("Game lane")
    // the folder of the specs follows the settings: a test's world, not the checkout's docs
    expect(RULES_SPEC.policy(game, "/repo", { ...extras, gamesDocs: "/tmp/world/docs-games" }).writeFiles).toEqual(["/tmp/world/docs-games/love-letter/rules.md", "/tmp/world/docs-games/love-letter/index.md"])
  })

  it("reach the platform's Sanity and nothing else, the documents the gate showed being the only ones to publish", () => {
    expect(CATALOG_ENTRY.policy(game, "/repo", extras).composio).toEqual({
      server: "claude_ai_Composio",
      slugs: ["SANITY_QUERY_DOCUMENTS", "SANITY_MUTATE_DOCUMENTS"],
      sanity: { ...PLATFORM_SANITY, gameSlug: "love-letter", publishIds: [] },
      linear: null,
    })
    const publishing = CATALOG_ENTRY.policy(game, "/repo", { composioServer: "claude_ai_Composio", publishIds: ["game-love-letter"], gamesDocs: "/repo/docs/games" })
    expect(publishing.composio?.sanity?.publishIds).toEqual(["game-love-letter"])
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

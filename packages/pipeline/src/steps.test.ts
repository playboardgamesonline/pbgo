import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { REPO_ROOT } from "./config.ts"
import { PLATFORM_SANITY } from "./policy.ts"
import { allowedTools, CATALOG_ENTRY, firstOpen, gameOf, RULES_SPEC, SCOUT, STEPS } from "./steps.ts"

const game = gameOf("/assets", "Love Letter", "love-letter")
const extras = { composioServer: "claude_ai_Composio", publishIds: [], gamesDocs: "/repo/docs/games" }

describe("the steps", () => {
  it("are the scout, the catalog entry, then the rules spec, each with the skill that is in the repo", () => {
    expect(STEPS.map((step) => step.id)).toEqual(["scout", "catalog-entry", "rules-spec"])
    for (const step of STEPS) expect(existsSync(join(REPO_ROOT, step.skillFile)), step.skillFile).toBe(true)
    expect(new Set(STEPS.map((step) => step.id)).size).toBe(STEPS.length)
  })

  it("run their skill as a slash command, the scout file where the command keeps it", () => {
    expect(game).toEqual({ name: "Love Letter", slug: "love-letter", dir: "/assets/love-letter", scoutFile: "/assets/love-letter/scout.json", rulesPdf: "/assets/love-letter/rules.pdf" })
    expect(SCOUT.prompt(game)).toBe("/game-scout Love Letter --out /assets/love-letter/scout.json")
    expect(CATALOG_ENTRY.prompt(game)).toBe("/platform-catalog-entry /assets/love-letter/scout.json")
    expect(RULES_SPEC.prompt(game)).toBe("/game-rules-spec /assets/love-letter/scout.json")
  })

  it("have a gate for the work and, for the catalog entry, one more for the word that makes it public", () => {
    expect(SCOUT.gates).toEqual(["validate"])
    expect(CATALOG_ENTRY.gates).toEqual(["validate", "publish"])
    expect(RULES_SPEC.gates).toEqual(["validate"])
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
    expect(firstOpen(() => true)).toBeUndefined()
  })
})

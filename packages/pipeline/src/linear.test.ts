import { describe, expect, it } from "vitest"
import { applyResult, buildOrder, LINEAR, linearPrompt, linearPolicy, LINEAR_SCHEMA, LINEAR_SLUGS, validationComment, type WorkOrder } from "./linear.ts"
import { newState, stepOf, type PipelineState } from "./state.ts"
import { gameOf, STEPS } from "./steps.ts"

const game = gameOf("/assets", "Love Letter", "love-letter")
const NOW = new Date("2026-11-16T10:00:00Z")
const fresh = (): PipelineState => newState({ name: "Love Letter", slug: "love-letter", sessionId: "s", now: NOW })
const label = (path: string) => path
const order = (state: PipelineState): WorkOrder => {
  const built = buildOrder(state, STEPS, game, label)
  if (!built) throw new Error("no order")
  return built
}
const answer = (keys: string[], states: Record<string, string> = {}, commented: string[] = []) => ({
  labelId: "label-1",
  issues: keys.map((key, index) => ({ key, id: `id-${key}`, identifier: `GAM-${41 + index}`, url: `https://linear.app/x/issue/GAM-${41 + index}`, state: states[key] ?? "Todo", ...(commented.includes(key) ? { commented: true } : {}) })),
})

describe("what Linear should say", () => {
  it("is a parent and a sub-issue per step, the first step In Progress and the next Todo, when the game starts", () => {
    const made = order(fresh())
    expect(made.game).toEqual({ name: "Love Letter", slug: "love-letter" })
    expect(made.label).toEqual({ name: "Love Letter", id: null })
    expect(made.issues.map((issue) => [issue.key, issue.wantTitle, issue.wantState, issue.id, issue.lane])).toEqual([
      ["parent", "Love Letter: add the game", "In Progress", null, null],
      ["scout", "Love Letter: scout", "In Progress", null, "Game lane"],
      ["catalog-entry", "Love Letter: catalog entry", "Todo", null, "Platform lane"],
      ["rules-spec", "Love Letter: rules spec", "Todo", null, "Game lane"],
      ["platform-assets", "Love Letter: platform assets", "Todo", null, "Platform lane"],
      ["game-assets", "Love Letter: game assets", "Todo", null, "Game lane"],
    ])
    expect(made.issues.every((issue) => issue.comment === null)).toBe(true)
  })

  it("is written into the state from the answer, and then says nothing more", () => {
    const state = fresh()
    const made = order(state)
    expect(applyResult(state, answer(["parent", "scout", "catalog-entry", "rules-spec", "platform-assets", "game-assets"], { parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }), made)).toEqual([])
    expect(state.linear.parent).toMatchObject({ id: "id-parent", identifier: "GAM-41", title: "Love Letter: add the game", applied: "In Progress", commented: false })
    expect(state.linear.labelId).toBe("label-1")
    expect(stepOf(state, "scout").issue).toMatchObject({ identifier: "GAM-42", applied: "In Progress" })
    expect(buildOrder(state, STEPS, game, label)).toBeNull()
  })

  it("moves the next step to In Progress and comments the one that was validated, once", () => {
    const state = fresh()
    applyResult(state, answer(["parent", "scout", "catalog-entry", "rules-spec", "platform-assets", "game-assets"], { parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }), order(state))
    const scout = stepOf(state, "scout")
    scout.status = "validated"
    scout.validatedAt = "2026-11-16T10:05:00.000Z"
    scout.rounds = 2
    scout.links = ["https://example.com/page"]
    const made = order(state)
    const byKey = Object.fromEntries(made.issues.map((issue) => [issue.key, issue]))
    expect(byKey.scout).toMatchObject({ wantState: "Done", state: "In Progress", id: "id-scout" })
    expect(byKey.scout?.comment).toContain("Validated on 2026-11-16")
    expect(byKey.scout?.comment).toContain("2 rounds")
    expect(byKey.scout?.comment).toContain("- https://example.com/page")
    expect(byKey["catalog-entry"]).toMatchObject({ wantState: "In Progress", state: "Todo" })
    expect(byKey.parent).toMatchObject({ wantState: "In Progress", state: "In Progress" })
    applyResult(state, answer(["scout", "catalog-entry"], { scout: "Done", "catalog-entry": "In Progress" }, ["scout"]), made)
    expect(buildOrder(state, STEPS, game, label)).toBeNull()
    expect(stepOf(state, "scout").issue?.commented).toBe(true)
  })

  it("renames the issues when the scout settled another name", () => {
    const state = fresh()
    applyResult(state, answer(["parent", "scout", "catalog-entry", "rules-spec", "platform-assets", "game-assets"], { parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }), order(state))
    state.name = "6 nimmt!"
    const made = order(state)
    expect(made.issues.map((issue) => issue.wantTitle)).toEqual(["6 nimmt!: add the game", "6 nimmt!: scout", "6 nimmt!: catalog entry", "6 nimmt!: rules spec", "6 nimmt!: platform assets", "6 nimmt!: game assets"])
    expect(made.issues.every((issue) => issue.id !== null)).toBe(true)
  })

  it("leaves the parent open when every step is validated", () => {
    const state = fresh()
    for (const step of STEPS) stepOf(state, step.id).status = "validated"
    const made = order(state)
    expect(made.issues.map((issue) => issue.wantState)).toEqual(["In Progress", "Done", "Done", "Done", "Done", "Done"])
  })

  it("tells what the answer lacks", () => {
    const state = fresh()
    expect(applyResult(state, answer(["parent", "scout"]), order(state))).toEqual(["no issue came back for catalog-entry", "no issue came back for rules-spec", "no issue came back for platform-assets", "no issue came back for game-assets"])
    expect(applyResult(state, "nope", order(state))).toEqual(["the answer is not an object"])
  })

  it("says where the rules spec is in the comment of its validation: in the checkout, uncommitted", () => {
    const state = fresh()
    const step = STEPS[2]
    if (!step) throw new Error("no step")
    const s = stepOf(state, "rules-spec")
    s.validatedAt = "2026-11-17T08:00:00.000Z"
    s.rounds = 2
    expect(step.id).toBe("rules-spec")
    expect(validationComment(state, step, game, label)).toBe(
      'Validated on 2026-11-17 at the gate of `pnpm add-game "Love Letter"` (2 rounds).\nRules spec: docs/games/love-letter/rules.md (in the checkout, uncommitted: the game\'s first pull request takes it)',
    )
  })

  it("says what a comment holds: when, how many rounds, the links", () => {
    const state = fresh()
    const step = STEPS[1]
    if (!step) throw new Error("no step")
    const s = stepOf(state, "catalog-entry")
    s.validatedAt = "2026-11-17T08:00:00.000Z"
    s.rounds = 1
    s.links = ["https://pbgo.sanity.studio/intent/edit/id=game-love-letter;type=game"]
    expect(validationComment(state, step, game, label)).toBe('Validated on 2026-11-17 at the gate of `pnpm add-game "Love Letter"` (1 round).\n- https://pbgo.sanity.studio/intent/edit/id=game-love-letter;type=game')
  })
})

describe("the call that does it", () => {
  it("is told everything: the protocol, the fixed ids, the work order, the rules", () => {
    const prompt = linearPrompt(order(fresh()), "mcp__claude_ai_Composio__")
    expect(prompt).toContain("select:mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS,mcp__claude_ai_Composio__COMPOSIO_MULTI_EXECUTE_TOOL")
    for (const id of [LINEAR.teamId, LINEAR.projectId, LINEAR.assigneeId, LINEAR.gameLabelGroupId, ...Object.values(LINEAR.states), ...Object.values(LINEAR.labels)]) expect(prompt).toContain(id)
    expect(prompt).toContain('"wantTitle": "Love Letter: scout"')
    for (const slug of ["LINEAR_CREATE_LINEAR_ISSUE", "LINEAR_UPDATE_ISSUE", "LINEAR_SEARCH_ISSUES", "LINEAR_CREATE_LINEAR_COMMENT", "issueLabelCreate"]) expect(prompt).toContain(slug)
    expect(prompt).toContain("Never delete, archive or move anything")
  })

  it("is allowed the Linear tools it names, and no other", () => {
    const prompt = linearPrompt(order(fresh()), "mcp__claude_ai_Composio__")
    for (const slug of LINEAR_SLUGS) expect(prompt, slug).toContain(slug.replace("LINEAR_RUN_QUERY_OR_MUTATION", "LINEAR_RUN_QUERY_OR_MUTATION"))
    expect(linearPolicy(game, "/repo", { composioServer: "claude_ai_Composio", issueIds: ["issue-1"] })).toMatchObject({
      bash: [],
      writeFiles: [],
      composio: { server: "claude_ai_Composio", slugs: LINEAR_SLUGS, sanity: null, linear: { teamId: LINEAR.teamId, projectId: LINEAR.projectId, issueIds: ["issue-1"] } },
    })
  })

  it("does not move or comment an issue it makes itself in the same call: the policy knows the issues of the work order only", () => {
    const prompt = linearPrompt(order(fresh()), "mcp__claude_ai_Composio__")
    expect(prompt).toContain("whose comment is not null and whose id is filled")
    expect(prompt).toContain("neither moved nor commented in this call")
    expect(prompt).toContain("answer commented false for it")
  })

  it("answers in a shape the schema describes", () => {
    expect(LINEAR_SCHEMA.required).toEqual(["issues"])
    expect(LINEAR_SCHEMA.properties.issues.items.required).toEqual(["key", "id", "identifier", "url", "state"])
  })

  it("uses ids that are UUIDs", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    for (const id of [LINEAR.teamId, LINEAR.projectId, LINEAR.assigneeId, LINEAR.gameLabelGroupId, ...Object.values(LINEAR.states), ...Object.values(LINEAR.labels)]) expect(id).toMatch(uuid)
  })

  it("names a lane label that exists for each step", () => {
    for (const step of STEPS) expect(Object.keys(LINEAR.labels)).toContain(step.lane)
  })
})

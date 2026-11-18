import { describe, expect, it } from "vitest"
import { applyResult, buildOrder, LINEAR, linearPrompt, parseAnswer, validationComment, type WorkOrder } from "./linear.ts"
import { ADOPTED, newState, stepOf, type PipelineState } from "./state.ts"
import { gameOf, STEPS } from "./steps.ts"

const game = gameOf("/assets", "Love Letter", "love-letter")
const NOW = new Date("2026-11-16T10:00:00Z")
const fresh = (): PipelineState => newState({ name: "Love Letter", slug: "love-letter", now: NOW })
const label = (path: string) => path
const order = (state: PipelineState): WorkOrder => {
  const built = buildOrder(state, STEPS, game, label)
  if (!built) throw new Error("no order")
  return built
}
// the parent and one issue for each step, as the answer of a bookkeeping sub-agent has them
const ALL = ["parent", ...STEPS.map((step) => step.id)]
const answer = (keys: string[], states: Record<string, string> = {}, commented: string[] = [], titles: Record<string, string> = {}) => ({
  labelId: "label-1",
  issues: keys.map((key, index) => ({ key, id: `id-${key}`, identifier: `GAM-${41 + index}`, url: `https://linear.app/x/issue/GAM-${41 + index}`, state: states[key] ?? "Todo", ...(commented.includes(key) ? { commented: true } : {}), ...(key in titles ? { title: titles[key] } : {}) })),
})
const STATES = { parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }

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
      ["game-new", "Love Letter: game folder", "Todo", null, "Game lane"],
      ["game-sanity-create", "Love Letter: studio forms", "Todo", null, "Game lane"],
      ["game-assets", "Love Letter: game assets", "Todo", null, "Game lane"],
      ["engine-rules", "Love Letter: engine", "Todo", null, "Engine lane"],
      ["engine-board", "Love Letter: board", "Todo", null, "Engine lane"],
      ["game-go-live", "Love Letter: go live", "Todo", null, "Game lane"],
    ])
    expect(made.issues.every((issue) => issue.comment === null)).toBe(true)
    expect(made.issues[0]?.description).toContain("/add-game")
  })

  it("holds an issue that the terminal command recorded with no id as an issue yet to be made", () => {
    const state = fresh()
    state.linear.parent = { id: "", identifier: "", url: "", title: "Love Letter: add the game", applied: "In Progress", commented: false }
    const made = order(state)
    expect(made.issues[0]).toMatchObject({ key: "parent", id: null, identifier: null, state: null, title: null })
  })

  it("is written into the state from the answer, and then says nothing more", () => {
    const state = fresh()
    const made = order(state)
    expect(applyResult(state, answer(ALL, { parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }), made)).toEqual([])
    expect(state.linear.parent).toMatchObject({ id: "id-parent", identifier: "GAM-41", title: "Love Letter: add the game", applied: "In Progress", commented: false })
    expect(state.linear.labelId).toBe("label-1")
    expect(stepOf(state, "scout").issue).toMatchObject({ identifier: "GAM-42", applied: "In Progress" })
    expect(buildOrder(state, STEPS, game, label)).toBeNull()
  })

  it("moves the next step to In Progress and comments the one that was validated, once", () => {
    const state = fresh()
    applyResult(state, answer(ALL, { parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }), order(state))
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
    applyResult(state, answer(ALL, { parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }), order(state))
    state.name = "6 nimmt!"
    const made = order(state)
    expect(made.issues.map((issue) => issue.wantTitle)).toEqual(["6 nimmt!: add the game", "6 nimmt!: scout", "6 nimmt!: catalog entry", "6 nimmt!: rules spec", "6 nimmt!: platform assets", "6 nimmt!: game folder", "6 nimmt!: studio forms", "6 nimmt!: game assets", "6 nimmt!: engine", "6 nimmt!: board", "6 nimmt!: go live"])
    expect(made.issues.every((issue) => issue.id !== null)).toBe(true)
  })

  it("records the title that Linear has now, so that a rename that did not happen is asked for again", () => {
    const state = fresh()
    applyResult(state, answer(ALL, STATES), order(state))
    state.name = "6 nimmt!"
    const made = order(state)
    // the sub-agent renamed the parent and the scout and left the others as they were, and says so
    const old = Object.fromEntries(made.issues.map((issue) => [issue.key, issue.title ?? ""]))
    expect(applyResult(state, answer(ALL, STATES, [], { ...old, parent: "6 nimmt!: add the game", scout: "6 nimmt!: scout" }), made)).toEqual([])
    expect(state.linear.parent?.title).toBe("6 nimmt!: add the game")
    expect(stepOf(state, "scout").issue?.title).toBe("6 nimmt!: scout")
    expect(stepOf(state, "catalog-entry").issue?.title).toBe("Love Letter: catalog entry")
    const again = order(state)
    expect(again.issues.filter((issue) => issue.title !== issue.wantTitle).map((issue) => issue.key)).toEqual(STEPS.filter((step) => step.id !== "scout").map((step) => step.id))
    // once they are renamed, Linear says what the state says
    applyResult(state, answer(ALL, STATES, [], Object.fromEntries(again.issues.map((issue) => [issue.key, issue.wantTitle]))), again)
    expect(buildOrder(state, STEPS, game, label)).toBeNull()
  })

  it("keeps the title the state had when the answer has none, and takes the wanted one for an issue that was just made", () => {
    const state = fresh()
    applyResult(state, answer(ALL, STATES), order(state))
    expect(stepOf(state, "scout").issue?.title).toBe("Love Letter: scout")
    state.name = "6 nimmt!"
    applyResult(state, answer(ALL, STATES), order(state))
    expect(stepOf(state, "scout").issue?.title).toBe("Love Letter: scout")
    expect(order(state).issues.every((issue) => issue.title !== issue.wantTitle)).toBe(true)
    // a title of blanks is no title
    applyResult(state, answer(["scout"], STATES, [], { scout: "   " }), order(state))
    expect(stepOf(state, "scout").issue?.title).toBe("Love Letter: scout")
  })

  it("leaves the parent open when every step is validated", () => {
    const state = fresh()
    for (const step of STEPS) stepOf(state, step.id).status = "validated"
    const made = order(state)
    expect(made.issues.map((issue) => issue.wantState)).toEqual(["In Progress", ...STEPS.map(() => "Done")])
  })

  it("tells what the answer lacks", () => {
    const state = fresh()
    expect(applyResult(state, answer(["parent", "scout"]), order(state))).toEqual(STEPS.slice(1).map((step) => `no issue came back for ${step.id}`))
    expect(applyResult(state, "nope", order(state))).toEqual(["the answer is not an object"])
    // an issue that came back with no id is no issue
    expect(applyResult(state, { issues: [{ key: "parent", id: "", identifier: "GAM-1", url: "u", state: "Todo" }] }, order(state))[0]).toBe("no issue came back for parent")
  })

  it("says where the rules spec is in the comment of its validation: in the checkout, uncommitted", () => {
    const state = fresh()
    const step = STEPS[2]
    if (!step) throw new Error("no step")
    const s = stepOf(state, "rules-spec")
    s.validatedAt = "2026-11-17T08:00:00.000Z"
    s.rounds = 2
    expect(step.id).toBe("rules-spec")
    expect(validationComment(state, step, game, label)).toBe("Validated on 2026-11-17 at its gate in /add-game (2 rounds).\nRules spec: docs/games/love-letter/rules.md (in the checkout, uncommitted: the game's first pull request takes it)")
  })

  it("says of a step taken on as it was that it had no gate, and names no scout file and no spec that nobody made", () => {
    const state = fresh()
    for (const id of ["scout", "rules-spec"]) {
      const s = stepOf(state, id)
      s.status = "validated"
      s.validatedAt = "2026-11-18T00:30:00.000Z"
      s.report = ADOPTED
    }
    for (const step of STEPS.filter((each) => each.id === "scout" || each.id === "rules-spec")) {
      const comment = validationComment(state, step, game, label)
      expect(comment, step.id).toBe("Taken on as it was on 2026-11-18: done outside /add-game, so it has no gate, no round and no file of the flow behind it.")
    }
    // and the work order posts it once, as it posts the others
    const posted = order(state).issues.filter((issue) => issue.comment !== null).map((issue) => issue.key)
    expect(posted).toEqual(["scout", "rules-spec"])
  })

  it("says what a comment holds: when, how many rounds, the links", () => {
    const state = fresh()
    const step = STEPS[1]
    if (!step) throw new Error("no step")
    const s = stepOf(state, "catalog-entry")
    s.validatedAt = "2026-11-17T08:00:00.000Z"
    s.rounds = 1
    s.links = ["https://pbgo.sanity.studio/intent/edit/id=game-love-letter;type=game"]
    expect(validationComment(state, step, game, label)).toBe("Validated on 2026-11-17 at its gate in /add-game (1 round).\n- https://pbgo.sanity.studio/intent/edit/id=game-love-letter;type=game")
  })
})

describe("the brief of the sub-agent that does it", () => {
  it("is told everything: the protocol, the fixed ids, the work order, the rules, where to write", () => {
    const prompt = linearPrompt(order(fresh()), "/scratch/linear-love-letter-answer.json")
    expect(prompt).toContain('ToolSearch with the query "composio"')
    expect(prompt).toContain("COMPOSIO_SEARCH_TOOLS, COMPOSIO_MULTI_EXECUTE_TOOL and COMPOSIO_GET_TOOL_SCHEMAS")
    for (const id of [LINEAR.teamId, LINEAR.projectId, LINEAR.assigneeId, LINEAR.gameLabelGroupId, ...Object.values(LINEAR.states), ...Object.values(LINEAR.labels)]) expect(prompt).toContain(id)
    expect(prompt).toContain('"wantTitle": "Love Letter: scout"')
    for (const slug of ["LINEAR_CREATE_LINEAR_ISSUE", "LINEAR_UPDATE_ISSUE", "LINEAR_CREATE_LINEAR_COMMENT", "LINEAR_RUN_QUERY_OR_MUTATION", "issueLabelCreate"]) expect(prompt).toContain(slug)
    expect(prompt).toContain("Never delete, archive or move anything")
    expect(prompt).toContain("/scratch/linear-love-letter-answer.json")
    expect(prompt).toContain('"commented": true | false')
  })

  it("looks for an issue by its exact title before it makes one, so that nothing is made twice", () => {
    const prompt = linearPrompt(order(fresh()), "/x.json")
    expect(prompt).toContain('title: { eq: "<its wantTitle>" }')
    expect(prompt).toContain("reuse the one it finds")
  })

  it("renames an issue whose title differs even when its state is right, and asks for the title back", () => {
    const prompt = linearPrompt(order(fresh()), "/x.json")
    expect(prompt).toContain("or whose title differs from wantTitle")
    expect(prompt).toContain("a title that differs is renamed even when the state is right")
    expect(prompt).toContain('"title": "<the title the issue has now>"')
    expect(prompt).toContain("its title of the work order for one you left as it was")
  })

  it("uses ids that are UUIDs", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    for (const id of [LINEAR.teamId, LINEAR.projectId, LINEAR.assigneeId, LINEAR.gameLabelGroupId, ...Object.values(LINEAR.states), ...Object.values(LINEAR.labels)]) expect(id).toMatch(uuid)
  })

  it("names a lane label that exists for each step", () => {
    for (const step of STEPS) expect(Object.keys(LINEAR.labels)).toContain(step.lane)
  })
})

describe("the answer of the sub-agent", () => {
  it("is read from a file that holds the JSON, wrapped in a code fence or in a sentence or not", () => {
    expect(parseAnswer('{"issues": []}')).toEqual({ issues: [] })
    expect(parseAnswer('```json\n{"labelId": "a", "issues": []}\n```')).toEqual({ labelId: "a", issues: [] })
    expect(parseAnswer('Done: {"issues": [{"key": "parent"}]} as asked.')).toEqual({ issues: [{ key: "parent" }] })
  })

  it("is null when there is no JSON in it", () => {
    expect(parseAnswer("")).toBeNull()
    expect(parseAnswer("no braces")).toBeNull()
    expect(parseAnswer("{ not json }")).toBeNull()
  })
})

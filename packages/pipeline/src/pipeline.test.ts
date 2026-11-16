// The whole command, as a process: `pnpm add-game "<name>"` with a stand-in `claude` (test/fake-claude.mjs, which writes the same events as the real CLI), a stand-in
// for `pnpm check:scout` (the check of a spec is the real one), a HOME, a folder of the games' files and a folder of the specs in a temporary place, and the owner's answers on stdin. Nothing here reaches the network, the owner's
// login, Linear or Sanity (the platform's public API is a stand-in too, and a closed port when a test starts none): the point is what the command asks of `claude`
// (the arguments, the environment, the order), what it keeps, and what it shows at each gate.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { fakeSanity, flagValue, flagValues, linearAnswer, REPO, runCli, scoutJson, world, type CallSpec, type LoggedCall, type Run, type Scenario } from "../test/harness.ts"
import { parseState, type PipelineState } from "./state.ts"

const NAME = "Test Game"
const SLUG = "test-game"

const SCOUT_REPORT = `Test Game (test-game)
Edition     Sample Publisher 2024, Second edition · rules v2.1, 2024-03 (en) · confidence high
Type        Base game · suggestion: none
Validate, or tell me what to change: edition, type, base game, slug.`
const DRAFTS_REPORT = `Test Game (test-game) · base game · draft created
Draft       https://pbgo.sanity.studio/intent/edit/id=game-test-game;type=game
Written     2-6 players · 30 min · 8+
Validate, or tell me what to change. Validate publishes 2 documents (game-test-game, publisher-sample-publisher): the page is public within about eleven minutes and, with a description, may be indexed.`
const PUBLISHED = "Published game-test-game and publisher-sample-publisher.\nhttps://playboardgamesonline.app/game/test-game"
const SPEC_REPORT = `Test Game (test-game): rules spec
Spec        docs/games/test-game/rules.md · check:rules ok
Holds       2–4 players · 5 components of 4 kinds · 2 open points
Validate also accepts the 2 readings of the open points. Validate, or tell me what to change: components, rules, open points.`

// The pages the stand-in skill leaves are the real ones: the example of the skill, for this game
const SKILL = readFileSync(join(REPO, ".claude", "skills", "game-rules-spec", "SKILL.md"), "utf8")
const example = (info: string, name: string) => `${(new RegExp(`\`\`\`markdown ${info}\\n([\\s\\S]*?)\\n\`\`\``).exec(SKILL)?.[1] ?? "").replace(/Orchard Run/g, name)}\n`
const specWrites = (name = NAME, slug = SLUG): { path: string; content: string }[] => [
  { path: `$DOCS/${slug}/rules.md`, content: example("rules", name) },
  { path: `$DOCS/${slug}/index.md`, content: example("index", name) },
]

const SCOUT_PATH = `$ASSETS/${SLUG}/scout.json`
const scoutCall = (over: Partial<CallSpec> = {}): CallSpec => ({ match: "^/game-scout", text: SCOUT_REPORT, cost: 0.5, writes: [{ path: SCOUT_PATH, content: scoutJson(NAME, SLUG) }], ...over })
const linearCall = (states: Record<string, string>, commented: string[] = []): CallSpec => ({ match: "bookkeeping step", text: "{}", cost: 0.02, structured: linearAnswer(["parent", "scout", "catalog-entry", "rules-spec", "platform-assets"], states, { commented }) })
const catalogCall = (over: Partial<CallSpec> = {}): CallSpec => ({ match: "^/platform-catalog-entry", text: DRAFTS_REPORT, cost: 0.8, ...over })
const specCall = (over: Partial<CallSpec> = {}): CallSpec => ({ match: "^/game-rules-spec", text: SPEC_REPORT, cost: 0.9, writes: specWrites(), ...over })
// a session of the owner's (no `-p`): the stand-in writes a picture where the skill would have put one, and the owner leaves it
const sessionCall = (over: Partial<CallSpec> = {}): CallSpec => ({ match: "^/platform-assets", writes: [{ path: `$ASSETS/${SLUG}/platform/game-${SLUG}-logo.png`, content: "a picture" }], ...over })

const stateOf = (run: Run, slug = SLUG): PipelineState => {
  const parsed = parseState(run.read(join(run.assets, slug, "pipeline.json")))
  if (parsed.state === null) throw new Error(parsed.problems.join("; "))
  return parsed.state
}
const promptOf = (call: LoggedCall | undefined): string => call?.prompt ?? ""
const names = (call: LoggedCall | undefined): string[] => flagValues(call as LoggedCall, "--allowedTools")
const BOTH = ["game-test-game", "publisher-sample-publisher"]

/** A stand-in for the platform's public API, for the length of a test: what it says is published, and what it was asked. */
async function withSanity<T>(options: Parameters<typeof fakeSanity>[0], body: (sanity: Awaited<ReturnType<typeof fakeSanity>>) => Promise<T>): Promise<T> {
  const sanity = await fakeSanity(options)
  try {
    return await body(sanity)
  } finally {
    await sanity.close()
  }
}

describe("a game from its name to its pictures", () => {
  const happy: Scenario = {
    calls: [
      linearCall({ parent: "In Progress", scout: "In Progress", "catalog-entry": "Todo" }),
      scoutCall({ tools: [{ name: "WebSearch", input: { query: "Test Game publisher" } }], denials: [{ tool: "Write", input: { file_path: "/repo/x.txt" }, reason: "a step writes only under the game's folder", hook: true }] }),
      scoutCall({ match: "^change the edition", text: `${SCOUT_REPORT}\n(edition changed)`, cost: 0.2, writes: [{ path: SCOUT_PATH, content: scoutJson(NAME, SLUG, { notes: ["the edition was changed at the gate"] }) }] }),
      linearCall({ parent: "In Progress", scout: "Done", "catalog-entry": "In Progress" }, ["scout"]),
      catalogCall(),
      { match: "^validate$", text: PUBLISHED, cost: 0.3 },
      linearCall({ parent: "In Progress", scout: "Done", "catalog-entry": "Done", "rules-spec": "In Progress" }, ["catalog-entry"]),
      specCall(),
      linearCall({ parent: "In Progress", scout: "Done", "catalog-entry": "Done", "rules-spec": "Done", "platform-assets": "In Progress" }, ["rules-spec"]),
      sessionCall(),
      linearCall({ parent: "In Progress", scout: "Done", "catalog-entry": "Done", "rules-spec": "Done", "platform-assets": "Done" }, ["platform-assets"]),
    ],
  }

  it("runs the scout, a change round, the catalog entry, the publication, the rules spec and the session of the pictures, one gate after each", async () => {
    const sanity = await fakeSanity({ published: BOTH })
    const run = await runCli({ args: [NAME], answers: ["y", "change the edition to 2019", "validate", "validate", "publish", "validate", "validate"], scenario: happy, env: { PBGO_SANITY_API_BASE: sanity.base } }).finally(() => sanity.close())
    expect(run.stderr).toBe("")
    expect(run.code).toBe(0)
    expect(run.calls).toHaveLength(10)

    // the calls, in order: the issues, the scout (twice: its first call and the change), the issues, the catalog entry, the word publish, the issues, the rules spec, the issues, then (a session of
    // the owner's, which is not a headless call) the issues once more
    const [linear1, scout1, scout2, linear2, catalog, publish, linear3, spec, linear4, linear5] = run.calls
    expect(promptOf(linear1)).toContain("bookkeeping step")
    expect(promptOf(scout1)).toBe(`/game-scout ${NAME} --out ${run.assets}/${SLUG}/scout.json`)
    expect(promptOf(scout2)).toBe("change the edition to 2019")
    expect(promptOf(linear2)).toContain("bookkeeping step")
    expect(promptOf(catalog)).toBe(`/platform-catalog-entry ${run.assets}/${SLUG}/scout.json`)
    expect(promptOf(publish)).toBe("validate")
    expect(promptOf(linear3)).toContain("bookkeeping step")
    expect(promptOf(spec)).toBe(`/game-rules-spec ${run.assets}/${SLUG}/scout.json`)
    expect(promptOf(linear4)).toContain("bookkeeping step")
    expect(promptOf(linear4)).toContain("Rules spec: docs/games/test-game/rules.md")
    expect(promptOf(linear5)).toContain("bookkeeping step")

    // none of them could use a key or think it was nested in a Claude Code session; the login's way in is kept
    for (const call of run.calls) {
      expect(call.env).toMatchObject({ ANTHROPIC_API_KEY: null, ANTHROPIC_BASE_URL: null, CLAUDECODE: null, CLAUDE_CODE_ENTRYPOINT: null, USER: "tester" })
      expect(call.cwd).toBe(REPO)
      expect(flagValue(call, "--permission-mode")).toBe("dontAsk")
      expect(flagValue(call, "--setting-sources")).toBe("project")
      expect(flagValue(call, "--output-format")).toBe("stream-json")
      expect(call.argv).toContain("--verbose")
    }

    // the word that lets a Sanity write through is given to the call that publishes, and refused to every other (set to 0, whatever the shell had)
    expect(run.calls.map((call) => call.env.PBGO_PUBLISH_OK)).toEqual(["0", "0", "0", "0", "0", "1", "0", "0", "0", "0"])

    // one session for the game: made by its first call, resumed by every call of a step; the bookkeeping calls leave none
    const session = flagValue(scout1 as LoggedCall, "--session-id")
    expect(session).toMatch(/^[0-9a-f-]{36}$/)
    expect(flagValue(scout1 as LoggedCall, "--name")).toBe("add-game: Test Game")
    for (const call of [scout2, catalog, publish, spec]) {
      expect(flagValue(call as LoggedCall, "--resume")).toBe(session)
      expect(call?.argv).not.toContain("--session-id")
    }
    for (const call of [linear1, linear2, linear3, linear4, linear5]) {
      expect(call?.argv).toContain("--no-session-persistence")
      expect(call?.argv).toContain("--json-schema")
      expect(flagValue(call as LoggedCall, "--model")).toBe("haiku")
      expect(call?.argv).not.toContain("--resume")
    }
    for (const call of [scout1, scout2, catalog, publish, spec]) expect(flagValue(call as LoggedCall, "--model")).toBe("sonnet")
    expect(flagValue(scout1 as LoggedCall, "--max-budget-usd")).toBe("3")

    // what each call may use by name: the read-only tools, and Composio's lookup tools for the catalog entry only (never its executor: the hook allows that)
    expect(names(scout1)).toEqual(["ToolSearch", "WebSearch", "WebFetch"])
    expect(names(catalog)).toEqual(["ToolSearch", "WebSearch", "WebFetch", "mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS", "mcp__claude_ai_Composio__COMPOSIO_GET_TOOL_SCHEMAS"])
    expect(names(spec)).toEqual(["ToolSearch", "WebSearch", "WebFetch"])
    expect(run.calls.flatMap((call) => flagValues(call, "--allowedTools")).join(" ")).not.toContain("MULTI_EXECUTE")

    // each call has its policy and the settings that register the hook; the first lines of the stream are kept
    const work = join(run.assets, SLUG, ".pipeline")
    expect(scout1?.env.PBGO_GUARD_POLICY).toBe(join(work, "scout.policy.json"))
    expect(catalog?.env.PBGO_GUARD_POLICY).toBe(join(work, "catalog-entry.policy.json"))
    expect(spec?.env.PBGO_GUARD_POLICY).toBe(join(work, "rules-spec.policy.json"))
    expect(linear1?.env.PBGO_GUARD_POLICY).toBe(join(work, "linear.policy.json"))
    // a step writes the one file it is meant to, and reads that one and the repo: never the state, the lock, its own policy or the log that sit in the same folder
    const scoutFile = join(run.assets, SLUG, "scout.json")
    expect(scout1?.policy).toMatchObject({ repoRoot: REPO, workDir: join(run.assets, SLUG), writeFiles: [scoutFile], readFiles: [scoutFile], composio: null })
    expect(catalog?.policy).toMatchObject({ writeFiles: [], readFiles: [scoutFile] })
    // the rules spec writes the two pages of the game in the specs' folder (the checkout's docs/games, here the world's), reads its scout file and its rulebook, and has no Composio
    expect(spec?.policy).toMatchObject({ repoRoot: REPO, workDir: join(run.assets, SLUG), writeFiles: [join(run.docs, SLUG, "rules.md"), join(run.docs, SLUG, "index.md")], readFiles: [scoutFile, join(run.assets, SLUG, "rules.pdf")], composio: null })
    expect(catalog?.policy?.composio).toMatchObject({ server: "claude_ai_Composio", slugs: ["SANITY_QUERY_DOCUMENTS", "SANITY_MUTATE_DOCUMENTS"] })
    // the documents that a call may publish are the ones the gate showed: none for the call that makes the drafts, those two for the call that publishes
    expect(catalog?.policy?.composio?.sanity).toMatchObject({ projectId: "mhgqs6fe", dataset: "production", gameSlug: SLUG, publishIds: [] })
    expect(publish?.policy?.composio?.sanity).toMatchObject({ gameSlug: SLUG, publishIds: BOTH })
    // Linear: the issues of the game are the ones it made, known from its state (none before the first call)
    expect(linear1?.policy?.composio?.linear?.issueIds).toEqual([])
    expect(linear2?.policy?.composio?.linear?.issueIds).toEqual(["issue-parent", "GAM-40", "issue-scout", "GAM-41", "issue-catalog-entry", "GAM-42", "issue-rules-spec", "GAM-43", "issue-platform-assets", "GAM-44"])
    expect(run.read(join(work, "scout.settings.json"))).toContain("hook/guard.ts")
    // one log for each round, named by the time of its end, so that a round never overwrites an earlier one
    const logs = readdirSync(join(work, "logs"))
    expect(logs.every((name) => /^[a-z-]+-\d{8}T\d{9}Z-(first|change|publish)\.jsonl$/.test(name)), logs.join(" ")).toBe(true)
    expect(logs.map((name) => name.replace(/-\d{8}T\d{9}Z-/, "-")).sort()).toEqual(["catalog-entry-first.jsonl", "catalog-entry-publish.jsonl", "rules-spec-first.jsonl", "scout-change.jsonl", "scout-first.jsonl"])

    // what the owner saw
    expect(run.stdout).toContain("Start? [Y/n]")
    expect(run.stdout).toContain('search "Test Game publisher"')
    expect(run.stdout).toContain("✗ blocked: Write /repo/x.txt (a step writes only under the game's folder)")
    expect(run.stdout).toContain("1 call blocked by the policy")
    expect(run.stdout).toContain("━━━ Scout · Test Game · round 1")
    expect(run.stdout).toContain("━━━ Scout · Test Game · round 2")
    expect(run.stdout).toContain("(edition changed)")
    expect(run.stdout).toContain("validate · or type what to change")
    expect(run.stdout).toContain("✓ Scout validated")
    expect(run.stdout).toContain("https://pbgo.sanity.studio/intent/edit/id=game-test-game;type=game")
    expect(run.stdout).toContain("validate (the drafts are right) · or type what to change · o opens the draft")
    expect(run.stdout).toContain("publish makes 2 documents public (game-test-game, publisher-sample-publisher)")
    expect(run.stdout).toContain(PUBLISHED.split("\n")[0] ?? "")
    expect(run.stdout).toContain("publish · b to change something · q stops (the drafts stay)")
    expect(run.stdout).toContain("✓ Catalog entry validated")
    expect(run.stdout).toContain("✓ Rules spec validated")
    expect(run.stdout).toContain("o opens the spec · q stops")
    expect(run.stdout).toContain("4. platform assets: /platform-assets · gate validate · a session of your own")
    expect(run.stdout).toContain("━━━ Platform assets · Test Game · a session of your own")
    expect(run.stdout).toContain("Claude Code opens here on /platform-assets, in the session of the game. You approve each action in it.")
    expect(run.stdout).toContain("✓ Platform assets validated")
    expect(run.stdout).toContain("o opens the pictures · q stops")
    expect(run.stdout).toContain("✓ Test Game (game-test-game), published: 3 of 5 pictures")
    expect(run.stdout).toContain("Test Game is in the platform's catalog, its rules are written down")
    expect(run.stdout).toContain("Its rules spec is in your checkout, uncommitted: docs/games/test-game/ (rules.md and index.md).")
    expect(run.stdout).toContain("pnpm add-game test-game --name 'Test Game' --rules 'en=<the rulebook PDF>'")
    expect(run.stdout).toContain("rulebook found by the scout: https://example.com/rules.pdf (en, v2.1)")
    expect(run.stdout).toContain("claude --resume " + session)

    // the session of the pictures: Claude Code on the owner's terminal, no -p, no policy, no hook, no mode of ours, the session of the game resumed, its first message the last word
    expect(run.sessions).toHaveLength(1)
    const [pictures] = run.sessions
    expect(pictures?.argv).toEqual(["--model", "sonnet", "--resume", session ?? "", `/platform-assets ${run.assets}/${SLUG}/scout.json`])
    expect(pictures?.cwd).toBe(REPO)
    expect(pictures?.env).toMatchObject({ ANTHROPIC_API_KEY: null, ANTHROPIC_BASE_URL: null, CLAUDECODE: null, CLAUDE_CODE_ENTRYPOINT: null, USER: "tester", PBGO_PUBLISH_OK: null, PBGO_GUARD_POLICY: null })
    expect(pictures?.policy).toBeNull()
    expect(existsSync(join(run.assets, SLUG, ".pipeline", "platform-assets.policy.json"))).toBe(false)
    expect(existsSync(join(run.assets, SLUG, "platform", `game-${SLUG}-logo.png`))).toBe(true)

    // what is kept
    const state = stateOf(run)
    expect(state.session).toEqual({ id: session, started: true })
    expect(state.steps.scout).toMatchObject({ status: "validated", rounds: 2 })
    expect(state.steps.scout?.costUsd).toBeCloseTo(0.7)
    expect(state.steps["catalog-entry"]).toMatchObject({ status: "validated", rounds: 2, gate: 1 })
    // the report kept is the one the owner validated, not the publication's
    expect(state.steps["catalog-entry"]?.report).toContain("Validate publishes 2 documents")
    expect(state.steps["catalog-entry"]?.report).not.toContain("Published game-test-game")
    // the publication was read back from the platform's public API, for the documents of the gate and no other
    expect(sanity.requests).toHaveLength(1)
    expect(JSON.parse(sanity.requests[0]?.searchParams.get("$ids") ?? "[]")).toEqual(BOTH)
    expect(sanity.requests[0]?.searchParams.get("perspective")).toBe("published")
    expect(state.steps["platform-assets"]).toMatchObject({ status: "validated", rounds: 1, costUsd: 0 })
    expect(state.steps["platform-assets"]?.check?.ok).toBe(true)
    expect(state.steps["platform-assets"]?.issue).toMatchObject({ identifier: "GAM-44", applied: "Done", commented: true })
    expect(state.steps["rules-spec"]).toMatchObject({ status: "validated", rounds: 1 })
    expect(state.steps["rules-spec"]?.check?.ok).toBe(true)
    expect(state.steps["rules-spec"]?.issue).toMatchObject({ identifier: "GAM-43", applied: "Done", commented: true })
    // the page the owner validated is stamped as validated, with the day, and so is every reading that waited for their word
    const written = run.read(join(run.docs, SLUG, "rules.md"))
    expect(written).toMatch(/^- Status: validated \d{4}-\d{2}-\d{2}$/m)
    expect(written).not.toContain("to validate")
    expect(written.match(/^\*\*Status\.\*\* validated \d{4}-\d{2}-\d{2}$/gm)).toHaveLength(2)
    expect(state.linear.parent).toMatchObject({ identifier: "GAM-40", applied: "In Progress" })
    expect(state.steps.scout?.issue).toMatchObject({ identifier: "GAM-41", applied: "Done", commented: true })
    expect(state.steps["catalog-entry"]?.issue).toMatchObject({ identifier: "GAM-42", applied: "Done", commented: true })
    expect(state.linear.error).toBeNull()
    expect(existsSync(join(run.assets, SLUG, "pipeline.lock"))).toBe(false)
  })

  it("never publishes by itself: a yes at the first gate of the catalog entry is not the word publish", async () => {
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "validate", "validate", "yes", "y", "ok", "q"], scenario: { calls: [scoutCall(), catalogCall()] } })
    expect(run.code).toBe(0)
    // the scout, the catalog entry: no call carried the word, and the call that publishes never happened
    expect(run.calls.map((call) => promptOf(call).slice(0, 12))).toEqual(["/game-scout ", "/platform-ca"])
    expect(run.calls.every((call) => call.env.PBGO_PUBLISH_OK === "0")).toBe(true)
    expect(run.stdout.match(/Type publish to publish, b to go back and change something, q to stop\./g)).toHaveLength(4)
    expect(stateOf(run).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 1 })
  })
})

describe("the word publish", () => {
  const finished: CallSpec = { match: "^validate$", text: PUBLISHED, cost: 0.3 }

  it("is refused when the report does not name the documents it would make public: the call that publishes may publish only the ones the gate showed", async () => {
    const vague = catalogCall({ text: "Test Game (test-game) · draft created\nValidate, or tell me what to change." })
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "validate", "publish", "q"], scenario: { calls: [scoutCall(), vague] } })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain('The report does not say which documents publish would make public ("Validate publishes N documents (ids)")')
    expect(run.stdout).toContain("✗ The report does not say which documents publish would make public: type b")
    // nothing was called for it
    expect(run.calls.map((call) => promptOf(call).slice(0, 12))).toEqual(["/game-scout ", "/platform-ca"])
    expect(stateOf(run).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 1 })
  })

  it("is refused when the report names documents that count wrongly, or that are not ones a draft is published under", async () => {
    for (const sentence of ["Validate publishes 3 documents (game-test-game, publisher-sample-publisher).", "Validate publishes 1 document (drafts.game-test-game).", "Validate publishes 2 documents (game-test-game, game-test-game)."]) {
      const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "validate", "publish", "q"], scenario: { calls: [scoutCall(), catalogCall({ text: `Test Game (test-game)\n${sentence}` }), finished] } })
      expect(run.calls, sentence).toHaveLength(2)
      expect(run.stdout, sentence).toContain("✗ The report does not say which documents publish would make public")
    }
  })

  it("is not recorded when the platform's Sanity does not show the documents, whatever the skill said", async () => {
    await withSanity({ published: ["publisher-sample-publisher"] }, async (sanity) => {
      const run = await runCli({
        args: [NAME, "--yes", "--no-linear"],
        answers: ["validate", "validate", "publish", "q"],
        scenario: { calls: [scoutCall(), catalogCall(), finished] },
        env: { PBGO_SANITY_API_BASE: sanity.base },
      })
      expect(run.code).toBe(0)
      expect(run.calls).toHaveLength(3)
      expect(run.stdout).toContain(PUBLISHED.split("\n")[0] ?? "")
      expect(run.stdout).toContain("✗ Not published: game-test-game. The skill said it was done and the platform's Sanity does not show it, so nothing is recorded")
      expect(run.stdout).not.toContain("✓ Catalog entry validated")
      expect(run.stdout).not.toContain("is in the platform's catalog")
      // the gate is where it was: the word can be given again, or the work taken back
      expect(stateOf(run).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 1, validatedAt: null })
      expect(run.stdout.match(/publish · b to change something/g)).toHaveLength(2)
    })
  })

  it("goes on, and says it could not check, when the platform's API cannot be read", async () => {
    await withSanity({ down: true }, async (sanity) => {
      const run = await runCli({
        args: [NAME, "--yes", "--no-linear"],
        answers: ["validate", "validate", "publish", "q"],
        scenario: { calls: [scoutCall(), catalogCall(), finished, specCall()] },
        env: { PBGO_SANITY_API_BASE: sanity.base },
      })
      expect(run.code).toBe(0)
      expect(run.stdout).toContain("! The platform's Sanity could not be read to confirm the publication: the skill's own read-back is above.")
      expect(run.stdout).toContain("✓ Catalog entry validated")
    })
  })

  it("goes to the session that showed the drafts, even with --new-session, and to no other", async () => {
    await withSanity({ published: BOTH }, async (sanity) => {
      const first = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "validate"], scenario: { calls: [scoutCall(), catalogCall()] } })
      expect(first.code).toBe(3)
      expect(stateOf(first).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 1 })
      const second = await runCli({ args: [NAME, "--new-session", "--no-linear"], base: first.base, answers: ["publish", "q"], scenario: { calls: [finished, specCall()] }, env: { PBGO_SANITY_API_BASE: sanity.base } })
      expect(second.code).toBe(0)
      expect(second.calls).toHaveLength(2)
      const session = flagValue(first.calls[0] as LoggedCall, "--session-id")
      expect(flagValue(second.calls[0] as LoggedCall, "--resume")).toBe(session)
      expect(second.calls[0]?.argv).not.toContain("--session-id")
      expect(second.calls[0]?.env.PBGO_PUBLISH_OK).toBe("1")
      // the documents it may publish came from the report kept in the state
      expect(second.calls[0]?.policy?.composio?.sanity?.publishIds).toEqual(BOTH)
      // the call after it is the one that starts the fresh session the owner asked for
      const fresh = flagValue(second.calls[1] as LoggedCall, "--session-id")
      expect(fresh).toMatch(/^[0-9a-f-]{36}$/)
      expect(fresh).not.toBe(session)
      expect(second.calls[1]?.argv).not.toContain("--resume")
    })
  })

  it("that failed is taken up as work: the session resumes without the word, and the gate is the first one again", async () => {
    const budget: CallSpec = { match: "^validate$", subtype: "error_max_budget_usd", isError: true, errors: ["Reached maximum budget ($3)"], terminalReason: "budget_exhausted", text: "" }
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "validate", "publish"], scenario: { calls: [scoutCall(), catalogCall(), budget] } })
    expect(first.code).toBe(1)
    expect(first.calls[2]?.env.PBGO_PUBLISH_OK).toBe("1")
    expect(stateOf(first).steps["catalog-entry"]).toMatchObject({ status: "failed", gate: 1 })

    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["q"], scenario: { calls: [catalogCall({ match: "interrupted or stopped", text: `${DRAFTS_REPORT}\n(checked again)` })] } })
    expect(second.code).toBe(0)
    expect(promptOf(second.calls[0])).toContain("Check what already exists")
    expect(second.calls[0]?.env.PBGO_PUBLISH_OK).toBe("0")
    expect(second.calls[0]?.policy?.composio?.sanity?.publishIds).toEqual([])
    expect(second.stdout).toContain("(checked again)")
    expect(second.stdout).toContain("validate (the drafts are right)")
    expect(stateOf(second).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 0 })
  })

  it("goes back to the first gate when a change is asked at the second", async () => {
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "validate", "b", "q"], scenario: { calls: [scoutCall(), catalogCall()] } })
    expect(run.stdout).toContain("validate (the drafts are right)")
    expect(stateOf(run).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 0 })
  })
})

describe("the rules spec", () => {
  // the scout, the catalog entry and its publication: the game is then at the rules spec (the platform's API is a closed port, which the command says and goes on from)
  const before = (): CallSpec[] => [scoutCall(), catalogCall(), { match: "^validate$", text: PUBLISHED, cost: 0.3 }]
  const toTheSpec = ["validate", "validate", "publish"]
  const args = [NAME, "--yes", "--no-linear"]

  it("is run after the catalog entry, in the session of the game, and stops at its gate with the machine's verdict", async () => {
    const run = await runCli({ args, answers: [...toTheSpec, "q"], scenario: { calls: [...before(), specCall()] } })
    expect(run.code).toBe(0)
    expect(run.calls).toHaveLength(4)
    expect(promptOf(run.calls[3])).toBe(`/game-rules-spec ${run.assets}/${SLUG}/scout.json`)
    expect(flagValue(run.calls[3] as LoggedCall, "--resume")).toBe(flagValue(run.calls[0] as LoggedCall, "--session-id"))
    expect(run.stdout).toContain("━━━ Rules spec · Test Game · round 1")
    expect(run.stdout).toContain("Validate also accepts the 2 readings of the open points.")
    expect(run.stdout).toContain("✓ ok    docs/games/test-game/rules.md: Test Game: 2–4 players, 5 components of 4 kinds, 2 open points (2 to validate), draft")
    expect(run.stdout).toContain("validate · or type what to change · o opens the spec · q stops (everything is saved)")
    // the pages are in the specs' folder, not stamped before the owner's word
    expect(run.read(join(run.docs, SLUG, "rules.md"))).toContain("- Status: draft")
    expect(stateOf(run).steps["rules-spec"]).toMatchObject({ status: "gate", gate: 0, check: { ok: true } })
  })

  it("is not validated while the page does not pass the check, and is once a change has put it right", async () => {
    const broken = specCall({ writes: [{ path: `$DOCS/${SLUG}/rules.md`, content: example("rules", NAME).replace("## Setup", "## Set up") }, specWrites()[1] as { path: string; content: string }] })
    const fixed = specCall({ match: "^fix the setup", text: `${SPEC_REPORT}\n(fixed)`, cost: 0.3 })
    const run = await runCli({ args, answers: [...toTheSpec, "validate", "fix the setup", "validate", "q"], scenario: { calls: [...before(), broken, fixed, sessionCall()] } })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain('✗   - The section "Setup" is missing')
    expect(run.stdout).toContain("✗ The spec does not pass the check: type what to change.")
    expect(run.stdout).toContain("(fixed)")
    expect(run.stdout).toContain("✓ Rules spec validated")
    expect(run.calls.map((call) => promptOf(call).slice(0, 14))).toEqual(["/game-scout Te", "/platform-cata", "validate", "/game-rules-sp", "fix the setup"])
    expect(stateOf(run).steps["rules-spec"]).toMatchObject({ status: "validated", rounds: 2 })
    expect(run.read(join(run.docs, SLUG, "rules.md"))).toMatch(/^- Status: validated \d{4}-\d{2}-\d{2}$/m)
  })

  it("is not validated when the skill wrote no page (it could not read the rulebook), and says so", async () => {
    const blocked = specCall({ text: "Test Game (test-game): rules spec\nBlocked     the rulebook cannot be read\nPut it at   ~/Companies/PBGO/assets/test-game/rules.pdf, then type retry", writes: [] })
    const run = await runCli({ args, answers: [...toTheSpec, "validate", "q"], scenario: { calls: [...before(), blocked] } })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("Put it at   ~/Companies/PBGO/assets/test-game/rules.pdf, then type retry")
    expect(run.stdout).toContain("no spec was written (docs/games/test-game/rules.md)")
    expect(run.stdout).toContain("✗ The spec does not pass the check: type what to change.")
    expect(run.stdout).not.toContain("✓ Rules spec validated")
    expect(existsSync(join(run.docs, SLUG))).toBe(false)
    expect(stateOf(run).steps["rules-spec"]).toMatchObject({ status: "gate", check: { ok: false } })
  })

  it("is not validated when its title names another game than the one that is added", async () => {
    const other = specCall({ writes: specWrites("Other Game") })
    const run = await runCli({ args, answers: [...toTheSpec, "validate", "q"], scenario: { calls: [...before(), other] } })
    expect(run.stdout).toContain('the title says "Other Game", the game is "Test Game"')
    expect(run.stdout).toContain("✗ The spec does not pass the check: type what to change.")
    expect(stateOf(run).steps["rules-spec"]?.status).toBe("gate")
  })

  // the one test that asks the network for something: the name of a host that is not there (a subdomain of example.org: the scout contract takes no .invalid or .test), which cannot be fetched
  // whether the machine is offline or not
  it("tells the rulebook it did not fetch, and goes on: the owner puts the PDF where it says and types retry", { timeout: 30_000 }, async () => {
    const unreachable = scoutCall({
      writes: [
        {
          path: SCOUT_PATH,
          content: scoutJson(NAME, SLUG, { edition: { publisher: "Sample Publisher", year: 2024, label: null, bggVersionId: null, rules: { language: "en", url: "https://rulebooks.example.org/rules.pdf", version: null, date: null }, confidence: "high" } }),
        },
      ],
    })
    const run = await runCli({ args, answers: [...toTheSpec, "q"], scenario: { calls: [unreachable, catalogCall(), { match: "^validate$", text: PUBLISHED, cost: 0.3 }, specCall()] }, env: { PBGO_ADD_GAME_NO_DOWNLOAD: "" } })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("· Rulebook: fetching https://rulebooks.example.org/rules.pdf…")
    expect(run.stdout).toContain("! The rulebook was not fetched (")
    expect(run.stdout).toContain("A PDF has to be at")
    expect(run.stdout).toContain("and type retry at the gate")
    // the step went on: the skill says what it lacks
    expect(run.calls).toHaveLength(4)
    expect(existsSync(join(run.assets, SLUG, "rules.pdf"))).toBe(false)
  })

  it("does not fetch the rulebook when downloads are off, and says where to put it", async () => {
    const run = await runCli({ args, answers: [...toTheSpec, "q"], scenario: { calls: [...before(), specCall()] } })
    expect(run.stdout).toMatch(/· Rulebook: not fetched \(downloads are off\); put the PDF at .*rules\.pdf if the rules are not a web page/)
    expect(run.stdout).not.toContain("Rulebook: fetching")
  })

  it("leaves a rulebook that is there as it is, never fetches over it, and hands it to the script that makes the game's folder", async () => {
    const mine = scoutCall({ writes: [{ path: SCOUT_PATH, content: scoutJson(NAME, SLUG) }, { path: `$ASSETS/${SLUG}/rules.pdf`, content: "%PDF-1.4 the owner's own\n%%EOF\n" }] })
    const run = await runCli({ args, answers: [...toTheSpec, "validate", "validate"], scenario: { calls: [mine, catalogCall(), { match: "^validate$", text: PUBLISHED, cost: 0.3 }, specCall(), sessionCall()] }, env: { PBGO_ADD_GAME_NO_DOWNLOAD: "" } })
    expect(run.code).toBe(0)
    expect(run.stdout).not.toContain("Rulebook: fetching")
    expect(run.stdout).not.toContain("Rulebook: not fetched")
    expect(run.read(join(run.assets, SLUG, "rules.pdf"))).toContain("the owner's own")
    expect(run.stdout).toContain(`--rules en=${join(run.assets, SLUG, "rules.pdf")}`)
  })

  it("shows up pending in a game that began before it was a step, and is run from where the game stopped", async () => {
    const first = await runCli({ args, answers: [...toTheSpec, "q"], scenario: { calls: [...before(), specCall()] } })
    // what an older version of the command would have left: no record of this step
    const file = join(first.assets, SLUG, "pipeline.json")
    const old = JSON.parse(first.read(file)) as { steps: Record<string, unknown> }
    delete old.steps["rules-spec"]
    writeFileSync(file, JSON.stringify(old))
    rmSync(join(first.docs, SLUG), { recursive: true })
    const list = await runCli({ args: ["--list"], base: first.base })
    expect(list.stdout).toContain("catalog entry validated · rules spec not started · platform assets not started")
    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["validate", "q"], scenario: { calls: [specCall(), sessionCall()] } })
    expect(second.code).toBe(0)
    expect(promptOf(second.calls[0])).toBe(`/game-rules-spec ${second.assets}/${SLUG}/scout.json`)
    expect(second.stdout).toContain("✓ Rules spec validated")
  })

  it("is left alone by a game that has a folder in the repo: nothing is scouted, nothing is written", async () => {
    const run = await runCli({ args: ["Hanabi", "--yes"] })
    expect(run.invocations).toHaveLength(0)
    expect(existsSync(join(run.docs, "hanabi"))).toBe(false)
  })
})

describe("the pictures session", () => {
  const before = (): CallSpec[] => [scoutCall(), catalogCall(), { match: "^validate$", text: PUBLISHED, cost: 0.3 }, specCall()]
  const toTheSession = ["validate", "validate", "publish", "validate"]
  const args = [NAME, "--yes", "--no-linear"]

  it("opens after the rules spec and waits for the owner to leave it: the command prints what it does, then shows what the platform says of the entry", async () => {
    const run = await runCli({ args, answers: [...toTheSession, "q"], scenario: { calls: [...before(), sessionCall()] } })
    expect(run.code).toBe(0)
    expect(run.sessions).toHaveLength(1)
    expect(run.calls).toHaveLength(4)
    expect(run.stdout).toContain("Leave it with /exit when you are done: the command then checks what it made and asks for your validation.")
    expect(run.stdout).toMatch(/folder  .*\/test-game\/platform/)
    expect(run.stdout).toContain("The session is over; what it made is below, as the platform shows it.")
    expect(run.stdout).toContain("✓ Test Game (game-test-game), published: 3 of 5 pictures")
    expect(run.stdout).toContain("  ✓ cover")
    expect(run.stdout).toContain("  ✗ icon")
    expect(stateOf(run).steps["platform-assets"]).toMatchObject({ status: "gate", gate: 0, rounds: 1, check: { ok: true } })
  })

  it("is not validated while the platform does not show the entry as published, and a message opens the session again with it", async () => {
    const none = sessionCall({ pictures: { exit: 1, lines: ["No published game has the slug test-game in the platform's Sanity project: publish its entry first (platform-catalog-entry)"] } })
    const again = sessionCall({ match: "^the logo is the wrong one", pictures: { exit: 0, lines: ["Test Game (game-test-game), published: 5 of 5 pictures", "  ✓ cover"] } })
    const run = await runCli({ args, answers: [...toTheSession, "validate", "the logo is the wrong one", "validate"], scenario: { calls: [...before(), none, again] } })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("✗ No published game has the slug test-game")
    expect(run.stdout).toContain("✗ The platform's Sanity does not show the entry of the game as published: type what to change (a session opens again with your message).")
    expect(run.sessions.map((session) => session.argv.at(-1))).toEqual([`/platform-assets ${run.assets}/${SLUG}/scout.json`, "the logo is the wrong one"])
    // the message goes to the session of the game, which is resumed
    expect(run.sessions[1]?.argv).toContain("--resume")
    expect(run.stdout).toContain("✓ Platform assets validated")
    expect(stateOf(run).steps["platform-assets"]).toMatchObject({ status: "validated", rounds: 2 })
  })

  it("resumes the session of the game that was interrupted, with a message that says so, and starts a fresh one with --new-session", async () => {
    const first = await runCli({ args, answers: [...toTheSession, "q"], scenario: { calls: [...before(), sessionCall()] } })
    const file = join(first.assets, SLUG, "pipeline.json")
    const left = JSON.parse(first.read(file)) as { steps: Record<string, { status: string }> }
    // what a command stopped in the middle of the session leaves
    left.steps["platform-assets"] = { ...(left.steps["platform-assets"] as { status: string }), status: "running" }
    writeFileSync(file, JSON.stringify(left))
    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["y", "q"], scenario: { calls: [sessionCall({ match: "^We were interrupted" })] } })
    expect(second.stdout).toContain("The last call of the platform assets step was interrupted.")
    expect(second.sessions).toHaveLength(1)
    expect(second.sessions[0]?.argv.slice(0, 4)).toEqual(["--model", "sonnet", "--resume", flagValue(first.calls[0] as LoggedCall, "--session-id") ?? ""])
    expect(second.sessions[0]?.argv.at(-1)).toContain("We were interrupted. Check what already exists")

    left.steps["platform-assets"] = { ...(left.steps["platform-assets"] as { status: string }), status: "pending" }
    writeFileSync(file, JSON.stringify(left))
    const third = await runCli({ args: [NAME, "--new-session", "--no-linear"], base: first.base, answers: ["q"], scenario: { calls: [sessionCall()] } })
    expect(third.sessions[0]?.argv).toContain("--session-id")
    expect(third.sessions[0]?.argv).not.toContain("--resume")
    expect(third.sessions[0]?.argv).toContain("add-game: Test Game")
  })

  it("is not run for a game whose pictures step is validated already, and is opened by nothing but the command", async () => {
    const first = await runCli({ args, answers: [...toTheSession, "validate"], scenario: { calls: [...before(), sessionCall()] } })
    expect(first.code).toBe(0)
    const again = await runCli({ args: [NAME, "--no-linear"], base: first.base })
    expect(again.sessions).toHaveLength(0)
    expect(again.stdout).toContain("Platform assets is validated already")
  })
})

describe("what the agent writes", () => {
  const ESC = String.fromCharCode(27)

  it("is printed and kept with no escape sequence in it: it read web pages, and a terminal obeys what it is sent", async () => {
    const hostile = scoutCall({ text: `${SCOUT_REPORT}\n${ESC}]0;owned${String.fromCharCode(7)}${ESC}[2Jfine ${ESC}[31mred${ESC}[0m\nhttps://pbgo.sanity.studio/ok`, tools: [{ name: "Bash", input: { command: `echo ${ESC}[2J hi` } }] })
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["q"], scenario: { calls: [hostile] } })
    expect(run.stdout).toContain("fine red")
    expect(run.stdout).toContain("$ echo hi")
    expect(run.stdout).not.toContain(ESC)
    expect(run.stderr).not.toContain(ESC)
    expect(stateOf(run).steps.scout?.report).not.toContain(ESC)
    expect(stateOf(run).steps.scout?.links).toEqual(["https://pbgo.sanity.studio/ok"])
  })

  it("is read from a failure too: what a failed call says is cleaned before it is shown", async () => {
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], scenario: { calls: [scoutCall({ isError: true, text: `${ESC}[2Jsomething failed`, errors: [] })] } })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain("something failed")
    expect(run.stderr).not.toContain(ESC)
  })
})

describe("before anything starts", () => {
  it("stops when claude is not logged in, and says what to run", async () => {
    const run = await runCli({ args: [NAME, "--yes"], scenario: { auth: { loggedIn: false, authMethod: "none" } } })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain("claude auth login")
    expect(run.calls).toHaveLength(0)
    expect(readdirSync(run.assets)).toEqual([])
  })

  it("stops when claude runs on an API key, or on a cloud provider", async () => {
    expect((await runCli({ args: [NAME, "--yes"], scenario: { auth: { loggedIn: true, authMethod: "api_key" } } })).stderr).toContain("API key")
    expect((await runCli({ args: [NAME, "--yes"], scenario: { auth: { loggedIn: true, authMethod: "third_party" } } })).stderr).toContain("cloud provider")
  })

  it("stops when Composio is not among claude's servers", async () => {
    const run = await runCli({ args: [NAME, "--yes"], scenario: { mcp: "Sanity: https://mcp.sanity.io (HTTP) - ✔ Connected" } })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain("Composio is not among")
    expect(run.calls).toHaveLength(0)
  })

  it("says that the key of the shell is left out of the calls", async () => {
    const run = await runCli({ args: [NAME, "--dry-run"] })
    expect(run.stdout).toContain("ANTHROPIC_API_KEY")
    expect(run.stdout).toContain("left out of the calls, the login is used")
  })

  it("refuses a name that makes no slug, or a step that does not exist", async () => {
    const run = await runCli({ args: ["!!!"] })
    expect(run.code).toBe(2)
    expect(run.invocations).toHaveLength(0)
    expect((await runCli({ args: [NAME, "--redo", "nonsense"] })).code).toBe(2)
    expect((await runCli({ args: [] })).stderr).toContain("Give the name of the game")
  })

  it("refuses a folder of the games' files whose path has a space, which the skills would take for two words", async () => {
    const run = await runCli({ args: [NAME, "--yes"], env: { PBGO_ASSETS_DIR: "/tmp/with space/assets" } })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain("has a space or a special character in its path")
    expect(run.calls).toHaveLength(0)
  })

  it("has nothing to do for a game that has a folder in the repo, and calls nothing", async () => {
    const run = await runCli({ args: ["Hanabi", "--yes"] })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("hanabi has a folder in the repo (games/hanabi)")
    expect(run.stdout).toContain("pnpm check:game hanabi")
    expect(run.invocations).toHaveLength(0)
  })

  it("asks before it makes anything, and cancels cleanly", async () => {
    const run = await runCli({ args: [NAME], answers: ["n"] })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("Cancelled, nothing was created.")
    expect(run.calls).toHaveLength(0)
    expect(readdirSync(run.assets)).toEqual([])
  })

  it("exits with a code of its own when the input is closed at the question", async () => {
    const run = await runCli({ args: [NAME] })
    expect(run.code).toBe(3)
    expect(readdirSync(run.assets)).toEqual([])
  })

  it("--dry-run prints the plan and the checks, calls no model and writes nothing", async () => {
    const run = await runCli({ args: [NAME, "--dry-run"] })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("Test Game (test-game)")
    expect(run.stdout).toContain("1. scout: /game-scout · gate validate")
    expect(run.stdout).toContain("2. catalog entry: /platform-catalog-entry · gates validate, publish")
    expect(run.stdout).toContain("3. rules spec: /game-rules-spec · gate validate")
    expect(run.stdout).toContain("4. platform assets: /platform-assets · gate validate · a session of your own")
    expect(run.stdout).toContain("claude 9.9.9 · claude.ai (max) · model sonnet")
    expect(run.stdout).toContain('"Test Game: add the game" and a sub-issue per step')
    expect(run.stdout).toContain("The repo is touched by one step, the rules spec, which writes docs/games/test-game/ and leaves it uncommitted. Nothing is published before the word publish.")
    expect(run.stdout).toContain("Nothing was created (--dry-run)")
    expect(run.calls).toHaveLength(0)
    expect(readdirSync(run.assets)).toEqual([])
  })
})

describe("at a gate", () => {
  it("does not take an empty line for a yes, nor refuses a message: a file that fails check:scout cannot be validated", async () => {
    const broken = scoutCall({ writes: [{ path: SCOUT_PATH, content: scoutJson(NAME, SLUG, { notes: ["BROKEN"] }) }] })
    const fixed = scoutCall({ match: "^fix the slug", text: `${SCOUT_REPORT}\n(fixed)` })
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["", "validate", "fix the slug", "validate", "q"], scenario: { calls: [broken, fixed, catalogCall()] } })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("Enter alone is not a yes.")
    expect(run.stdout).toContain("✗ fail ")
    expect(run.stdout).toContain("✗ The scout file does not pass the check above: type what to change.")
    expect(run.stdout).toContain("(fixed)")
    expect(run.stdout).toContain("✓ Scout validated")
    expect(run.calls.map((call) => promptOf(call).slice(0, 8))).toEqual(["/game-sc", "fix the ", "/platfor"])
  })

  it("says when the skill wrote no scout file, and does not validate", async () => {
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "q"], scenario: { calls: [{ match: "^/game-scout", text: "Test Game has a folder: it is not scouted.", cost: 0.1 }] } })
    expect(run.stdout).toContain("no scout file was written")
    expect(run.stdout).toContain("Test Game has a folder: it is not scouted.")
    expect(run.stdout).toContain("✗ The scout file does not pass the check above")
    expect(stateOf(run).steps.scout?.status).toBe("gate")
  })

  it("leaves the game saved when the input closes, and comes back to the same gate without calling anything", async () => {
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate"], scenario: { calls: [scoutCall(), catalogCall()] } })
    expect(first.code).toBe(3)
    expect(first.stdout).toContain("No answer (the input is closed)")
    expect(stateOf(first).steps.scout?.status).toBe("validated")
    expect(stateOf(first).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 0 })

    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["publish", "validate", "b", "q"] })
    expect(second.code).toBe(0)
    expect(second.calls).toHaveLength(0)
    expect(second.stdout).toMatch(/✓ scout\s+validated/)
    expect(second.stdout).toMatch(/… catalog entry\s+waits at its gate: validate/)
    expect(second.stdout).toContain("the report is shown again, nothing is called")
    expect(second.stdout).toContain("validate comes first: publish is asked once the work is validated.")
    expect(second.stdout).toContain("publish makes 2 documents public")
    expect(second.stdout).toContain("Stopped. Everything is saved")
    expect(stateOf(second).steps["catalog-entry"]).toMatchObject({ status: "gate", gate: 0 })
  })

  it("moves the game's folder to the slug that the scout settled, and goes on from there", async () => {
    const renamed = scoutCall({ writes: [{ path: SCOUT_PATH, content: scoutJson("Other Game", "other-game") }] })
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate"], scenario: { calls: [renamed, catalogCall()] } })
    expect(existsSync(join(run.assets, SLUG))).toBe(false)
    const state = stateOf(run, "other-game")
    expect(state).toMatchObject({ name: "Other Game", slug: "other-game" })
    expect(state.aliases).toEqual([NAME, "Other Game"])
    expect(promptOf(run.calls[1])).toBe(`/platform-catalog-entry ${run.assets}/other-game/scout.json`)
    expect(existsSync(join(run.assets, "other-game", "pipeline.lock"))).toBe(false)

    // the game is found by either name
    const list = await runCli({ args: ["--list"], base: run.base })
    expect(list.stdout).toContain("other-game")
    const again = await runCli({ args: [NAME, "--dry-run"], base: run.base })
    expect(again.stdout).toContain("Other Game (other-game)")
  })

  it("goes on when the folder is at the slug already: a run that stopped between the move of the folder and the save of its state", async () => {
    const renamed = scoutCall({ writes: [{ path: SCOUT_PATH, content: scoutJson("Other Game", "other-game") }] })
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], scenario: { calls: [renamed] } })
    expect(first.code).toBe(3)
    // what that run would have left: the folder at the new slug, its state still at the old one
    renameSync(join(first.assets, SLUG), join(first.assets, "other-game"))
    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["validate", "q"], scenario: { calls: [catalogCall()] } })
    expect(second.code).toBe(0)
    expect(second.stdout).toContain("✓ Scout validated")
    expect(second.stdout).not.toContain("already exists")
    expect(stateOf(second, "other-game")).toMatchObject({ name: "Other Game", slug: "other-game" })
    expect(promptOf(second.calls[0])).toBe(`/platform-catalog-entry ${second.assets}/other-game/scout.json`)
    expect(existsSync(join(second.assets, "other-game", "pipeline.lock"))).toBe(false)
  })

  it("does not validate a scout whose slug is a game that has a folder in the repo", async () => {
    const clash = scoutCall({ writes: [{ path: SCOUT_PATH, content: scoutJson("Hanabi", "hanabi") }] })
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate", "q"], scenario: { calls: [clash] } })
    expect(run.stdout).toContain("games/hanabi exists already")
    expect(stateOf(run).steps.scout?.status).toBe("gate")
  })
})

describe("when a call does not go well", () => {
  it("stops at a call that ran on a key, before it did anything", async () => {
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], scenario: { calls: [scoutCall({ apiKeySource: "ANTHROPIC_API_KEY" })] } })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain("the call ran on ANTHROPIC_API_KEY instead of your login")
    expect(stateOf(run).steps.scout?.status).toBe("failed")
  })

  it("keeps the game when the budget is reached, and resumes the session at the next run", async () => {
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], scenario: { calls: [scoutCall({ subtype: "error_max_budget_usd", isError: true, errors: ["Reached maximum budget ($3)"], terminalReason: "budget_exhausted", text: "" })] } })
    expect(first.code).toBe(1)
    expect(first.stderr).toContain("the budget of the call was reached")
    expect(first.stderr).toContain("PBGO_ADD_GAME_BUDGET_USD")
    expect(first.stderr).toContain("run the command again")
    expect(stateOf(first).steps.scout).toMatchObject({ status: "failed" })

    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["q"], scenario: { calls: [scoutCall({ match: "interrupted or stopped" })] } })
    expect(second.code).toBe(0)
    const session = flagValue(first.calls[0] as LoggedCall, "--session-id")
    expect(flagValue(second.calls[0] as LoggedCall, "--resume")).toBe(session)
    expect(promptOf(second.calls[0])).toContain("Check what already exists")
    expect(stateOf(second).steps.scout?.status).toBe("gate")
  })

  it("stops on Ctrl-C, keeps the session, and offers to resume it", async () => {
    const started = join(world(), "started")
    const hanging = { match: "^/game-scout", hang: true, startedFile: started, tools: [{ name: "WebSearch", input: { query: "waiting" } }] }
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], scenario: { calls: [hanging] }, interrupt: { when: /search "waiting"/ }, keepStdin: true })
    expect(first.code).toBe(130)
    expect(first.stdout).toContain("Stopped (Ctrl-C). The session is saved: run the command again to resume it.")
    expect(stateOf(first).steps.scout?.status).toBe("running")
    expect(existsSync(join(first.assets, SLUG, "pipeline.lock"))).toBe(false)

    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["y", "q"], scenario: { calls: [scoutCall({ match: "interrupted or stopped" })] } })
    expect(second.code).toBe(0)
    expect(second.stdout).toContain("The last call of the scout step was interrupted.")
    expect(second.stdout).toContain("Resume its session? [Y/n]")
    expect(flagValue(second.calls[0] as LoggedCall, "--resume")).toBe(flagValue(first.calls[0] as LoggedCall, "--session-id"))
    expect(stateOf(second).steps.scout?.status).toBe("gate")
  })

  it("stops on Ctrl-C during the bookkeeping too, before the game goes on", async () => {
    const hanging: CallSpec = {
      match: "bookkeeping step",
      hang: true,
      tools: [{ name: "mcp__claude_ai_Composio__COMPOSIO_MULTI_EXECUTE_TOOL", input: { tools: [{ tool_slug: "LINEAR_CREATE_LINEAR_ISSUE", arguments: {} }] } }],
    }
    const run = await runCli({ args: [NAME, "--yes"], scenario: { calls: [hanging] }, interrupt: { when: /Composio LINEAR_CREATE_LINEAR_ISSUE/ }, keepStdin: true })
    expect(run.code).toBe(130)
    expect(run.stdout).toContain("Stopped (Ctrl-C). Nothing of the game is lost")
    // the scout never started
    expect(run.calls).toHaveLength(1)
    expect(existsSync(join(run.assets, SLUG, "pipeline.lock"))).toBe(false)
  })

  it("starts the step again, in the same session, when the owner would rather not resume", async () => {
    const hanging = { match: "^/game-scout", hang: true, tools: [{ name: "WebSearch", input: { query: "waiting" } }] }
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], scenario: { calls: [hanging] }, interrupt: { when: /search "waiting"/ }, keepStdin: true })
    const second = await runCli({ args: [NAME, "--no-linear"], base: first.base, answers: ["n", "q"], scenario: { calls: [scoutCall()] } })
    expect(promptOf(second.calls[0])).toBe(`/game-scout ${NAME} --out ${second.assets}/${SLUG}/scout.json`)
    expect(flagValue(second.calls[0] as LoggedCall, "--resume")).toBe(flagValue(first.calls[0] as LoggedCall, "--session-id"))
  })

  it("goes on when Linear cannot be reached, says so, and tries again at the next point", async () => {
    const down = linearCall({})
    down.isError = true
    down.structured = undefined
    down.text = "Composio is down"
    const run = await runCli({
      args: [NAME, "--yes"],
      answers: ["validate", "q"],
      scenario: { calls: [down, scoutCall(), linearCall({ parent: "In Progress", scout: "Done", "catalog-entry": "In Progress" }, ["scout"]), catalogCall()] },
    })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain("! Linear was not updated (Composio is down): the game goes on, the next point tries again")
    expect(run.stdout).toContain("✓ Scout validated")
    // the second point made what the first could not: the parent, and both issues
    expect(stateOf(run).linear.error).toBeNull()
    expect(stateOf(run).linear.parent?.identifier).toBe("GAM-40")
  })
})

describe("coming back to a game", () => {
  it("takes a step and the ones after it back with --redo, in the same session", async () => {
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate"], scenario: { calls: [scoutCall(), catalogCall()] } })
    expect(stateOf(first).steps.scout?.status).toBe("validated")
    const second = await runCli({ args: [NAME, "--redo", "scout", "--no-linear"], base: first.base, answers: ["q"], scenario: { calls: [scoutCall({ text: `${SCOUT_REPORT}\n(again)` })] } })
    expect(second.code).toBe(0)
    expect(second.stdout).toContain("(again)")
    const state = stateOf(second)
    expect(state.steps.scout?.status).toBe("gate")
    expect(state.steps["catalog-entry"]?.status).toBe("pending")
    expect(state.steps["rules-spec"]?.status).toBe("pending")
    expect(state.steps["platform-assets"]?.status).toBe("pending")
    expect(flagValue(second.calls[0] as LoggedCall, "--resume")).toBe(flagValue(first.calls[0] as LoggedCall, "--session-id"))
  })

  it("has nothing to redo for a game that is not in the pipeline", async () => {
    const run = await runCli({ args: [NAME, "--redo", "scout"] })
    expect(run.code).toBe(2)
    expect(run.stderr).toContain("is not in the pipeline yet")
  })

  it("starts a fresh session with --new-session, for the next call only", async () => {
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["q"], scenario: { calls: [scoutCall()] } })
    const old = flagValue(first.calls[0] as LoggedCall, "--session-id")
    const second = await runCli({ args: [NAME, "--new-session", "--no-linear"], base: first.base, answers: ["change something", "q"], scenario: { calls: [scoutCall({ match: "^change something" })] } })
    const fresh = flagValue(second.calls[0] as LoggedCall, "--session-id")
    expect(fresh).toMatch(/^[0-9a-f-]{36}$/)
    expect(fresh).not.toBe(old)
    expect(flagValue(second.calls[0] as LoggedCall, "--name")).toBe("add-game: Test Game")
    expect(stateOf(second).session).toEqual({ id: fresh, started: true })
  })

  it("lists the games that are in the pipeline and where each stands", async () => {
    const first = await runCli({ args: [NAME, "--yes", "--no-linear"], answers: ["validate"], scenario: { calls: [scoutCall(), catalogCall()] } })
    const list = await runCli({ args: ["--list"], base: first.base })
    expect(list.code).toBe(0)
    expect(list.stdout).toContain("Games in the pipeline")
    expect(list.stdout).toContain("test-game  Test Game: scout validated · catalog entry at its gate (validate) · rules spec not started · platform assets not started")
    const none = await runCli({ args: ["--list"] })
    expect(none.stdout).toContain("No game is in the pipeline")
  })

  it("will not run twice on one game at once", async () => {
    const base = world()
    mkdirSync(join(base, "assets", SLUG), { recursive: true })
    writeFileSync(join(base, "assets", SLUG, "pipeline.lock"), String(process.pid))
    const run = await runCli({ args: [NAME, "--yes", "--no-linear"], base })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain("another run of this game is in progress")
    expect(run.calls).toHaveLength(0)
  })
})

describe("--check", () => {
  it("passes when claude is ready, and says so before it calls anything", async () => {
    const calls: CallSpec[] = [
      {
        match: "self-test",
        text: "ok",
        cost: 0.01,
        tools: [
          { name: "ToolSearch", input: { query: "select:mcp__claude_ai_Composio__COMPOSIO_SEARCH_TOOLS" } },
          { name: "Read", input: { file_path: `${REPO}/.claude/skills/game-scout/SKILL.md`, limit: 1 } },
        ],
        denials: [
          { tool: "Write", input: { file_path: `${REPO}/PBGO_CHECK_REFUSED.txt` }, reason: "a step writes only under the folder", hook: true },
          { tool: "Bash", input: { command: "curl --version" } },
          { tool: "Read", input: { file_path: `${REPO}/node_modules/.modules.yaml`, limit: 1 }, reason: "a step reads the files of the project, not the ones that git ignores", hook: true },
        ],
        apiKeySource: "none",
      },
    ]
    const run = await runCli({ args: ["--check"], scenario: { calls } })
    // the stand-in does not write the allowed file nor find the tools: the check says exactly which of its lines it could not see
    expect(run.stdout).toContain("claude 9.9.9 · claude.ai (max)")
    expect(run.stdout).toContain("login, skills and Composio are there")
    expect(run.stdout).toContain("✓ the call runs on your login (apiKeySource: none)")
    expect(run.stdout).toContain("✓ the guard refuses a write in the repo")
    expect(run.stdout).toContain("✓ a command that is on no list is refused")
    expect(run.stdout).toContain("✓ a file of the project (a skill's) can be read")
    expect(run.stdout).toContain("✓ a file of the repo that git ignores is refused")
    // what the self-test is allowed: the one file it writes, and no Composio
    expect(run.calls[0]?.policy).toMatchObject({ repoRoot: REPO, writeFiles: [expect.stringMatching(/\/allowed\.txt$/)], readFiles: [], bash: [], composio: null })
    expect(run.calls[0]?.env.PBGO_PUBLISH_OK).toBe("0")
    expect(run.stdout).toContain("✗ the guard lets a write inside the game's folder through")
    expect(run.stdout).toContain("✗ Composio's tools are found by a headless run")
    expect(run.code).toBe(1)
    // the file that must never be made is not there
    expect(existsSync(join(REPO, "PBGO_CHECK_REFUSED.txt"))).toBe(false)
  })

  it("stops before the call when claude is not ready", async () => {
    const run = await runCli({ args: ["--check"], scenario: { auth: { loggedIn: false, authMethod: "none" } } })
    expect(run.code).toBe(1)
    expect(run.stderr).toContain("claude auth login")
    expect(run.calls).toHaveLength(0)
  })
})

describe("--help", () => {
  it("lists the steps and the options", async () => {
    const run = await runCli({ args: [NAME, "--help"] })
    expect(run.code).toBe(0)
    expect(run.stdout).toContain('Usage: pnpm add-game "<Game Name>"')
    expect(run.stdout).toContain("scout (/game-scout), then catalog entry (/platform-catalog-entry), then rules spec (/game-rules-spec), then platform assets (/platform-assets)")
    for (const option of ["--dry-run", "--yes", "--no-linear", "--new-session", "--redo", "--list", "--check"]) expect(run.stdout).toContain(option)
  })
})

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { REPO_ROOT } from "./config.ts"
import { issueIdsOf, LINEAR, linearPolicy } from "./linear.ts"
import { decide, draftIdOk, hookSettings, isNodeOneLiner, isPublishedId, linearGraphqlProblem, mentionsSecret, mutationsProblem, ONE_LINER_BODIES, PLATFORM_SANITY, type Call, type Helpers, type Policy } from "./policy.ts"
import { newState } from "./state.ts"
import { CATALOG_ENTRY, gameOf, RULES_SPEC, SCOUT } from "./steps.ts"

const SERVER = "claude_ai_Composio"
const HOME = "/Users/ada"
const game = gameOf("/assets", "Love Letter", "love-letter")
const DOCS = "/repo/docs/games"
const scout: Policy = SCOUT.policy(game, "/repo", { composioServer: SERVER, publishIds: [], gamesDocs: DOCS })
const catalog: Policy = CATALOG_ENTRY.policy(game, "/repo", { composioServer: SERVER, publishIds: [], gamesDocs: DOCS })
const catalogPublishing: Policy = CATALOG_ENTRY.policy(game, "/repo", { composioServer: SERVER, publishIds: ["game-love-letter", "publisher-sample"], gamesDocs: DOCS })
const spec: Policy = RULES_SPEC.policy(game, "/repo", { composioServer: SERVER, publishIds: [], gamesDocs: DOCS })
const linear: Policy = linearPolicy(game, "/repo", { composioServer: SERVER, issueIds: ["issue-1", "GAM-41"] })
const bash = (command: string): Call => ({ tool_name: "Bash", tool_input: { command } })
const executor = (...calls: { slug: string; args?: Record<string, unknown> }[]): Call => ({
  tool_name: `mcp__${SERVER}__COMPOSIO_MULTI_EXECUTE_TOOL`,
  tool_input: { tools: calls.map((call) => ({ tool_slug: call.slug, arguments: call.args ?? {} })), sync_response_to_workbench: false },
})
const sanity = (slug: string, extra: Record<string, unknown> = {}) => ({ slug, args: { project_id: PLATFORM_SANITY.projectId, dataset: PLATFORM_SANITY.dataset, ...extra } })
const helpers: Helpers = { home: HOME, ignored: (path) => path.includes("/node_modules/") || path.endsWith("/dist.js") }
const kind = (policy: Policy, call: Call, env: Record<string, string | undefined> = {}) => decide(policy, call, env, helpers).decision
const reason = (policy: Policy, call: Call, env: Record<string, string | undefined> = {}) => {
  const decision = decide(policy, call, env, helpers)
  return decision.decision === "none" ? "" : decision.reason
}

describe("files of secrets", () => {
  it("are recognised wherever they are named", () => {
    for (const text of ["apps/web/.env.local", "cat .env", "/Users/ada/.config/pbgo/secrets.env", "~/.ssh/id_rsa", ".vercel/project.json", "x/.sanity-project-id", "~/.claude/settings.json", "/Users/ada/.claude/settings.json", "$HOME/.claude.json", "credentials.json", "~/.npmrc", "key.pem"]) {
      expect(mentionsSecret(text, HOME), text).toBe(true)
    }
  })

  it("are not mistaken for what looks like them, and the project's own .claude folder is not the owner's", () => {
    for (const text of ["process.env.HOME", "the environment", ".environment", "pnpm check:scout /assets/love-letter/scout.json", "love-letter", "Environment Game", "https://example.com/rules.pdf", "/repo/.claude/skills/game-scout/SKILL.md", ".claude/skills/README.md"]) {
      expect(mentionsSecret(text, HOME), text).toBe(false)
    }
  })
})

describe("writing", () => {
  it("is allowed to the file of the step and to no other, not even in the folder of the game", () => {
    expect(kind(scout, { tool_name: "Write", tool_input: { file_path: "/assets/love-letter/scout.json" } })).toBe("allow")
    expect(kind(scout, { tool_name: "Edit", tool_input: { file_path: "/assets/love-letter/scout.json" } })).toBe("allow")
    // what the command keeps in the same folder: its state, its lock, the policy of the call, the settings that register the hook, the log of the hook
    for (const file_path of [
      "/assets/love-letter/pipeline.json",
      "/assets/love-letter/pipeline.lock",
      "/assets/love-letter/.pipeline/scout.policy.json",
      "/assets/love-letter/.pipeline/scout.settings.json",
      "/assets/love-letter/.pipeline/guard.log",
      "/assets/love-letter/notes/a.md",
    ]) {
      expect(reason(scout, { tool_name: "Write", tool_input: { file_path } }), file_path).toContain("only /assets/love-letter/scout.json")
      expect(kind(scout, { tool_name: "Write", tool_input: { file_path } }), file_path).toBe("deny")
    }
  })

  it("is refused outside the folder, with the reason", () => {
    for (const file_path of ["/repo/apps/web/src/x.ts", "/assets/love-letter-2/scout.json", "/assets/other/scout.json", "/assets/love-letter/../other/x", "/tmp/x", "/assets/love-letter/scout.json/../pipeline.json"]) {
      expect(kind(scout, { tool_name: "Write", tool_input: { file_path } }), file_path).toBe("deny")
    }
    expect(kind(scout, { tool_name: "Write", tool_input: {} })).toBe("deny")
  })

  it("is refused to a step that writes no file, whatever it aims at", () => {
    expect(reason(catalog, { tool_name: "Write", tool_input: { file_path: "/assets/love-letter/scout.json" } })).toContain("no file")
    expect(kind(linear, { tool_name: "Write", tool_input: { file_path: "/assets/love-letter/x" } })).toBe("deny")
  })

  it("never touches a file of secrets, even in the folder of the game", () => {
    expect(kind(scout, { tool_name: "Write", tool_input: { file_path: "/assets/love-letter/.env" } })).toBe("deny")
    expect(kind(scout, { tool_name: "Write", tool_input: { file_path: "~/.claude/settings.json" } })).toBe("deny")
  })
})

describe("reading", () => {
  it("is the mode's business inside the repo, allowed for the file of the step, refused elsewhere", () => {
    expect(kind(scout, { tool_name: "Read", tool_input: { file_path: "/repo/packages/games/src/slug.ts" } })).toBe("none")
    expect(kind(scout, { tool_name: "Read", tool_input: { file_path: "/repo/.claude/skills/game-scout/SKILL.md" } })).toBe("none")
    expect(kind(scout, { tool_name: "Read", tool_input: { file_path: "/assets/love-letter/scout.json" } })).toBe("allow")
    expect(kind(catalog, { tool_name: "Read", tool_input: { file_path: "/assets/love-letter/scout.json" } })).toBe("allow")
    // not the state of the game, nor the policy of the call, nor another game's file
    for (const file_path of ["/assets/love-letter/pipeline.json", "/assets/love-letter/.pipeline/scout.policy.json", "/assets/other/scout.json", "/etc/passwd", "/Users/ada/.zshrc"]) {
      expect(kind(scout, { tool_name: "Read", tool_input: { file_path } }), file_path).toBe("deny")
    }
    expect(kind(scout, { tool_name: "Read", tool_input: { file_path: "/repo/apps/web/.env.local" } })).toBe("deny")
    expect(kind(scout, { tool_name: "Read", tool_input: { file_path: "/Users/ada/.config/pbgo/secrets.env" } })).toBe("deny")
  })

  it("is refused for a file of the repo that git ignores, whatever its name", () => {
    expect(kind(scout, { tool_name: "Read", tool_input: { file_path: "/repo/node_modules/x/index.js" } })).toBe("deny")
    expect(reason(scout, { tool_name: "Read", tool_input: { file_path: "/repo/build/dist.js" } })).toContain("git ignores")
    expect(kind(scout, { tool_name: "Read", tool_input: { file_path: "/repo/build/index.js" } })).toBe("none")
  })

  it("is not for the tools that search: Grep and Glob read files that the policy cannot judge one by one", () => {
    for (const tool_name of ["Grep", "Glob"]) expect(kind(scout, { tool_name, tool_input: { pattern: "KEY", path: "/repo" } }), tool_name).toBe("deny")
  })
})

// The commands the two skills run, as they are in their text: the skill is the source, `template` must still be in it (a skill that changes a command
// fails this test, and the policy is looked at again), and `filled` is the command with its placeholders filled, which the policy must allow.
const SAMPLES = [
  { skill: "game-scout", template: 'pnpm --filter @pbgo/platform content:bgg-lookup "<name>"', filled: 'pnpm --filter @pbgo/platform content:bgg-lookup "Love Letter"' },
  { skill: "game-scout", template: "pnpm --filter @pbgo/platform content:bgg-lookup --id <n> --versions --language English", filled: "pnpm --filter @pbgo/platform content:bgg-lookup --id 129622 --versions --language English" },
  { skill: "game-scout", template: "pnpm check:scout --list", filled: "pnpm check:scout --list" },
  { skill: "game-scout", template: "pnpm check:scout <file> --online", filled: "pnpm check:scout /assets/love-letter/scout.json --online" },
  { skill: "game-scout", template: "pnpm catalog:list", filled: "pnpm catalog:list" },
  { skill: "game-scout", template: "pnpm check:game <slug>", filled: "pnpm check:game love-letter" },
  {
    skill: "game-scout",
    template: `node --disable-warning=ExperimentalWarning -e 'import("./packages/games/src/slug.ts").then(({ slugFromName, slugProblem }) => { const slug = slugFromName(process.argv[1]); console.log(slug, slugProblem(slug) ?? "ok") })' "<name>"`,
    filled: `node --disable-warning=ExperimentalWarning -e 'import("./packages/games/src/slug.ts").then(({ slugFromName, slugProblem }) => { const slug = slugFromName(process.argv[1]); console.log(slug, slugProblem(slug) ?? "ok") })' "Love Letter"`,
  },
  {
    skill: "game-scout",
    template: `node --disable-warning=ExperimentalWarning -e 'import("./packages/games/src/slug.ts").then(({ slugFromName, slugProblem }) => { const slug = process.argv[1] + "-" + slugFromName(process.argv[2]); console.log(slug, slugProblem(slug, [], "expansion") ?? "ok") })' "<base slug>" "<name>"`,
    filled: `node --disable-warning=ExperimentalWarning -e 'import("./packages/games/src/slug.ts").then(({ slugFromName, slugProblem }) => { const slug = process.argv[1] + "-" + slugFromName(process.argv[2]); console.log(slug, slugProblem(slug, [], "expansion") ?? "ok") })' "bang" "Legends"`,
  },
]
const CATALOG_SAMPLES = [
  { skill: "platform-catalog-entry", template: "pnpm check:scout <file>", filled: "pnpm check:scout /assets/love-letter/scout.json" },
  { skill: "platform-catalog-entry", template: "pnpm catalog:list", filled: "pnpm catalog:list" },
  {
    skill: "platform-catalog-entry",
    template: `node -e 'import("./packages/games/src/slug.ts").then(({ slugProblem, nameProblem }) => { const [slug, name, kind] = process.argv.slice(1); console.log(slugProblem(slug, [], kind) ?? "slug ok", "|", nameProblem(name) ?? "name ok") })' <slug> "<Name>" game`,
    filled: `node -e 'import("./packages/games/src/slug.ts").then(({ slugProblem, nameProblem }) => { const [slug, name, kind] = process.argv.slice(1); console.log(slugProblem(slug, [], kind) ?? "slug ok", "|", nameProblem(name) ?? "name ok") })' love-letter "Love Letter" game`,
  },
  { skill: "platform-catalog-entry", template: `node -e 'console.log(process.argv[1].length)' "<the description>"`, filled: `node -e 'console.log(process.argv[1].length)' "A short text about the game."` },
]

describe("the rules spec", () => {
  const pages = [`${DOCS}/love-letter/rules.md`, `${DOCS}/love-letter/index.md`]
  const write = (file: string): Call => ({ tool_name: "Write", tool_input: { file_path: file, content: "# Love Letter: rules spec" } })

  it("writes the two pages of the game in the docs, and no other file of the repo", () => {
    for (const file of pages) {
      expect(kind(spec, write(file)), file).toBe("allow")
      expect(kind(spec, { tool_name: "Edit", tool_input: { file_path: file, old_string: "a", new_string: "b" } }), file).toBe("allow")
    }
    for (const file of [`${DOCS}/love-letter/notes.md`, `${DOCS}/love-letter/rules.md.bak`, `${DOCS}/index.md`, `${DOCS}/flip-7/rules.md`, `${DOCS}/love-letter/../flip-7/rules.md`, "/repo/docs/engine/index.md", "/repo/CLAUDE.md", "/repo/.claude/skills/game-rules-spec/SKILL.md", "/repo/packages/games/src/registry.ts", "/assets/love-letter/scout.json", "/assets/love-letter/rules.pdf", "/assets/love-letter/pipeline.json"]) {
      expect(kind(spec, write(file)), file).toBe("deny")
    }
    expect(spec.writeFiles).toEqual(pages)
  })

  it("never touches a file of secrets, even where it writes", () => {
    expect(kind(spec, write(`${DOCS}/love-letter/.env`))).toBe("deny")
    expect(kind(spec, write("/repo/apps/web/.env.local"))).toBe("deny")
  })

  it("reads the scout file and the rulebook of its game outside the repo, and nothing else there", () => {
    for (const file of ["/assets/love-letter/scout.json", "/assets/love-letter/rules.pdf"]) expect(kind(spec, { tool_name: "Read", tool_input: { file_path: file, pages: "1-8" } }), file).toBe("allow")
    for (const file of ["/assets/love-letter/pipeline.json", "/assets/love-letter/.pipeline/rules-spec.policy.json", "/assets/flip-7/rules.pdf", "/Users/ada/Downloads/rules.pdf", "/etc/hosts"]) expect(kind(spec, { tool_name: "Read", tool_input: { file_path: file } }), file).toBe("deny")
    // the repo is the mode's business: the page it writes and the skills it follows are read there
    expect(kind(spec, { tool_name: "Read", tool_input: { file_path: pages[0] } })).toBe("none")
  })

  it("runs the check of its own game, the check of its scout file, the date and the folder of its pages", () => {
    for (const command of ["pnpm check:rules love-letter", "pnpm check:scout /assets/love-letter/scout.json", "pnpm check:scout /assets/love-letter/scout.json --online", "date +%F", `mkdir -p ${DOCS}/love-letter`, `mkdir -p "${DOCS}/love-letter"`]) {
      expect(kind(spec, bash(command)), command).toBe("allow")
    }
  })

  it("runs no other command: another game's check, an option, a chain, a folder that is not its own", () => {
    for (const command of [
      "pnpm check:rules flip-7",
      "pnpm check:rules love-letter --name Evil",
      "pnpm check:rules love-letter; cat /etc/passwd",
      "pnpm check:rules love-letter && ls",
      "pnpm check:rules ../love-letter",
      `mkdir -p ${DOCS}`,
      `mkdir -p ${DOCS}/flip-7`,
      "mkdir -p /repo/docs/engine/x",
      "curl -o /assets/love-letter/rules.pdf https://example.com/rules.pdf",
      "pnpm check:game love-letter",
      "pnpm add-game love-letter",
      "git commit -am x",
      "cat /assets/love-letter/rules.pdf",
    ]) {
      expect(kind(spec, bash(command)), command).toBe("deny")
    }
  })

  it("has no access to Composio, and so to no Sanity and no Linear", () => {
    expect(spec.composio).toBeNull()
    expect(kind(spec, executor(sanity("SANITY_QUERY_DOCUMENTS")))).toBe("deny")
  })

  it("does not read a file of the repo that git ignores", () => {
    expect(kind(spec, { tool_name: "Read", tool_input: { file_path: "/repo/node_modules/x/dist.js" } })).toBe("deny")
  })
})

describe("the commands of the skills", () => {
  const text = (skill: string) => readFileSync(join(REPO_ROOT, ".claude", "skills", skill, "SKILL.md"), "utf8")

  it("are still in the skills, word for word (the policy was written from them)", () => {
    for (const sample of [...SAMPLES, ...CATALOG_SAMPLES]) expect(text(sample.skill), sample.template).toContain(sample.template)
  })

  it("keep their one-liners in the list that the policy takes code from", () => {
    // every `node -e '<code>'` of a skill is one of ONE_LINER_BODIES: a one-liner added to a skill is refused until it is added there, on purpose
    for (const skill of ["game-scout", "platform-catalog-entry"]) {
      for (const match of text(skill).matchAll(/node (?:--disable-warning=ExperimentalWarning )?-e '([^']*)'/g)) expect(ONE_LINER_BODIES, `${skill}: ${match[1]}`).toContain(match[1])
    }
  })

  it("are allowed to the step that runs them", () => {
    for (const sample of SAMPLES) expect(kind(scout, bash(sample.filled)), sample.filled).toBe("allow")
    for (const sample of CATALOG_SAMPLES) expect(kind(catalog, bash(sample.filled)), sample.filled).toBe("allow")
    expect(kind(scout, bash("mkdir -p /assets/love-letter"))).toBe("allow")
    expect(kind(scout, bash('mkdir -p "/assets/love-letter"'))).toBe("allow")
    expect(kind(scout, bash("date +%F"))).toBe("allow")
  })

  it("are refused to the step that does not run them", () => {
    expect(kind(catalog, bash("pnpm check:game love-letter"))).toBe("deny")
    expect(kind(catalog, bash('pnpm --filter @pbgo/platform content:bgg-lookup "Love Letter"'))).toBe("deny")
    expect(kind(linear, bash("pnpm catalog:list"))).toBe("deny")
  })
})

describe("shell commands", () => {
  it("are refused, and not left to the mode, when no rule allows them: the mode lets a read-only command run, and a file of the repo with it", () => {
    for (const command of ["curl https://example.com", "rm -rf /", "git push", "pnpm add-game --yes foo", "pnpm install", "mkdir -p /assets/other", "node script.js", "cat packages/pipeline/src/policy.ts", "ls -la", "grep -r token .", "head -1 apps/web/package.json", "echo hello", "env", "printenv"]) {
      expect(kind(scout, bash(command)), command).toBe("deny")
    }
    expect(reason(scout, bash("ls"))).toContain("only the commands its skill gives")
    expect(kind(scout, bash(""))).toBe("deny")
  })

  it("cannot be chained, redirected or expanded past a rule", () => {
    for (const command of [
      "pnpm check:scout /assets/love-letter/scout.json; rm -rf /",
      "pnpm check:scout x && curl evil.example",
      "pnpm check:scout x | sh",
      "pnpm check:scout $(whoami)",
      "pnpm check:scout `whoami`",
      "pnpm check:scout x > /tmp/y",
      "pnpm catalog:list; ls",
      'pnpm check:scout "$HOME"',
      "date; id",
      "pnpm check:game love-letter\nrm -rf /",
    ]) {
      expect(kind(scout, bash(command)), command).toBe("deny")
    }
  })

  it("never name a file of secrets", () => {
    expect(reason(scout, bash("cat apps/web/.env.local"))).toContain("secrets")
    expect(reason(scout, bash("grep -r KEY ~/.config/pbgo"))).toContain("secrets")
    expect(reason(scout, bash("pnpm check:scout /repo/apps/web/.env.local"))).toContain("secrets")
  })

  it("let pnpm check:scout read the files of the game's folder, and no other file or option", () => {
    expect(kind(scout, bash("pnpm check:scout /assets/love-letter/scout.json --online"))).toBe("allow")
    expect(kind(scout, bash("pnpm check:scout /assets/love-letter/other.json"))).toBe("allow")
    expect(kind(scout, bash("pnpm check:scout --list"))).toBe("allow")
    for (const command of ["pnpm check:scout /repo/packages/games/src/slug.ts", "pnpm check:scout /etc/passwd", "pnpm check:scout /assets/other/scout.json", "pnpm check:scout /assets/love-letter/../other/scout.json", "pnpm check:scout --help", "pnpm check:scout -r /assets/love-letter/scout.json", "pnpm check:scout relative.json"]) {
      expect(kind(scout, bash(command)), command).toBe("deny")
    }
    expect(reason(scout, bash("pnpm check:scout /etc/passwd"))).toContain("/assets/love-letter")
  })

  it("take a node one-liner only when its code is one of the skills', word for word, whatever the arguments", () => {
    expect(isNodeOneLiner(`node -e 'console.log(process.argv[1].length)' "text"`)).toBe(true)
    for (const body of ONE_LINER_BODIES) expect(isNodeOneLiner(`node -e '${body}' a "b c" 'd e'`), body).toBe(true)
    for (const command of [
      `node -e 'require("fs").readFileSync("/etc/passwd")'`,
      `node -e 'import("node:fs").then((fs) => fs.readFileSync("/etc/passwd"))'`,
      `node -e 'import("./packages/games/src/slug.ts").then(() => fetch("https://evil.example"))'`,
      `node -e 'import("./packages/games/src/slug.ts").then(() => process.env.SECRET)'`,
      `node -e 'import("./packages/games/src/slug.ts").then(() => import("node:child_process"))'`,
      `node -e 'import("./packages/games/src/slug.ts").then(() => eval("1"))'`,
      `node -e 'console.log(1)'`,
      `node -e 'console.log(process.argv[1].length)' "$(whoami)"`,
      `node -e 'console.log(process.argv[1].length)'; rm -rf /`,
      `node --inspect -e 'console.log(process.argv[1].length)'`,
      // code that a filter on tokens would let through: a string put together, a built-in module asked for by name
      `node -e 'import("./packages/games/src/slug.ts").then(() => process.getBuiltinModule("child" + "_process").execSync("id"))'`,
      `node -e 'import("./packages/games/src/slug.ts").then(({ slugFromName }) => console.log(slugFromName(process.argv[1]), globalThis["pro" + "cess"].argv))'`,
      `node -e 'console.log(process.argv[1].length); console.log(process.argv[2])'`,
    ]) {
      expect(isNodeOneLiner(command), command).toBe(false)
    }
  })

  it("never take the options that Node reads after the code: the one-liner is the code, the rest are plain words", () => {
    const code = "console.log(process.argv[1].length)"
    for (const tail of [`--eval 'require("child_process").execSync("id")'`, "--eval=1", "-p 1", "--print 1", "--import=./x.mjs", "--require ./x.js", "-r ./x.js", "--input-type=module", "--experimental-loader x", "--"]) {
      expect(isNodeOneLiner(`node -e '${code}' ${tail}`), tail).toBe(false)
      expect(isNodeOneLiner(`node -e '${code}' text ${tail}`), tail).toBe(false)
    }
    expect(kind(scout, bash(`node -e '${code}' --eval 'process.exit(1)'`))).toBe("deny")
    expect(kind(catalog, bash(`node -e '${code}' -p 1`))).toBe("deny")
  })
})

describe("what Sanity may be sent", () => {
  const scope = { gameSlug: "love-letter", publishIds: ["game-love-letter", "publisher-sample"] }
  const draftsOnly = [
    { createIfNotExists: { _id: "drafts.game-love-letter", _type: "game" } },
    { patch: { id: "drafts.game-love-letter", set: { name: "Love Letter" } } },
    { create: { _id: "drafts.creator-seiji-kanai", _type: "creator" } },
    { createIfNotExists: { _id: "drafts.publisher-sample", _type: "publisher" } },
    { create: { _id: "drafts.category-card-game", _type: "category" } },
  ]
  const publish = [
    { createOrReplace: { _id: "game-love-letter", _type: "game" } },
    { delete: { id: "drafts.game-love-letter" } },
    { createOrReplace: { _id: "publisher-sample", _type: "publisher" } },
    { delete: { id: "drafts.publisher-sample" } },
  ]

  it("is drafts only before the owner's word", () => {
    expect(mutationsProblem(draftsOnly, false, scope)).toBeNull()
    expect(mutationsProblem([{ createIfNotExists: { _id: "drafts.expansion-love-letter", _type: "expansion" } }], false, scope)).toBeNull()
  })

  it("refuses to write, patch or delete a published document, or to delete a draft, before the word", () => {
    expect(mutationsProblem(publish, false, scope)).toContain("waits for the owner's word")
    expect(mutationsProblem([{ createOrReplace: { _id: "game-love-letter", _type: "game" } }], false, scope)).toContain("waits for the owner's word")
    // a createOrReplace of a draft is no way round it: it replaces a document wholesale and is part of publishing only
    expect(mutationsProblem([{ createOrReplace: { _id: "drafts.game-love-letter", _type: "game" } }], false, scope)).toContain("waits for the owner's word")
    expect(mutationsProblem([{ create: { _id: "game-love-letter", _type: "game" } }], false, scope)).toContain("only a draft")
    expect(mutationsProblem([{ patch: { id: "game-love-letter", set: {} } }], false, scope)).toContain("only a draft")
    expect(mutationsProblem([{ delete: { id: "game-love-letter" } }], false, scope)).toContain("only the draft of a document that is being published")
    expect(mutationsProblem([{ delete: { id: "drafts.game-love-letter" } }], false, scope)).toContain("only the draft of a document that is being published")
  })

  it("reads the id from the key the API reads: `_id` of a document, `id` of a patch or a delete", () => {
    // a create with no `_id` gets a random id that is not a draft; one with `id` instead of `_id` is not what it looks like
    expect(mutationsProblem([{ create: { _type: "game" } }], false, scope)).toContain("got none")
    expect(mutationsProblem([{ create: { id: "drafts.game-love-letter", _type: "game" } }], false, scope)).toContain("got none")
    expect(mutationsProblem([{ patch: { _id: "drafts.game-love-letter", set: {} } }], false, scope)).toContain("got none")
    expect(mutationsProblem([{ patch: { query: "*", set: {} } }], false, scope)).toContain("got none")
    expect(mutationsProblem([{ createOrReplace: { id: "game-love-letter", _type: "game" } }], true, scope)).toContain("a document with no _id")
    expect(mutationsProblem([{ delete: { _id: "drafts.game-love-letter" } }], true, scope)).toContain("only the draft of a document that is being published")
  })

  it("keeps to this game's drafts, and to people, publishers and categories for the others", () => {
    expect(draftIdOk("drafts.game-love-letter", "love-letter")).toBe(true)
    expect(draftIdOk("drafts.expansion-love-letter", "love-letter")).toBe(true)
    expect(draftIdOk("drafts.publisher-sample-publisher", "love-letter")).toBe(true)
    for (const id of ["drafts.game-hanabi", "drafts.game-love-letter-2", "game-love-letter", "drafts.settings", "drafts.game-", "drafts.creator-", "drafts.love-letter", "drafts.game-love-letter.x", "drafts.drafts.game-love-letter"]) expect(draftIdOk(id, "love-letter"), id).toBe(false)
    expect(mutationsProblem([{ create: { _id: "drafts.game-hanabi", _type: "game" } }], false, scope)).toContain("only a draft of this game")
    expect(mutationsProblem([{ patch: { id: "drafts.game-hanabi", set: {} } }], false, scope)).toContain("only a draft of this game")
  })

  it("keeps the type of a document to the one its id says", () => {
    expect(mutationsProblem([{ create: { _id: "drafts.game-love-letter", _type: "publisher" } }], false, scope)).toContain("its _type is not the one its id says")
    expect(mutationsProblem([{ create: { _id: "drafts.publisher-sample", _type: "settings" } }], false, scope)).toContain("its _type is not the one its id says")
    expect(mutationsProblem([{ create: { _id: "drafts.game-love-letter" } }], false, scope)).toContain("its _type is not the one its id says")
  })

  it("patches by id only, with the operations of a patch", () => {
    expect(mutationsProblem([{ patch: { id: "drafts.game-love-letter", set: {}, unset: ["a"], insert: {}, ifRevisionID: "x" } }], false, scope)).toBeNull()
    expect(mutationsProblem([{ patch: { id: "drafts.game-love-letter", query: "*[_type == 'game']", set: {} } }], false, scope)).toContain("only by id")
    expect(mutationsProblem([{ patch: { id: "drafts.game-love-letter", merge: {} } }], false, scope)).toContain("only by id")
  })

  it("lets the publication through only as a createOrReplace with the delete of its draft, only for the documents the gate showed, once the word is given", () => {
    expect(mutationsProblem(publish, true, scope)).toBeNull()
    expect(mutationsProblem([...draftsOnly, ...publish], true, scope)).toBeNull()
    expect(mutationsProblem([publish[0], publish[1]], true, scope)).toBeNull()
    expect(mutationsProblem([{ createOrReplace: { _id: "game-love-letter", _type: "game" } }], true, scope)).toContain("together")
    expect(mutationsProblem([{ delete: { id: "drafts.game-love-letter" } }], true, scope)).toContain("together")
    expect(mutationsProblem([{ createOrReplace: { _id: "game-love-letter", _type: "game" } }, { delete: { id: "drafts.publisher-sample" } }], true, scope)).toContain("together")
    // a document the gate did not show is not published, with the word either
    expect(mutationsProblem([{ createOrReplace: { _id: "game-hanabi", _type: "game" } }, { delete: { id: "drafts.game-hanabi" } }], true, scope)).toContain("only the documents the gate showed (game-love-letter, publisher-sample)")
    expect(mutationsProblem(publish, true, { gameSlug: "love-letter", publishIds: [] })).toContain("only the documents the gate showed (none)")
    expect(mutationsProblem([{ createOrReplace: { _id: "drafts.game-love-letter", _type: "game" } }, { delete: { id: "drafts.game-love-letter" } }], true, scope)).toContain("only the documents the gate showed")
    // the word never lets a published document be patched, created or deleted
    expect(mutationsProblem([{ patch: { id: "game-love-letter", set: {} } }], true, scope)).toContain("only a draft")
    expect(mutationsProblem([{ create: { _id: "game-love-letter", _type: "game" } }], true, scope)).toContain("only a draft")
    expect(mutationsProblem([{ delete: { id: "game-love-letter" } }], true, scope)).toContain("only the draft of a document that is being published")
    expect(mutationsProblem([{ delete: { id: "drafts.game-love-letter", query: "*" } }, { createOrReplace: { _id: "game-love-letter", _type: "game" } }], true, scope)).toContain("only by id")
  })

  it("takes nothing that is not a list of single operations", () => {
    expect(mutationsProblem(undefined, true, scope)).toContain("needs its mutations")
    expect(mutationsProblem([], true, scope)).toContain("needs its mutations")
    expect(mutationsProblem(["x"], true, scope)).toContain("an object")
    expect(mutationsProblem([{ create: { _id: "drafts.game-love-letter" }, delete: { id: "drafts.game-love-letter" } }], true, scope)).toContain("one operation")
    expect(mutationsProblem([{ purge: { id: "drafts.game-love-letter" } }], true, scope)).toContain("not allowed")
    expect(mutationsProblem([{ create: "x" }], true, scope)).toContain("is an object")
  })

  it("names the ids that the gate may show", () => {
    for (const id of ["game-love-letter", "expansion-bang-legends", "publisher-sample-publisher", "creator-seiji-kanai", "category-card-game"]) expect(isPublishedId(id), id).toBe(true)
    for (const id of ["drafts.game-love-letter", "game-", "game", "settings", "game-Love-Letter", "game-love letter", "game-love-letter,publisher-x", "image-abc"]) expect(isPublishedId(id), id).toBe(false)
  })

  it("is judged on the call of the executor, in the platform's project only", () => {
    expect(kind(catalog, executor(sanity("SANITY_QUERY_DOCUMENTS", { query: "*[_type == 'game']" })))).toBe("allow")
    expect(kind(catalog, executor(sanity("SANITY_MUTATE_DOCUMENTS", { mutations: draftsOnly, dry_run: true })))).toBe("allow")
    expect(kind(catalogPublishing, executor(sanity("SANITY_MUTATE_DOCUMENTS", { mutations: publish })))).toBe("deny")
    expect(kind(catalogPublishing, executor(sanity("SANITY_MUTATE_DOCUMENTS", { mutations: publish })), { PBGO_PUBLISH_OK: "1" })).toBe("allow")
    expect(kind(catalogPublishing, executor(sanity("SANITY_MUTATE_DOCUMENTS", { mutations: publish })), { PBGO_PUBLISH_OK: "0" })).toBe("deny")
    expect(kind(catalogPublishing, executor(sanity("SANITY_MUTATE_DOCUMENTS", { mutations: publish })), { PBGO_PUBLISH_OK: "true" })).toBe("deny")
    // the word is not enough when the gate showed nothing (a step that is not publishing), or showed other documents
    expect(kind(catalog, executor(sanity("SANITY_MUTATE_DOCUMENTS", { mutations: publish })), { PBGO_PUBLISH_OK: "1" })).toBe("deny")
    expect(kind(catalog, executor({ slug: "SANITY_QUERY_DOCUMENTS", args: { project_id: "ky3exlhe", dataset: "production" } }))).toBe("deny")
    expect(kind(catalog, executor({ slug: "SANITY_QUERY_DOCUMENTS", args: { project_id: PLATFORM_SANITY.projectId, dataset: "staging" } }))).toBe("deny")
  })

  it("judges every call of a batch, not the first alone", () => {
    expect(kind(catalog, executor(sanity("SANITY_QUERY_DOCUMENTS"), sanity("SANITY_MUTATE_DOCUMENTS", { mutations: publish })))).toBe("deny")
    expect(kind(catalog, executor(sanity("SANITY_QUERY_DOCUMENTS"), sanity("SANITY_MUTATE_DOCUMENTS", { mutations: draftsOnly })))).toBe("allow")
    expect(kind(catalog, executor(sanity("SANITY_QUERY_DOCUMENTS"), { slug: "GMAIL_SEND_EMAIL", args: {} }))).toBe("deny")
  })
})

describe("what Composio may be asked", () => {
  it("is the slugs of the step, nothing else, and nothing at all for a step with no Composio", () => {
    expect(kind(catalog, executor(sanity("SANITY_DELETE_DOCUMENT", { id: "x" })))).toBe("deny")
    expect(kind(catalog, executor({ slug: "LINEAR_CREATE_LINEAR_ISSUE", args: {} }))).toBe("deny")
    expect(kind(catalog, executor({ slug: "GMAIL_SEND_EMAIL", args: {} }))).toBe("deny")
    expect(kind(catalog, executor())).toBe("deny")
    expect(kind(catalog, { tool_name: `mcp__${SERVER}__COMPOSIO_MULTI_EXECUTE_TOOL`, tool_input: { tools: ["x"] } })).toBe("deny")
    expect(kind(scout, executor(sanity("SANITY_QUERY_DOCUMENTS")))).toBe("deny")
  })

  it("lets the lookup tools be, and refuses the others of Composio and of the other connectors", () => {
    expect(kind(catalog, { tool_name: `mcp__${SERVER}__COMPOSIO_SEARCH_TOOLS`, tool_input: {} })).toBe("none")
    expect(kind(catalog, { tool_name: `mcp__${SERVER}__COMPOSIO_GET_TOOL_SCHEMAS`, tool_input: {} })).toBe("none")
    expect(kind(scout, { tool_name: `mcp__${SERVER}__COMPOSIO_SEARCH_TOOLS`, tool_input: {} })).toBe("deny")
    for (const tool_name of [`mcp__${SERVER}__COMPOSIO_REMOTE_BASH_TOOL`, `mcp__${SERVER}__COMPOSIO_REMOTE_WORKBENCH`, `mcp__${SERVER}__COMPOSIO_PROXY_EXECUTE`, "mcp__claude_ai_Slack__send_message", "mcp__Sanity__publish_documents"]) {
      expect(kind(catalog, { tool_name, tool_input: {} }), tool_name).toBe("deny")
    }
  })

  it("is the one server that the command found, not any server that has a tool of the same name", () => {
    // another connector (or a project's own MCP server) that names a tool like Composio's must not be taken for it
    for (const server of ["claude_ai_Slack", "composio", "evil_Composio", "claude_ai_Composio_2", "Sanity"]) {
      expect(kind(catalogPublishing, { tool_name: `mcp__${server}__COMPOSIO_MULTI_EXECUTE_TOOL`, tool_input: executor(sanity("SANITY_QUERY_DOCUMENTS")).tool_input }, { PBGO_PUBLISH_OK: "1" }), server).toBe("deny")
      expect(kind(catalog, { tool_name: `mcp__${server}__COMPOSIO_SEARCH_TOOLS`, tool_input: {} }), server).toBe("deny")
    }
    expect(kind(catalog, { tool_name: "mcp__claude_ai_Composio_extra__x", tool_input: {} })).toBe("deny")
    expect(kind(catalog, { tool_name: "mcp__", tool_input: {} })).toBe("deny")
  })

  it("leaves the tools it does not rule on to the mode", () => {
    for (const tool_name of ["WebSearch", "WebFetch", "ToolSearch", "Skill", "Task"]) expect(kind(scout, { tool_name, tool_input: {} }), tool_name).toBe("none")
  })
})

describe("what Linear may be asked", () => {
  const graph = (query: string) => executor({ slug: "LINEAR_RUN_QUERY_OR_MUTATION", args: { query_or_mutation: query } })

  it("is the issues of the game, its comments and the queries, and the one mutation that makes a label", () => {
    expect(kind(linear, executor({ slug: "LINEAR_CREATE_LINEAR_ISSUE", args: { team_id: LINEAR.teamId, project_id: LINEAR.projectId, title: "x" } }))).toBe("allow")
    expect(kind(linear, executor({ slug: "LINEAR_UPDATE_ISSUE", args: { issueId: "issue-1", stateId: "s", title: "t" } }, { slug: "LINEAR_CREATE_LINEAR_COMMENT", args: { issueId: "GAM-41", body: "b" } }))).toBe("allow")
    expect(kind(linear, executor({ slug: "LINEAR_SEARCH_ISSUES", args: { query: "x" } }, { slug: "LINEAR_GET_LINEAR_ISSUE", args: { issue_id: "x" } }))).toBe("allow")
    expect(kind(linear, graph('query { team(id: "t") { labels(first: 250) { nodes { id name parent { id } } } } }'))).toBe("allow")
    expect(kind(linear, graph('mutation { issueLabelCreate(input: { name: "Love Letter", teamId: "t", parentId: "g" }) { success issueLabel { id name } } }'))).toBe("allow")
  })

  it("makes an issue in the Games team and its project only", () => {
    expect(kind(linear, executor({ slug: "LINEAR_CREATE_LINEAR_ISSUE", args: { team_id: "another-team", project_id: LINEAR.projectId } }))).toBe("deny")
    expect(kind(linear, executor({ slug: "LINEAR_CREATE_LINEAR_ISSUE", args: { team_id: LINEAR.teamId, project_id: "another-project" } }))).toBe("deny")
    expect(kind(linear, executor({ slug: "LINEAR_CREATE_LINEAR_ISSUE", args: { title: "x" } }))).toBe("deny")
  })

  it("moves and comments the issues the game already has, and no other, and moves them by state and title only", () => {
    expect(kind(linear, executor({ slug: "LINEAR_UPDATE_ISSUE", args: { issueId: "issue-9", stateId: "s" } }))).toBe("deny")
    expect(kind(linear, executor({ slug: "LINEAR_UPDATE_ISSUE", args: { stateId: "s" } }))).toBe("deny")
    expect(kind(linear, executor({ slug: "LINEAR_CREATE_LINEAR_COMMENT", args: { issueId: "issue-9", body: "b" } }))).toBe("deny")
    expect(kind(linear, executor({ slug: "LINEAR_UPDATE_ISSUE", args: { issueId: "issue-1", assigneeId: "someone", archived: true } }))).toBe("deny")
    expect(kind(linear, executor({ slug: "LINEAR_UPDATE_ISSUE", args: { issueId: "issue-1", teamId: "another-team" } }))).toBe("deny")
  })

  it("learns the issues of the game from its state: the ids and the identifiers", () => {
    const state = newState({ name: "Love Letter", slug: "love-letter", sessionId: "s", now: new Date("2026-11-16T10:00:00Z") })
    expect(issueIdsOf(state)).toEqual([])
    state.linear.parent = { id: "p-id", identifier: "GAM-40", url: "u", title: "t", applied: "Todo", commented: false }
    state.steps.scout = { status: "pending", gate: 0, rounds: 0, costUsd: 0, startedAt: null, validatedAt: null, report: null, links: [], check: null, failure: null, issue: { id: "s-id", identifier: "GAM-41", url: "u", title: "t", applied: "Todo", commented: false } }
    expect(issueIdsOf(state)).toEqual(["p-id", "GAM-40", "s-id", "GAM-41"])
  })

  it("refuses every other mutation, and every other tool of Linear", () => {
    expect(linearGraphqlProblem('mutation { issueDelete(id: "x") { success } }')).not.toBeNull()
    expect(linearGraphqlProblem('mutation { issueLabelCreate(input: {name: "a"}) { success } issueDelete(id: "x") { success } }')).not.toBeNull()
    expect(linearGraphqlProblem('mutation { a: issueLabelCreate(input: {name: "a"}) { success } b: projectDelete(id: "x") { success } }')).not.toBeNull()
    expect(linearGraphqlProblem("query { viewer { id } }")).toBeNull()
    expect(kind(linear, graph('mutation { issueDelete(id: "x") { success } }'))).toBe("deny")
    expect(kind(linear, executor({ slug: "LINEAR_DELETE_LINEAR_ISSUE", args: {} }))).toBe("deny")
    expect(kind(linear, executor(sanity("SANITY_MUTATE_DOCUMENTS", { mutations: [{ create: { _id: "drafts.game-love-letter", _type: "game" } }] })))).toBe("deny")
  })

  it("refuses the GraphQL that hides a mutation from a reader: a comment, a block string", () => {
    expect(linearGraphqlProblem('query { viewer { id } } # mutation { issueDelete(id: "x") { success } }')).toContain("no comment")
    expect(linearGraphqlProblem('mutation { issueLabelCreate(input: {name: "a"}) { success } }\n# issueDelete(id: "x")')).toContain("no comment")
    expect(linearGraphqlProblem('query { a(x: """ block """) { id } }')).toContain("no comment")
    expect(kind(linear, graph("query { viewer { id } } # mutation { issueDelete(id: \"x\") { success } }"))).toBe("deny")
    // a mutation hidden after a string that holds a quote and a keyword
    expect(linearGraphqlProblem('mutation { issueLabelCreate(input: {name: "a\\" issueDelete(id: \\"x\\")"}) { success } }')).toBeNull()
    expect(linearGraphqlProblem('mutation { issueLabelCreate(input: {name: "a"}) { success } }\nmutation { issueDelete(id: "x") { success } }')).not.toBeNull()
  })
})

describe("the settings that register the hook", () => {
  it("name the node that runs the command and the guard, for every tool", () => {
    const settings = hookSettings({ nodePath: "/usr/bin/node", guardFile: "/repo/packages/pipeline/hook/guard.ts" }) as { hooks: { PreToolUse: { matcher: string; hooks: { type: string; command: string }[] }[] } }
    expect(settings.hooks.PreToolUse).toHaveLength(1)
    expect(settings.hooks.PreToolUse[0]?.matcher).toBe(".*")
    expect(settings.hooks.PreToolUse[0]?.hooks[0]).toEqual({ type: "command", command: '"/usr/bin/node" --disable-warning=ExperimentalWarning "/repo/packages/pipeline/hook/guard.ts"' })
  })

  it("name the project the catalog entry writes in as the platform's (the catalog package reads the same one)", () => {
    const source = readFileSync(join(REPO_ROOT, "packages", "catalog", "src", "sanity.ts"), "utf8")
    expect(source).toContain(PLATFORM_SANITY.projectId)
  })
})

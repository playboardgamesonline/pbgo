// What a headless step may do. The mode of the call is `dontAsk` (everything that is not allowed is refused), and the one thing that allows anything beyond
// the read-only tools is a PreToolUse hook (hook/guard.ts) that runs `decide` on each tool call: it says "allow" for what the step may do, "deny" (with the
// reason, which the agent reads) for what it must not, and nothing for the rest (which the mode refuses, but for the reads inside the repo). The hook itself fails
// closed: when it cannot read its policy it denies every call. Verified on the CLI 2.1.299: a path rule given to `--allowedTools` never matched, a hook's "allow" does.
//
// The agent is the one thing the policy does not trust: it reads web pages. So a step writes exactly the files it is meant to (never its own policy, its state or its
// log), runs exactly the commands of its skill (a command that no rule allows is denied, not left to the mode), and reaches Composio's executor only for the slugs and
// the documents it is meant to.
import { homedir } from "node:os"
import { join, resolve, sep } from "node:path"
import type { Env } from "./config.ts"
import { splitMcpName } from "./stream.ts"

/** The platform's own Sanity project and dataset: the one place the catalog entry is written. */
export const PLATFORM_SANITY = { projectId: "mhgqs6fe", dataset: "production" } as const

export type BashRule = { regex: string } | { builtin: "node-one-liner" }

/** What the catalog entry may do in Sanity: the platform's project, this game's drafts, and (after the owner's word) the documents the gate showed. */
export type SanityScope = { projectId: string; dataset: string; gameSlug: string; publishIds: string[] }

/** What the bookkeeping may do in Linear: its team and project, and the issues it already made. */
export type LinearScope = { teamId: string; projectId: string; issueIds: string[] }

export type ComposioPolicy = {
  /** the MCP server whose tools may run, as it is named in a tool name (`claude_ai_Composio`): a tool of a server of another name is refused */
  server: string
  /** the slugs `COMPOSIO_MULTI_EXECUTE_TOOL` may call */
  slugs: string[]
  sanity: SanityScope | null
  linear: LinearScope | null
}

export type Policy = {
  repoRoot: string
  /** the folder of the game: `mkdir -p` makes it, nothing else of it is written but the files below */
  workDir: string
  /** the only files a step writes, and the only ones it reads outside the repo: never its own policy, its state or its log */
  writeFiles: string[]
  readFiles: string[]
  bash: BashRule[]
  composio: ComposioPolicy | null
}

export type Call = { tool_name: string; tool_input: unknown }
export type Decision = { decision: "allow"; reason: string } | { decision: "deny"; reason: string } | { decision: "none" }

/** What the hook can ask of the machine: whether git ignores a file (a file of the repo that is not the project's), and the home folder. */
export type Helpers = { ignored?: (path: string) => boolean; home?: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const deny = (reason: string): Decision => ({ decision: "deny", reason })
const allow = (reason: string): Decision => ({ decision: "allow", reason })
const none: Decision = { decision: "none" }

export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")

// ---------- secrets ----------

/** The files and folders that hold secrets: a call that names one is refused, whatever the tool. */
const SECRET =
  /(?:^|[\s"'=:/])(?:\.env(?:\.[\w.-]+)?|secrets\.env)(?=$|[\s"'/:;,)])|\.vercel(?:[/\s]|$)|\.sanity-project-id|\.config\/(?:pbgo|sanity|gh|gcloud)|\/\.ssh(?:[/\s]|$)|\/\.aws(?:[/\s]|$)|\.npmrc|\.netrc|id_rsa|id_ed25519|\.pem(?:["\s]|$)|\bcredentials\.json/i

/**
 * Whether a text names a file of secrets. The owner's own configuration of Claude Code (`~/.claude`, `~/.claude.json`) is one, the project's `.claude/skills` of the
 * repo is not: it is looked for under the home folder, not anywhere.
 */
export function mentionsSecret(text: string, home: string = homedir()): boolean {
  if (SECRET.test(text)) return true
  const where = ["~", "\\$HOME", "\\$\\{HOME\\}", ...(home ? [escapeRegex(home)] : [])].join("|")
  return new RegExp(`(?:${where})/\\.claude(?:\\.json|/|\\s|$)`).test(text)
}

// ---------- paths ----------

function expandHome(path: string, home: string): string {
  if (path === "~") return home
  return path.startsWith("~/") ? join(home, path.slice(2)) : path
}

function inside(dir: string, path: string): boolean {
  const base = resolve(dir)
  const target = resolve(path)
  return target === base || target.startsWith(base.endsWith(sep) ? base : base + sep)
}

const sameFile = (a: string, b: string): boolean => resolve(a) === resolve(b)

function decideWrite(policy: Policy, input: Record<string, unknown>, home: string): Decision {
  const given = typeof input.file_path === "string" ? input.file_path : typeof input.notebook_path === "string" ? input.notebook_path : ""
  if (!given) return deny("a write needs a path")
  const path = expandHome(given, home)
  if (mentionsSecret(path, home)) return deny("a step never touches a file of secrets")
  if (policy.writeFiles.some((file) => sameFile(file, path))) return allow("write of the file of the step")
  return deny(`a step writes ${policy.writeFiles.length > 0 ? `only ${policy.writeFiles.join(", ")}` : "no file"}`)
}

function decideRead(policy: Policy, input: Record<string, unknown>, home: string, ignored: (path: string) => boolean): Decision {
  const given = typeof input.file_path === "string" ? input.file_path : ""
  if (!given) return deny("a read needs a path")
  const path = expandHome(given, home)
  if (mentionsSecret(path, home)) return deny("a step never reads a file of secrets")
  if (policy.readFiles.some((file) => sameFile(file, path))) return allow("read of the file of the step")
  if (inside(policy.repoRoot, path)) {
    // a file of the repo that git ignores (an .env, a token, a build) is not the project's: refused, whatever its name
    if (ignored(resolve(path))) return deny("a step reads the files of the project, not the ones that git ignores")
    // the mode itself allows a read inside the repo
    return none
  }
  return deny(`a step reads the repo${policy.readFiles.length > 0 ? ` and ${policy.readFiles.join(", ")}` : ""} only`)
}

// ---------- shell commands ----------

const WORD = String.raw`[A-Za-z0-9._/~@%+=,:-]+`
/** A quoted word with no `$`, backtick or backslash in it: nothing a shell would expand. */
const QUOTED = String.raw`(?:"[^"$\x60\\]*"|'[^']*')`
export const ARG = `(?:${WORD}|${QUOTED})`

/** The commands the two skills run, by their exact shape. `node -e` is checked by `isNodeOneLiner`, not by a pattern. */
export const BASH = {
  checkScout: { regex: `^pnpm check:scout(?: ${ARG})+$` },
  catalogList: { regex: "^pnpm catalog:list$" },
  checkGame: { regex: "^pnpm check:game [a-z0-9-]+(?: --stage [a-z]+)?$" },
  bggLookup: { regex: `^pnpm --filter @pbgo/platform content:bgg-lookup(?: ${ARG})+$` },
  date: { regex: String.raw`^date(?: \+%F)?$` },
  nodeOneLiner: { builtin: "node-one-liner" },
} as const satisfies Record<string, BashRule>

/** `mkdir -p <the folder of the game>`, with or without quotes around the path, and nothing else. */
export function mkdirRule(dir: string): BashRule {
  return { regex: `^mkdir -p ["']?${escapeRegex(dir)}["']?$` }
}

const ONE_LINER = /^node(?: --disable-warning=ExperimentalWarning)? -e '([^']*)'((?: (?:"[^"$`\\]*"|'[^']*'|[A-Za-z0-9._/~@%+=,:-]+))*)$/

/** The values of the words that follow a command (each a plain word or a quoted one), the quotes taken off. */
function wordsOf(rest: string): string[] {
  return [...rest.matchAll(/ (?:"([^"$`\\]*)"|'([^']*)'|([A-Za-z0-9._/~@%+=,:-]+))/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? "")
}

/**
 * The code of the `node -e` one-liners of the skills, word for word: fixed code, only its arguments (`process.argv`) vary. Any other code is refused: a filter on
 * what code must not contain is always got around (a string put together, a built-in module asked for by name), a list of the code that is allowed is not.
 * `policy.test.ts` checks that each of them is still in its skill.
 */
export const ONE_LINER_BODIES: readonly string[] = [
  'import("./packages/games/src/slug.ts").then(({ slugFromName, slugProblem }) => { const slug = slugFromName(process.argv[1]); console.log(slug, slugProblem(slug) ?? "ok") })',
  'import("./packages/games/src/slug.ts").then(({ slugFromName, slugProblem }) => { const slug = process.argv[1] + "-" + slugFromName(process.argv[2]); console.log(slug, slugProblem(slug, [], "expansion") ?? "ok") })',
  'import("./packages/games/src/slug.ts").then(({ slugProblem, nameProblem }) => { const [slug, name, kind] = process.argv.slice(1); console.log(slugProblem(slug, [], kind) ?? "slug ok", "|", nameProblem(name) ?? "name ok") })',
  "console.log(process.argv[1].length)",
]

/**
 * A `node -e` command whose code is one of the skills' one-liners. Its arguments are plain words and none starts with `-`: Node reads the options that follow the
 * code (`--eval`, `--import=…`) and runs them.
 */
export function isNodeOneLiner(command: string): boolean {
  const match = ONE_LINER.exec(command)
  if (match === null || !ONE_LINER_BODIES.includes(match[1] ?? "")) return false
  return wordsOf(match[2] ?? "").every((word) => !word.startsWith("-"))
}

/** `pnpm check:scout <file>` reads the file it is given: it is the step's own folder, and no other file. */
function checkScoutPathProblem(policy: Policy, command: string, home: string): string | null {
  if (!/^pnpm check:scout\b/.test(command)) return null
  for (const word of wordsOf(command.slice("pnpm check:scout".length))) {
    if (word === "--online" || word === "--list") continue
    if (word.startsWith("-")) return `pnpm check:scout takes a file, --online or --list, not ${word}`
    if (!inside(policy.workDir, expandHome(word, home))) return `pnpm check:scout reads only the files of ${policy.workDir}`
  }
  return null
}

function decideBash(policy: Policy, input: Record<string, unknown>, home: string): Decision {
  const command = typeof input.command === "string" ? input.command.trim() : ""
  if (!command) return deny("an empty command")
  if (mentionsSecret(command, home)) return deny("a step never touches a file of secrets")
  for (const rule of policy.bash) {
    if (!("regex" in rule ? new RegExp(rule.regex).test(command) : isNodeOneLiner(command))) continue
    const problem = checkScoutPathProblem(policy, command, home)
    return problem ? deny(problem) : allow("a command of the skill")
  }
  // not one of the commands of the skill: refused here, whatever it is (the mode would let a read-only command such as cat or grep run, and with it a file of
  // the repo that no rule names)
  return deny("a step runs only the commands its skill gives")
}

// ---------- Sanity ----------

const DOCUMENT_TYPES: readonly string[] = ["game", "expansion", "creator", "publisher", "category"]
const PATCH_KEYS = new Set(["id", "set", "setIfMissing", "unset", "insert", "inc", "dec", "diffMatchPatch", "ifRevisionID"])
const PUBLISHED_ID = /^(?:game|expansion|creator|publisher|category)-[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The ids of the documents a step may make as drafts: this game's, and the people, publishers and categories it needs. */
export function draftIdOk(id: string, gameSlug: string): boolean {
  return new RegExp(`^drafts\\.(?:(?:game|expansion)-${escapeRegex(gameSlug)}|(?:creator|publisher|category)-[a-z0-9]+(?:-[a-z0-9]+)*)$`).test(id)
}

/** An id that the gate may show for publishing: `game-x`, `publisher-y`. */
export const isPublishedId = (id: string): boolean => PUBLISHED_ID.test(id)

const typeMatches = (id: string, type: unknown): boolean => typeof type === "string" && DOCUMENT_TYPES.includes(type) && id.replace(/^drafts\./, "").startsWith(`${type}-`)

/**
 * The mutations of a Sanity call. Before the owner's word only drafts are written: a `create` or `createIfNotExists` of a draft that has its own `_id` (a `create` without
 * one gets a random id that is not a draft), of a type the catalog has, and a `patch` of a draft. Publishing is a `createOrReplace` of the published document with the
 * `delete` of its draft in the same transaction, only for the documents the gate showed, and only with the word (PBGO_PUBLISH_OK=1). The id is read from the key the API reads:
 * `_id` of a document, `id` of a patch or a delete.
 */
export function mutationsProblem(mutations: unknown, publish: boolean, scope: Pick<SanityScope, "gameSlug" | "publishIds">): string | null {
  if (!Array.isArray(mutations) || mutations.length === 0) return "a Sanity call needs its mutations"
  const published: string[] = []
  const draftDeletes: string[] = []
  for (const mutation of mutations) {
    if (!isRecord(mutation)) return "a mutation is an object"
    const operations = Object.keys(mutation)
    const operation = operations[0]
    if (operations.length !== 1 || operation === undefined) return "a mutation has one operation"
    const body = mutation[operation]
    if (!isRecord(body)) return `the ${operation} of a mutation is an object`
    switch (operation) {
      case "create":
      case "createIfNotExists": {
        const id = body._id
        if (typeof id !== "string" || !draftIdOk(id, scope.gameSlug)) return `${operation}: only a draft of this game, or of a person, a publisher or a category, with its own _id (got ${typeof id === "string" ? id : "none"})`
        if (!typeMatches(id, body._type)) return `${operation} of ${id}: its _type is not the one its id says`
        break
      }
      case "createOrReplace": {
        const id = body._id
        if (!publish) return "createOrReplace (publishing) waits for the owner's word (publish)"
        if (typeof id !== "string" || id.startsWith("drafts.") || !scope.publishIds.includes(id)) return `createOrReplace of ${typeof id === "string" ? id : "a document with no _id"}: only the documents the gate showed (${scope.publishIds.join(", ") || "none"})`
        if (!typeMatches(id, body._type)) return `createOrReplace of ${id}: its _type is not the one its id says`
        published.push(id)
        break
      }
      case "patch": {
        const id = body.id
        if (typeof id !== "string" || !draftIdOk(id, scope.gameSlug)) return `patch: only a draft of this game, or of a person, a publisher or a category (got ${typeof id === "string" ? id : "none"})`
        if (Object.keys(body).some((key) => !PATCH_KEYS.has(key))) return "patch: only by id, with set, setIfMissing, unset, insert, inc, dec or ifRevisionID"
        break
      }
      case "delete": {
        const id = body.id
        if (!publish || typeof id !== "string" || !id.startsWith("drafts.") || !scope.publishIds.includes(id.slice("drafts.".length))) return "delete: only the draft of a document that is being published, with the owner's word"
        if (Object.keys(body).some((key) => key !== "id" && key !== "ifRevisionID")) return "delete: only by id"
        draftDeletes.push(id.slice("drafts.".length))
        break
      }
      default:
        return `the operation ${operation} is not allowed`
    }
  }
  const unmatched = [...published.filter((id) => !draftDeletes.includes(id)), ...draftDeletes.filter((id) => !published.includes(id))]
  if (unmatched.length > 0) return `publishing ${unmatched.join(", ")} is a createOrReplace of the document and the delete of its draft, together`
  return null
}

// ---------- Linear ----------

/** The GraphQL a Linear call may send: any query, and the one mutation that makes a label. Comments and block strings are refused: they can hide a mutation from a reader. */
export function linearGraphqlProblem(query: string): string | null {
  if (query.includes("#") || query.includes('"""')) return "no comment and no block string in GraphQL"
  const stripped = query.replace(/"(?:[^"\\]|\\.)*"/g, '""')
  if (!/\bmutation\b/.test(stripped)) return null
  const only = /^\s*mutation\b[^{]*\{\s*(?:\w+\s*:\s*)?issueLabelCreate\s*\(/.test(stripped)
  const operations = stripped.match(/\b\w+(?:Create|Update|Delete|Archive|Unarchive|Upsert|Link|Unlink|Move|Merge|Assign|Subscribe)\s*\(/g) ?? []
  return only && operations.length === 1 ? null : "only queries and issueLabelCreate are allowed in GraphQL"
}

function linearProblem(slug: string, args: Record<string, unknown>, scope: LinearScope): string | null {
  switch (slug) {
    case "LINEAR_CREATE_LINEAR_ISSUE":
      return args.team_id === scope.teamId && args.project_id === scope.projectId ? null : "Linear: an issue is made in the Games team, in its project"
    case "LINEAR_UPDATE_ISSUE":
      if (Object.keys(args).some((key) => key !== "issueId" && key !== "stateId" && key !== "title")) return "Linear: an issue is moved by its state and its title only"
      return typeof args.issueId === "string" && scope.issueIds.includes(args.issueId) ? null : "Linear: only the issues of the game are updated"
    case "LINEAR_CREATE_LINEAR_COMMENT":
      return typeof args.issueId === "string" && scope.issueIds.includes(args.issueId) ? null : "Linear: only the issues of the game are commented"
    case "LINEAR_RUN_QUERY_OR_MUTATION": {
      const problem = linearGraphqlProblem(typeof args.query_or_mutation === "string" ? args.query_or_mutation : "")
      return problem ? `Linear: ${problem}` : null
    }
    default:
      return null
  }
}

// ---------- Composio ----------

function decideComposio(policy: Policy, input: Record<string, unknown>, env: Env): Decision {
  const composio = policy.composio
  if (!composio) return deny("this step has no access to Composio")
  const calls = Array.isArray(input.tools) ? input.tools : []
  if (calls.length === 0) return deny("Composio: no tool to run")
  for (const call of calls) {
    if (!isRecord(call)) return deny("Composio: a tool call is an object")
    const slug = typeof call.tool_slug === "string" ? call.tool_slug : ""
    const args = isRecord(call.arguments) ? call.arguments : {}
    if (!composio.slugs.includes(slug)) return deny(`Composio tool ${slug || "(none)"} is not available to this step (allowed: ${composio.slugs.join(", ") || "none"})`)
    if (slug.startsWith("SANITY_")) {
      const scope = composio.sanity
      if (!scope || args.project_id !== scope.projectId || args.dataset !== scope.dataset) return deny(`Sanity: only the project ${scope?.projectId ?? "(none)"}, dataset ${scope?.dataset ?? "(none)"}`)
      if (slug === "SANITY_MUTATE_DOCUMENTS") {
        const problem = mutationsProblem(args.mutations, env.PBGO_PUBLISH_OK === "1", scope)
        if (problem) return deny(`Sanity: ${problem}`)
      }
    }
    if (slug.startsWith("LINEAR_")) {
      if (!composio.linear) return deny("Linear: this step has no access to it")
      const problem = linearProblem(slug, args, composio.linear)
      if (problem) return deny(problem)
    }
  }
  return allow("a Composio call of the step")
}

function decideMcp(policy: Policy, name: string, input: Record<string, unknown>, env: Env): Decision {
  const mcp = splitMcpName(name)
  if (!mcp || !policy.composio || mcp.server !== policy.composio.server) return deny(`${mcp ? `${mcp.server}: ${mcp.tool}` : name} is not available to a step`)
  if (mcp.tool === "COMPOSIO_SEARCH_TOOLS" || mcp.tool === "COMPOSIO_GET_TOOL_SCHEMAS") return none
  if (mcp.tool === "COMPOSIO_MULTI_EXECUTE_TOOL") return decideComposio(policy, input, env)
  return deny(`${mcp.server}: ${mcp.tool} is not available to a step`)
}

/** The decision for one tool call: the whole policy. */
export function decide(policy: Policy, call: Call, env: Env, helpers: Helpers = {}): Decision {
  const input = isRecord(call.tool_input) ? call.tool_input : {}
  const home = helpers.home ?? homedir()
  switch (call.tool_name) {
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return decideWrite(policy, input, home)
    case "Read":
      return decideRead(policy, input, home, helpers.ignored ?? (() => false))
    case "Bash":
      return decideBash(policy, input, home)
    case "Grep":
    case "Glob":
      return deny(`${call.tool_name} is not available to a step: it reads files that the policy cannot judge one by one`)
  }
  if (call.tool_name.startsWith("mcp__")) return decideMcp(policy, call.tool_name, input, env)
  return none
}

/** The settings file that registers the hook: the same `node` that runs this command runs the hook. */
export function hookSettings(args: { nodePath: string; guardFile: string }): object {
  const command = `"${args.nodePath}" --disable-warning=ExperimentalWarning "${args.guardFile}"`
  return { hooks: { PreToolUse: [{ matcher: ".*", hooks: [{ type: "command", command }] }] } }
}

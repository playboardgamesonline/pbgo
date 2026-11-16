// The Linear bookkeeping of a game: one parent issue and one sub-issue per step, moved along as the steps are validated. The command holds no key: a small
// headless call (a small model, a small budget) does the work through Composio, from a work order that names every tool and every value. The call is not trusted
// with decisions: what it may reach is the policy's (policy.ts), and a failure here never stops the pipeline (it is told, and tried again at the next point).
import { tilde } from "./render.ts"
import type { Policy } from "./policy.ts"
import type { LinearIssueRef, PipelineState } from "./state.ts"
import { stepOf } from "./state.ts"
import type { Game, StepDefinition } from "./steps.ts"

/** Ids of the Games team of the owner's Linear: stable, and not secrets. */
export const LINEAR = {
  teamId: "a31ea829-3a83-4764-bfce-abd4fa5e635e",
  teamKey: "GAM",
  projectId: "180cbe14-9465-4e18-9be9-30272b94e67d",
  assigneeId: "787b63cd-c8c9-4760-ab03-c47e8a280c8e",
  /** the group of labels that holds one label per game */
  gameLabelGroupId: "61e78bc4-bc05-4ae4-bf98-c4fa02021c4e",
  states: { Todo: "8ba75905-ddd2-40d0-aa35-343f6d67e61f", "In Progress": "5e9a3a83-b7ad-4437-8635-3844e92fd5ad", Done: "94ccc242-ef64-429a-baeb-4094c3026967" },
  labels: { "Game lane": "7b068fb9-89d8-45da-8e72-b21758c833cd", "Platform lane": "4ec531f1-0298-446f-bc2d-05d351832755", Feature: "3e946f69-313c-4ff2-ac53-de8b888e4ce0" },
} as const

export type LinearTarget = keyof typeof LINEAR.states

/** The Composio tools a Linear call may run. */
export const LINEAR_SLUGS = ["LINEAR_CREATE_LINEAR_ISSUE", "LINEAR_UPDATE_ISSUE", "LINEAR_GET_LINEAR_ISSUE", "LINEAR_SEARCH_ISSUES", "LINEAR_CREATE_LINEAR_COMMENT", "LINEAR_RUN_QUERY_OR_MUTATION"]

/** The ids and the identifiers of the issues the game has in Linear: the only ones a bookkeeping call may update or comment. */
export function issueIdsOf(state: PipelineState): string[] {
  const refs = [state.linear.parent, ...Object.values(state.steps).map((step) => step.issue)]
  return refs.flatMap((ref) => (ref ? [ref.id, ref.identifier] : []))
}

export function linearPolicy(game: Game, repoRoot: string, extras: { composioServer: string; issueIds: string[] }): Policy {
  return {
    repoRoot,
    workDir: game.dir,
    writeFiles: [],
    readFiles: [],
    bash: [],
    composio: { server: extras.composioServer, slugs: [...LINEAR_SLUGS], sanity: null, linear: { teamId: LINEAR.teamId, projectId: LINEAR.projectId, issueIds: extras.issueIds } },
  }
}

export type OrderIssue = {
  /** `parent`, or the id of a step */
  key: string
  /** the title Linear has, null when the issue is yet to be made */
  title: string | null
  description: string
  /** the lane label, none for the parent */
  lane: string | null
  /** what Linear already has: null when the issue is yet to be made */
  id: string | null
  identifier: string | null
  state: string | null
  wantTitle: string
  wantState: LinearTarget
  /** the comment to post (once), null when there is none */
  comment: string | null
}

export type WorkOrder = {
  game: { name: string; slug: string }
  label: { name: string; id: string | null }
  /** the parent first, then one issue per step */
  issues: OrderIssue[]
}

const parentTitle = (name: string) => `${name}: add the game`
const stepTitle = (name: string, step: StepDefinition) => `${name}: ${step.title}`

function ref(issue: LinearIssueRef | null): Pick<OrderIssue, "id" | "identifier" | "state" | "title"> {
  return { id: issue?.id ?? null, identifier: issue?.identifier ?? null, state: issue?.applied ?? null, title: issue?.title ?? null }
}

/**
 * What Linear should say now. The first step that is not validated is In Progress, the ones after it Todo, the validated ones Done (with one comment of
 * links); the parent stays In Progress: the steps of the later versions will add their issues under it. `null` when Linear already says exactly that.
 */
export function buildOrder(state: PipelineState, steps: readonly StepDefinition[], game: Game, assetsLabel: (path: string) => string = tilde): WorkOrder | null {
  const issues: OrderIssue[] = []
  const parent = state.linear.parent
  issues.push({
    key: "parent",
    description: `Adds ${state.name} to the platform, one step at a time: ${steps.map((step) => `${step.title} (/${step.skill})`).join(", ")}. Made and moved along by \`pnpm add-game "${state.name}"\`; each step is validated at its gate.`,
    lane: null,
    ...ref(parent),
    wantTitle: parentTitle(state.name),
    wantState: "In Progress",
    comment: null,
  })
  let current = true
  for (const step of steps) {
    const s = stepOf(state, step.id)
    let want: LinearTarget = "Todo"
    if (s.status === "validated") want = "Done"
    else if (current) want = "In Progress"
    if (s.status !== "validated") current = false
    const done = want === "Done"
    issues.push({
      key: step.id,
      description: `Step of \`pnpm add-game "${state.name}"\`: the skill \`/${step.skill}\`. Done when the step is validated at its gate${step.gates.includes("publish") ? "; publishing is a second word, publish" : ""}.`,
      lane: step.lane,
      ...ref(s.issue),
      wantTitle: stepTitle(state.name, step),
      wantState: want,
      comment: done && !s.issue?.commented ? validationComment(state, step, game, assetsLabel) : null,
    })
  }
  const needed = issues.some((issue) => issue.id === null || issue.state !== issue.wantState || (issue.id !== null && issue.title !== issue.wantTitle) || issue.comment !== null)
  return needed ? { game: { name: state.name, slug: state.slug }, label: { name: state.name, id: state.linear.labelId }, issues } : null
}

/** What the comment of a validated step says: when, and where to look. */
export function validationComment(state: PipelineState, step: StepDefinition, game: Game, label: (path: string) => string): string {
  const s = stepOf(state, step.id)
  const lines = [`Validated${s.validatedAt ? ` on ${s.validatedAt.slice(0, 10)}` : ""} at the gate of \`pnpm add-game "${state.name}"\` (${s.rounds} round${s.rounds === 1 ? "" : "s"}).`]
  if (step.id === "scout") lines.push(`Scout file: ${label(game.scoutFile)}`)
  if (s.links.length > 0) lines.push(...s.links.map((link) => `- ${link}`))
  return lines.join("\n")
}

export const LINEAR_SCHEMA = {
  type: "object",
  required: ["issues"],
  additionalProperties: false,
  properties: {
    labelId: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        required: ["key", "id", "identifier", "url", "state"],
        additionalProperties: false,
        properties: { key: { type: "string" }, id: { type: "string" }, identifier: { type: "string" }, url: { type: "string" }, state: { type: "string" }, commented: { type: "boolean" } },
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
} as const

/** The prompt of the bookkeeping call: the protocol, the fixed values, the work order, the rules. Nothing is left to guess. */
export function linearPrompt(order: WorkOrder, composioPrefix: string): string {
  const states = Object.entries(LINEAR.states).map(([name, id]) => `${name} ${id}`).join(", ")
  const labels = Object.entries(LINEAR.labels).map(([name, id]) => `${name} ${id}`).join(", ")
  return `You are the bookkeeping step of a command-line tool. Do exactly the work order below in Linear, through Composio, then answer with the JSON the output schema asks for. Do nothing else: no other tool, no question, no explanation.

How to reach Linear:
1. Load the tools: ToolSearch with the query select:${composioPrefix}COMPOSIO_SEARCH_TOOLS,${composioPrefix}COMPOSIO_MULTI_EXECUTE_TOOL,${composioPrefix}COMPOSIO_GET_TOOL_SCHEMAS
2. Call COMPOSIO_SEARCH_TOOLS once, with queries [{"use_case": "create, update and comment on Linear issues"}] and session {"generate_id": true}. Keep the session_id of its answer.
3. Call COMPOSIO_MULTI_EXECUTE_TOOL with that session_id and sync_response_to_workbench false, one tool per call, in the order of the work order. When a call fails on its arguments, read the schema of that tool with COMPOSIO_GET_TOOL_SCHEMAS and try once more.

Fixed values (Linear team ${LINEAR.teamKey}, project Game factory):
- team_id ${LINEAR.teamId}; project_id ${LINEAR.projectId}; assignee_id ${LINEAR.assigneeId}
- label group "Game" id ${LINEAR.gameLabelGroupId} (one label per game lives under it)
- state ids: ${states}
- label ids: ${labels}

Work order:
${JSON.stringify(order, null, 2)}

Rules:
- The game label: when label.id is null, look for the label named label.name under the group "Game" (LINEAR_RUN_QUERY_OR_MUTATION with the query { team(id: "${LINEAR.teamId}") { labels(first: 250) { nodes { id name parent { id } } } } }), and when there is none, make it with LINEAR_RUN_QUERY_OR_MUTATION and the mutation { issueLabelCreate(input: { name: "<label.name>", teamId: "${LINEAR.teamId}", parentId: "${LINEAR.gameLabelGroupId}" }) { success issueLabel { id name } } }. Answer with its id as labelId.
- An issue whose id is null: first look for one that exists with LINEAR_SEARCH_ISSUES (query = its exact wantTitle, first 10) and reuse a result of the team ${LINEAR.teamKey} whose title is exactly that; otherwise make it with LINEAR_CREATE_LINEAR_ISSUE: team_id, title (wantTitle), description, project_id, assignee_id, state_id (the id of wantState), label_ids (the game label, Feature, and its lane label when its lane is not null), and parent_id (the id of the parent issue) for every issue but the parent. Make the parent before the others.
- An issue whose id is filled and whose state differs from wantState: LINEAR_UPDATE_ISSUE with issueId and stateId (the id of wantState). When its title differs from wantTitle, send title too.
- An issue whose comment is not null and whose id is filled: LINEAR_CREATE_LINEAR_COMMENT with issueId and body (the comment), once, and answer commented true for it.
- An issue that you made, or found by its title, in this call is neither moved nor commented in this call (the policy lets a call touch only the issues the work order already has an id for): it is made in its wantState, and answer commented false for it, the next point posts its comment.
- Never delete, archive or move anything, and never touch an issue that is not in the work order.

Answer with the JSON only: for each issue of the work order its key, id, identifier (like ${LINEAR.teamKey}-41, taken from its url or from LINEAR_GET_LINEAR_ISSUE), url and its state as written (Todo, In Progress or Done), and the game label id as labelId.`
}

/** What the call answered, written into the state; the problems are what the answer lacks. */
export function applyResult(state: PipelineState, structured: unknown, order: WorkOrder): string[] {
  const problems: string[] = []
  if (typeof structured !== "object" || structured === null) return ["the answer is not an object"]
  const answer = structured as { labelId?: unknown; issues?: unknown }
  if (typeof answer.labelId === "string" && answer.labelId) state.linear.labelId = answer.labelId
  const items = Array.isArray(answer.issues) ? answer.issues : []
  for (const wanted of order.issues) {
    const item = items.find((candidate): candidate is Record<string, unknown> => typeof candidate === "object" && candidate !== null && (candidate as { key?: unknown }).key === wanted.key)
    if (!item || typeof item.id !== "string" || typeof item.identifier !== "string" || typeof item.url !== "string") {
      problems.push(`no issue came back for ${wanted.key}`)
      continue
    }
    const before = wanted.key === "parent" ? state.linear.parent : stepOf(state, wanted.key).issue
    const next: LinearIssueRef = {
      id: item.id,
      identifier: item.identifier,
      url: item.url,
      title: wanted.wantTitle,
      applied: typeof item.state === "string" && item.state in LINEAR.states ? item.state : wanted.wantState,
      commented: before?.commented === true || item.commented === true,
    }
    if (wanted.key === "parent") state.linear.parent = next
    else stepOf(state, wanted.key).issue = next
  }
  return problems
}

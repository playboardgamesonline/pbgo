import type { RunResult } from "./run.ts"
import type { Change, PlanAction, PlanItem } from "./types.ts"

const ACTIONS: PlanAction[] = ["create", "create-from-published", "update", "unchanged"]

const WORDS: Record<PlanAction, string> = {
  create: "new",
  "create-from-published": "from published",
  update: "to fill",
  unchanged: "unchanged",
}

const MEANING: Record<PlanAction, string> = {
  create: "new draft",
  "create-from-published": "new draft made from the published document, gaps filled",
  update: "existing draft, gaps filled",
  unchanged: "nothing to add",
}

const MAX_LISTED = 8

const short = (value: unknown, max = 72) => {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const listed = (items: string[], max = MAX_LISTED) => (items.length > max ? `${items.slice(0, max).join(", ")} (+${items.length - max} more)` : items.join(", "))

const ofKind = <K extends Change["kind"]>(plan: PlanItem[], kind: K) =>
  plan.flatMap((item) => item.changes.filter((change): change is Extract<Change, { kind: K }> => change.kind === kind).map((change) => ({ item, change })))

function typeLines(plan: PlanItem[]): string[] {
  const types = [...new Set(plan.map((item) => item.type))]
  return types.map((type) => {
    const items = plan.filter((item) => item.type === type)
    const parts = ACTIONS.map((action) => [action, items.filter((item) => item.action === action).length] as const)
      .filter(([, n]) => n > 0)
      .map(([action, n]) => `${n} ${WORDS[action]}`)
    return `  ${type.padEnd(11)} ${String(items.length).padStart(3)}   ${parts.join(", ")}`
  })
}

function artLines(result: RunResult): string[] {
  if (!result.art) return ["Art: not processed (no --art-dir). Drop the files in a folder and pass it; see docs/content-pipeline.md."]
  const { dir, slotCount, loaded, uploaded } = result.art
  const { scan, images } = loaded
  const lines = [`Art (${dir}): ${slotCount} slots in total, ${images.length} file(s) matched, ${scan.missing.length} still missing`]
  if (images.length) {
    const existing = images.filter((image) => image.exists).length
    lines.push(result.mode === "apply" ? `  uploaded ${uploaded} new image(s); ${images.length - uploaded} were already in the dataset` : `  would upload ${images.length - existing} new image(s); ${existing} already in the dataset`)
  }
  for (const image of images) for (const warning of image.warnings) lines.push(`  warning: ${warning}`)
  if (scan.unmatched.length) lines.push(`  files that match no slot (typo in the name?): ${listed(scan.unmatched)}`)
  if (scan.missing.length) lines.push(`  missing: ${listed(scan.missing.map((slot) => slot.name), 6)}`)
  return lines
}

/** Is anything left for `--apply`: a document to write or an image to upload? */
const hasWork = ({ plan, art }: RunResult) => plan.some((item) => item.action !== "unchanged") || Boolean(art?.loaded.images.some((image) => !image.exists))

/** The summary printed after a run. It has no access to the token, so it cannot leak it. */
export function formatReport(result: RunResult, { projectId, dataset, verbose = false }: { projectId: string; dataset: string; verbose?: boolean }): string {
  const { plan } = result
  const lines: string[] = [`Content seed · project ${projectId} · dataset ${dataset}`, ""]

  if (result.mode === "dry-run") lines.push("DRY RUN: nothing was written or uploaded. Run again with --apply to write the drafts.")
  else lines.push(`APPLIED: ${result.written} draft(s) written. Nothing is published: review and publish them in the Studio.`)
  lines.push("")

  lines.push(`${plan.length} document(s) selected out of ${result.seedCount} in the seed`)
  for (const action of ACTIONS) {
    const n = plan.filter((item) => item.action === action).length
    if (n) lines.push(`  ${String(n).padStart(3)}  ${MEANING[action]}`)
  }
  lines.push("", ...typeLines(plan))

  const touched = plan.filter((item) => item.action === "update" || item.action === "create-from-published")
  if (touched.length) {
    lines.push("", "Gaps filled in existing documents:")
    for (const item of touched) lines.push(`  ${item.id}: ${listed(item.changes.filter((change) => change.kind === "fill").map((change) => change.path))}`)
  }

  if (verbose) {
    lines.push("", "Every document:")
    for (const item of plan) lines.push(`  ${item.action.padEnd(21)} ${item.id} (${item.type})`)
  }

  const diverged = ofKind(plan, "diverged")
  if (diverged.length) {
    lines.push("", `Kept as edited in Sanity (${diverged.length}): the seed says something else. Use --overwrite --only <id> to replace.`)
    for (const { item, change } of diverged) lines.push(`  ${item.id} › ${change.path}`, `      Sanity: ${short(change.current)}`, `      seed:   ${short(change.seed)}`)
  }

  const overwritten = ofKind(plan, "overwrite")
  if (overwritten.length) {
    lines.push("", `Replaced with the seed's value (${overwritten.length}, --overwrite):`)
    for (const { item, change } of overwritten) lines.push(`  ${item.id} › ${change.path}`, `      was: ${short(change.current)}`, `      now: ${short(change.seed)}`)
  }

  lines.push("", ...artLines(result))

  if (result.orphans.length) lines.push("", `In the dataset but not in the seed (left alone, never deleted): ${listed(result.orphans)}`)

  lines.push("")
  if (result.mode === "apply") lines.push("Verified: planning again after the write finds nothing to do, so running the seed again changes nothing.")
  else if (!hasWork(result)) lines.push("Next: nothing to add, everything the seed selects is already in the dataset.")
  else lines.push("Next: check this summary, then run with --apply. The seed only writes drafts; publishing is done in the Studio.")
  return lines.join("\n")
}

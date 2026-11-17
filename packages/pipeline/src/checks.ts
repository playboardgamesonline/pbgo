// The machine's check of a step: what the skill's own commands say of what the sub-agent left. The verdict is the command's exit code; this only chooses what the owner reads. Run after
// the sub-agent's report (`pnpm game-flow gate`), and again when the owner validates, since the owner may have changed the files since.
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { specPathsOf } from "@pbgo/games/rules-spec"
import { readScout } from "@pbgo/games/scout"
import type { Exec, ExecResult } from "./exec.ts"
import { publishedIds } from "./publish.ts"
import { gateArgs, stageLines } from "./stage.ts"
import { stepOf, type PipelineState } from "./state.ts"
import type { Game, StepDefinition } from "./steps.ts"
import { tilde } from "./text.ts"

export type CheckResult = { ok: boolean; lines: string[] }

/** What a check reaches out of itself. */
export type CheckDeps = {
  exec: Exec
  repoRoot: string
  /** the folder of the specs of the games, `docs/games` of the checkout */
  gamesDocs: string
  /** the documents, among these ids, that the platform's Sanity does not show as published (`null`: it could not be read) */
  missingPublished: (ids: string[]) => Promise<string[] | null>
}

const printed = (...texts: string[]): string[] =>
  texts
    .join("\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !line.startsWith("$ ") && !line.startsWith("> "))

/** A command's verdict: its exit code, and its lines without pnpm's echo of the command. */
function verdict(result: ExecResult): CheckResult {
  const lines = printed(result.stdout, result.stderr)
  return { ok: result.code === 0, lines: lines.length > 0 ? lines : [result.code === 0 ? "ok" : "failed"] }
}

/** What the game's own seed says of its art folder in a dry run: the "Art" part (which slots have a file, which have none, which files match no slot). A seed that cannot run is the one thing that fails. */
function artVerdict(result: ExecResult): CheckResult {
  const all = `${result.stdout}\n${result.stderr}`.split("\n").map((line) => line.trimEnd()).filter((line) => !line.startsWith("$ ") && !line.startsWith("> "))
  const start = all.findIndex((line) => line.startsWith("Art ("))
  const block = start < 0 ? [] : all.slice(start)
  const end = block.findIndex((line) => line.trim() === "")
  const art = end === -1 ? block : block.slice(0, end)
  const lines = art.length > 0 ? art : all.filter((line) => line.trim() !== "").slice(-8)
  return { ok: result.code === 0, lines: lines.length > 0 ? lines : [result.code === 0 ? "ok" : "failed"] }
}

/** The check of a step, as its definition says. */
export async function runCheck(step: StepDefinition, ctx: { deps: CheckDeps; game: Game; state: PipelineState }): Promise<CheckResult> {
  const { deps, game, state } = ctx
  const check = step.check
  switch (check.kind) {
    case "scout": {
      if (!existsSync(game.scoutFile)) return { ok: false, lines: [`no scout file was written (${tilde(game.scoutFile)}): the skill stopped before it, say what it asks`] }
      const parsed = readScout(readFileSync(game.scoutFile, "utf8"))
      if (parsed.scout === null) return { ok: false, lines: [`${tilde(game.scoutFile)} is not a scout file:`, ...parsed.problems.map((problem) => `  - ${problem}`)] }
      return verdict(await deps.exec("pnpm", ["check:scout", game.scoutFile, "--online"], { cwd: deps.repoRoot, timeoutMs: 120_000 }))
    }
    case "rules": {
      if (!existsSync(specPathsOf(deps.gamesDocs, state.slug).rules)) return { ok: false, lines: [`no spec was written (docs/games/${state.slug}/rules.md): the skill stopped before it, say what it asks`] }
      return verdict(await deps.exec("pnpm", ["check:rules", state.slug, "--name", state.name], { cwd: deps.repoRoot, timeoutMs: 60_000 }))
    }
    case "pictures":
      return verdict(await deps.exec("pnpm", ["catalog:pictures", state.slug], { cwd: deps.repoRoot, timeoutMs: 60_000 }))
    case "art":
      return artVerdict(await deps.exec("pnpm", ["-C", `games/${state.slug}`, "content:seed", "--dry-run", "--art-dir", game.dir], { cwd: deps.repoRoot, timeoutMs: 180_000 }))
    case "stage": {
      const result = await deps.exec(process.execPath, [join(deps.repoRoot, "scripts", "check-game.mjs"), state.slug, ...gateArgs(check.gate)], { cwd: deps.repoRoot, timeoutMs: 60_000 })
      return { ok: result.code === 0, lines: stageLines(`${result.stdout}\n${result.stderr}`) }
    }
    case "published": {
      // the report the owner validated names the documents; the platform's public API is asked, and the skill's word that it published is not taken as done
      const ids = publishedIds(stepOf(state, step.id).report ?? "")
      if (ids.length === 0) return { ok: false, lines: ['the report does not say which documents publish would make public: ask the sub-agent for the sentence "Validate publishes N documents (ids)"'] }
      const missing = await deps.missingPublished(ids)
      if (missing === null) return { ok: true, lines: [`${ids.join(", ")}: the platform's Sanity could not be read to confirm the publication, the skill's own read-back is what there is`] }
      if (missing.length > 0) return { ok: false, lines: [`not published: ${missing.join(", ")}`, `published: ${ids.filter((id) => !missing.includes(id)).join(", ") || "none"}`] }
      return { ok: true, lines: [`published: ${ids.join(", ")}`] }
    }
  }
}

/** The stage of a game that has a folder, as `pnpm check:game` judges it (`null` when it cannot be read). */
export async function stageOf(deps: Pick<CheckDeps, "exec" | "repoRoot">, slug: string): Promise<string | null> {
  const result = await deps.exec(process.execPath, [join(deps.repoRoot, "scripts", "check-game.mjs"), slug, "--json"], { cwd: deps.repoRoot, timeoutMs: 30_000 })
  try {
    const parsed = JSON.parse(result.stdout) as { reached?: unknown }
    return typeof parsed.reached === "string" ? parsed.reached : null
  } catch {
    return null
  }
}

/** The owner validated the spec: its status and every reading that waited for their word become "validated" with the day (`pnpm check:rules --stamp`, which checks the page again). */
export async function stampRules(deps: Pick<CheckDeps, "exec" | "repoRoot">, state: PipelineState, day: string): Promise<CheckResult> {
  return verdict(await deps.exec("pnpm", ["check:rules", state.slug, "--name", state.name, "--stamp", "--date", day], { cwd: deps.repoRoot, timeoutMs: 60_000 }))
}

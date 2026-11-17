// `pnpm add-game "<name>"` (scripts/add-game.sh hands a name over to this file): the pipeline from a game's name to the platform's catalog.
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { parseCli, USAGE } from "../src/cli.ts"
import { runCheck } from "../src/commands.ts"
import { runClaude, runSession } from "../src/claude.ts"
import { assetsRoot, checkArtBin, checkPicturesBin, checkRulesBin, checkScoutBin, checkStageBin, claudeBin, REPO_ROOT } from "../src/config.ts"
import { DownloadError, downloadPdf } from "../src/download.ts"
import { makeIo } from "../src/io.ts"
import { EXIT, listPipeline, runPipeline, type CheckResult, type Deps, type RulebookFetch } from "../src/pipeline.ts"
import { nodeExec } from "../src/preflight.ts"
import { gateArgs, stageLines, type StageGate } from "../src/stage.ts"
import { missingPublished } from "../src/sanity.ts"
import { listGames } from "../src/state.ts"

const env = process.env
const exec = nodeExec

/** What the machine says of a scout file: `pnpm check:scout <file> --online`, without pnpm's echo of the command. */
async function checkScout(file: string): Promise<CheckResult> {
  const bin = checkScoutBin(env)
  const result = bin ? await exec(bin, [file, "--online"], { cwd: REPO_ROOT, timeoutMs: 120_000 }) : await exec("pnpm", ["check:scout", file, "--online"], { cwd: REPO_ROOT, timeoutMs: 120_000 })
  const lines = `${result.stdout}\n${result.stderr}`
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !line.startsWith("$ ") && !line.startsWith("> "))
  return { ok: result.code === 0, lines: lines.length > 0 ? lines : [result.code === 0 ? "ok" : "failed"] }
}

/** What the machine says of the spec of a game: `pnpm check:rules <slug> --name <name>`, without pnpm's echo of the command. */
async function checkRules(slug: string, name: string): Promise<CheckResult> {
  const bin = checkRulesBin(env)
  const result = bin ? await exec(bin, [slug, "--name", name], { cwd: REPO_ROOT, timeoutMs: 60_000 }) : await exec("pnpm", ["check:rules", slug, "--name", name], { cwd: REPO_ROOT, timeoutMs: 60_000 })
  const lines = `${result.stdout}\n${result.stderr}`
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !line.startsWith("$ ") && !line.startsWith("> "))
  return { ok: result.code === 0, lines: lines.length > 0 ? lines : [result.code === 0 ? "ok" : "failed"] }
}

/** What the platform's public API says of the pictures of a game's published entry: `pnpm catalog:pictures <slug>`, without pnpm's echo of the command. */
async function checkPictures(slug: string): Promise<CheckResult> {
  const bin = checkPicturesBin(env)
  const result = bin ? await exec(bin, [slug], { cwd: REPO_ROOT, timeoutMs: 60_000 }) : await exec("pnpm", ["catalog:pictures", slug], { cwd: REPO_ROOT, timeoutMs: 60_000 })
  const lines = `${result.stdout}\n${result.stderr}`
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !line.startsWith("$ ") && !line.startsWith("> "))
  return { ok: result.code === 0, lines: lines.length > 0 ? lines : [result.code === 0 ? "ok" : "failed"] }
}

/**
 * What the game's own seed says of its art folder: a dry run on it, which writes nothing, and of its report the "Art" part (which slots have a file, which have none, which files match no slot). A seed
 * that cannot be run (no `content/seed.ts`, no token) is the one thing that fails the check: the owner may leave slots empty.
 */
async function checkArt(slug: string, dir: string): Promise<CheckResult> {
  const bin = checkArtBin(env)
  const result = bin
    ? await exec(bin, [slug, dir], { cwd: REPO_ROOT, timeoutMs: 180_000 })
    : await exec("pnpm", ["-C", `games/${slug}`, "content:seed", "--dry-run", "--art-dir", dir], { cwd: REPO_ROOT, timeoutMs: 180_000 })
  const all = `${result.stdout}\n${result.stderr}`
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !line.startsWith("$ ") && !line.startsWith("> "))
  const start = all.findIndex((line) => line.startsWith("Art ("))
  const block = start < 0 ? [] : all.slice(start)
  const end = block.findIndex((line) => line.trim() === "")
  const art = end === -1 ? block : block.slice(0, end)
  const lines = art.length > 0 ? art : all.filter((line) => line.trim() !== "").slice(-8)
  return { ok: result.code === 0, lines: lines.length > 0 ? lines : [result.code === 0 ? "ok" : "failed"] }
}

/** A stage of the game as `pnpm check:game` judges it, for a step that is a session of the owner's: every check up to the stage, or the checks of that stage alone. It reads files only. */
async function checkStage(slug: string, gate: StageGate): Promise<CheckResult> {
  const bin = checkStageBin(env)
  const result = bin ? await exec(bin, [slug, ...gateArgs(gate)], { cwd: REPO_ROOT, timeoutMs: 60_000 }) : await exec(process.execPath, [join(REPO_ROOT, "scripts", "check-game.mjs"), slug, ...gateArgs(gate)], { cwd: REPO_ROOT, timeoutMs: 60_000 })
  return { ok: result.code === 0, lines: stageLines(`${result.stdout}\n${result.stderr}`) }
}

/** The rulebook the scout found, fetched to a file by the command itself (`download.ts` says how it is bounded). */
async function fetchRulebook(url: string, dest: string): Promise<RulebookFetch> {
  try {
    return { ok: true, bytes: await downloadPdf(url, dest) }
  } catch (error) {
    return { ok: false, reason: error instanceof DownloadError ? error.message : error instanceof Error ? error.message.slice(0, 160) : "the fetch failed" }
  }
}

/** The stage `pnpm check:game` gives a game that has a folder. */
async function stageOf(slug: string): Promise<string | null> {
  const result = await exec(process.execPath, [join(REPO_ROOT, "scripts", "check-game.mjs"), slug, "--json"], { cwd: REPO_ROOT, timeoutMs: 30_000 })
  try {
    const parsed = JSON.parse(result.stdout) as { reached?: unknown }
    return typeof parsed.reached === "string" ? parsed.reached : null
  } catch {
    return null
  }
}

const deps: Deps = {
  env,
  repoRoot: REPO_ROOT,
  assets: assetsRoot(env),
  claudeBin: claudeBin(env),
  exec,
  run: runClaude,
  checkScout,
  checkRules,
  fetchRulebook,
  checkPictures,
  checkArt,
  checkStage,
  session: runSession,
  stageOf,
  verifyPublished: (ids) => missingPublished(ids, { base: env.PBGO_SANITY_API_BASE }),
  now: () => new Date(),
  uuid: randomUUID,
  color: Boolean(process.stdout.isTTY) && !env.NO_COLOR,
}

const io = makeIo(process.stdin, process.stdout, process.stderr)
const command = parseCli(process.argv.slice(2))

try {
  switch (command.kind) {
    case "help":
      io.out(USAGE)
      process.exitCode = EXIT.ok
      break
    case "error":
      io.err(`${command.message}\n\n${USAGE}`)
      process.exitCode = EXIT.usage
      break
    case "list":
      process.exitCode = await listPipeline(io, deps, listGames(deps.assets))
      break
    case "check":
      process.exitCode = await runCheck(io, deps)
      break
    case "run":
      process.exitCode = await runPipeline(command.options, io, deps)
      break
  }
} catch (error) {
  io.err(`✗ ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = EXIT.failed
} finally {
  io.close()
}

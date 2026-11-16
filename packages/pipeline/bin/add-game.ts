// `pnpm add-game "<name>"` (scripts/add-game.sh hands a name over to this file): the pipeline from a game's name to the platform's catalog.
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { parseCli, USAGE } from "../src/cli.ts"
import { runCheck } from "../src/commands.ts"
import { runClaude } from "../src/claude.ts"
import { assetsRoot, checkScoutBin, claudeBin, REPO_ROOT } from "../src/config.ts"
import { makeIo } from "../src/io.ts"
import { EXIT, listPipeline, runPipeline, type CheckResult, type Deps } from "../src/pipeline.ts"
import { nodeExec } from "../src/preflight.ts"
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

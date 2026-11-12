#!/usr/bin/env node
// Checks the board of a game in a real browser, the way `.claude/skills/engine-board` step 6 asks, so that nobody writes the scripts again: a headless Chromium (the one Playwright keeps in its cache) opens the table as the viewer
// while guests that only exist here sit at it and play through the API, and the report says what was seen.
// Usage: pnpm check:board <slug> [--players 3,5,8] [--sizes 1280x800,...] [--checks presses,sizes,...] [--scenarios a,b] [--out <dir>] [--reduced-motion] [--keep-tables] [--port 3100] [--absent-seconds 85]
// It needs `pnpm dev` running (http://localhost:3100) and writes tables to the Supabase project of its `.env.local`, the preview one, so it never runs on production and is no part of the six gates or of CI. What is the game's own (where to
// press, how to rig a case) is in `games/<slug>/check-board.config.mjs`, optional. Exit 0: every check passed; 1: a check failed (no board, a console error, a press that changed nothing…); 2: it could not run. `docs/scripts.md` has it in full.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { findBrowser } from "./check-board/browser.mjs"
import { CHECKS } from "./check-board/checks/index.mjs"
import { gameDir, loadConfig, registryEntry } from "./check-board/config.mjs"
import { runCheck } from "./check-board/run.mjs"
import { findFfmpeg } from "./check-board/sheets.mjs"
import { parseSize, seconds } from "./check-board/util.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_SIZES = ["1280x800", "1280x720", "1440x900", "1920x1080", "2560x1080", "1024x640", "1024x768", "900x600", "1024x1366", "900x1200"]

const HELP = `Usage: pnpm check:board <slug> [options]

Checks a game's board in a headless browser: the board at the windows the platform lets in, the viewer's controls pressed with the mouse, the cases that GAME.debug can rig as frames,
a reload in the middle of a game, the normal start and a player who is away. Writes contact sheets and report.json to --out; exits 1 when a check fails.

  --players 3,5,8          the counts of seats (default: the fewest, a middle count and the most of the game's registry entry, at most 12)
  --sizes 1280x800,...     the windows (default: ${DEFAULT_SIZES.join(", ")}); the first is the one every control must be reachable in
  --checks presses,sizes   which checks to run (default: all of ${Object.keys(CHECKS).join(", ")})
  --scenarios flipthree    which cases of the scenarios check (default: all those of the game's config, then turn and over)
  --out <dir>              where the sheets and the report go (default: a folder of the system's temporary files; keep it out of the repo)
  --reduced-motion         the visitor asks for less motion
  --keep-tables            leave the tables as they are (default: the guests leave, which deletes them)
  --port 3100              the dev server's port (the pictures of the game load only from http://localhost:3100)
  --absent-seconds 85      how long the others are away in the absent check (the platform counts a seat present for 75 s)

Needs: \`pnpm dev <slug>\` running, Chromium in Playwright's cache (\`npx playwright install chromium\`), ffmpeg (\`brew install ffmpeg\`). What is the game's own is in games/<slug>/check-board.config.mjs.`

/** An error that ends the run with a message and exit code 2 */
class Usage extends Error {}

function parseArgs(argv) {
  const args = { slug: null, players: null, sizes: null, checks: null, scenarios: null, out: null, port: 3100, absentSeconds: 85, reducedMotion: false, keepTables: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].startsWith("--") ? argv[i].split(/=(.*)/s, 2) : [argv[i], undefined]
    const value = () => {
      if (inline !== undefined) return inline
      const next = argv[++i]
      if (next === undefined || next.startsWith("--")) throw new Usage(`${flag} needs a value`)
      return next
    }
    const list = () => value().split(",").map((item) => item.trim()).filter(Boolean)
    switch (flag) {
      case "--help":
      case "-h":
        args.help = true
        break
      case "--players":
        args.players = list().map(Number)
        if (args.players.some((n) => !Number.isInteger(n) || n < 1)) throw new Usage("--players takes whole numbers: --players 3,5,8")
        break
      case "--sizes":
        args.sizes = list().map((text) => parseSize(text) ?? (() => { throw new Usage(`"${text}" is not a window size: WIDTHxHEIGHT, e.g. 1280x800`) })())
        break
      case "--checks":
        args.checks = list()
        for (const name of args.checks) if (!(name in CHECKS)) throw new Usage(`there is no check "${name}" (the checks are ${Object.keys(CHECKS).join(", ")})`)
        break
      case "--scenarios":
        args.scenarios = list()
        break
      case "--out":
        args.out = value()
        break
      case "--port":
        args.port = Number(value())
        if (!Number.isInteger(args.port)) throw new Usage("--port takes a port number")
        break
      case "--absent-seconds":
        args.absentSeconds = Number(value())
        if (!(args.absentSeconds >= 0)) throw new Usage("--absent-seconds takes a number of seconds")
        break
      case "--reduced-motion":
        args.reducedMotion = true
        break
      case "--keep-tables":
        args.keepTables = true
        break
      default:
        if (flag.startsWith("-")) throw new Usage(`unknown option ${flag}`)
        if (args.slug) throw new Usage(`one game at a time, got "${args.slug}" and "${flag}"`)
        args.slug = flag
    }
  }
  return args
}

/** What `KEY=value` says in an env file, without looking at any other line; null when there is none */
function envValue(file, key) {
  if (!existsSync(file)) return null
  const match = new RegExp(`^(?:export\\s+)?${key}=["']?([^"'\\s]*)`, "m").exec(readFileSync(file, "utf8"))
  return match ? match[1] : null
}

/** Which Supabase project the dev server on `port` writes to: the checkout it runs from (asked of the system), its `.env.local`, and the name of the project when the secrets file knows it */
function supabaseOf(port) {
  let checkout = ROOT
  try {
    const pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n")[0]
    const cwd = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").find((line) => line.startsWith("n"))?.slice(1)
    if (cwd) checkout = cwd.endsWith("/apps/web") ? cwd.slice(0, -"/apps/web".length) : cwd
  } catch {
    // no lsof, or nothing listens: the checkout this script is in is the best guess
  }
  const envFile = join(checkout, "apps/web/.env.local")
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(envValue(envFile, "NEXT_PUBLIC_SUPABASE_URL") ?? "")?.[1] ?? null
  const secrets = join(homedir(), ".config/pbgo/secrets.env")
  const production = envValue(secrets, "SUPABASE_PROJECT_REF")
  const preview = envValue(secrets, "SUPABASE_PREVIEW_PROJECT_REF")
  const name = !ref ? null : ref === production ? "production" : ref === preview ? "pbgo-preview" : null
  return { checkout, envFile, ref, name, knowsProjects: !!(production || preview) }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(HELP)
    return 0
  }
  if (!args.slug) throw new Usage(`${HELP}\n\nWhich game? e.g. pnpm check:board flip-7`)
  const { slug } = args
  if (!existsSync(gameDir(ROOT, slug))) throw new Usage(`There is no game ${slug}: ${gameDir(ROOT, slug).slice(ROOT.length + 1)} does not exist.`)
  const entry = registryEntry(ROOT, slug)
  if (!entry) throw new Usage(`${slug} is not in packages/games/src/registry.ts: \`pnpm add-game\` registers a game.`)

  // What it needs on this machine
  const browser = findBrowser()
  if (!browser) throw new Usage("No Chromium in Playwright's cache. Get one (nothing is added to the repo): npx playwright install chromium")
  const ffmpeg = await findFfmpeg()
  if (!ffmpeg) throw new Usage("ffmpeg is not installed (it tiles the frames into sheets): brew install ffmpeg")

  const { file, shown, config, problems } = await loadConfig(ROOT, slug)
  if (problems.length) throw new Usage(problems.join("\n"))
  // What it runs
  const most = Math.max(entry.min, Math.min(entry.max, 12))
  const wanted = args.players ?? [...new Set([entry.min, Math.floor((entry.min + most) / 2), most])]
  const seatCounts = config.players && !args.players ? config.players : wanted
  for (const n of seatCounts) if (n < entry.min || n > entry.max) throw new Usage(`${slug} seats ${entry.min} to ${entry.max} players, not ${n}`)
  const sizes = args.sizes ?? (config.sizes ?? DEFAULT_SIZES).map((text) => parseSize(text) ?? (() => { throw new Usage(`${shown}: "${text}" is not a window size`) })())
  const base = `http://localhost:${args.port}`
  const reachable = await fetch(`${base}/${slug}`, { redirect: "manual" }).then((response) => response.status < 500, () => false)
  if (!reachable) throw new Usage(`Nothing answers at ${base}/${slug}. Start the app first: pnpm dev ${slug}`)

  // Where it will write
  const supabase = supabaseOf(args.port)
  console.log(`Supabase: the server at ${base} runs from ${supabase.checkout} and its .env.local points at ${supabase.ref ? `project ${supabase.ref}${supabase.name ? ` (${supabase.name})` : ""}` : "no project at all"}.`)
  if (supabase.name === "production") throw new Usage("That is the production project: this tool opens tables and plays them, development only. Point .env.local at pbgo-preview (pnpm setup-env).")
  if (!supabase.ref) throw new Usage(`${supabase.envFile} has no NEXT_PUBLIC_SUPABASE_URL: nothing to write tables to.`)
  if (!supabase.name) console.log(`  ${supabase.knowsProjects ? "It is neither project of ~/.config/pbgo/secrets.env" : "~/.config/pbgo/secrets.env is not readable, so it cannot be told which project that is"}: check that it is the preview one before going on.`)

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")
  const out = args.out ?? join(tmpdir(), "check-board", `${slug}-${stamp}`)
  mkdirSync(out, { recursive: true })
  const report = {
    slug,
    startedAt: new Date().toISOString(),
    base,
    supabase: { project: supabase.ref, name: supabase.name, from: supabase.checkout },
    browser: browser.path,
    ffmpeg: ffmpeg.version,
    config: file ? shown : null,
    seats: seatCounts,
    sizes: sizes.map(([w, h]) => `${w}x${h}`),
    checks: [],
  }
  const ctx = { slug, base, root: ROOT, out, config, configName: shown, args: { ...args, sizes, viewport: sizes[0] }, ffmpeg, log: (line) => console.log(line) }
  const save = () => writeFileSync(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Chromium ${browser.path.split("/").slice(-3).join("/")} · ffmpeg ${ffmpeg.version} · config ${file ? shown : `none (${shown} would hold the game's own part)`}`)
  console.log(`Seats ${seatCounts.join(", ")} · ${sizes.length} windows · out ${out}\n`)

  const started = Date.now()
  const mark = { pass: "✓", fail: "✗", skipped: "–" }
  const show = (result, what = "") => {
    console.log(`${mark[result.status]} ${result.check}${result.seats ? ` · ${result.seats} seats` : ""} (${seconds(result.ms)})${what}${result.files.length ? ` → ${result.files.join(", ")}` : ""}`)
    for (const problem of result.problems) console.log(`    ✗ ${problem}`)
    for (const warning of result.warnings.slice(0, 5)) console.log(`    • ${warning}`)
    if (result.warnings.length > 5) console.log(`    • and ${result.warnings.length - 5} more in the report`)
    console.log("")
  }

  // A first look, before anything is measured: the board of a table is opened once, so that a server that compiles on demand has compiled it, and a board that does not draw is told at once instead of by every check in turn
  console.log("▸ warm-up")
  const warm = await runCheck(ctx, { check: "warm-up", seats: Math.min(...seatCounts), lenient: true }, async (env) => {
    const table = await env.table()
    await table.start()
    const page = await env.board(table)
    env.result.data = { drawnAfterMs: page.drawnAfter, stillAfterMs: page.stillAfter }
  })
  report.checks.push(warm)
  save()
  show(warm, warm.status === "pass" ? ` — the board drew after ${seconds(warm.data.drawnAfterMs)}` : "")
  if (warm.status === "fail") {
    console.log("The other checks need a board that draws: stopped.")
    report.summary = { checks: 1, passed: 0, failed: 1, skipped: 0, ms: Date.now() - started }
    save()
    return 1
  }

  // The checks, one after the other: a table and a browser each, so that none leaves anything to the next
  const names = args.checks ?? Object.keys(CHECKS)
  for (const name of Object.keys(CHECKS).filter((key) => names.includes(key))) {
    const { run, seats } = CHECKS[name]
    for (const count of seats === "fewest" ? [Math.min(...seatCounts)] : seatCounts) {
      console.log(`▸ ${name} · ${count} seats`)
      const result = await run(ctx, count)
      report.checks.push(result)
      save()
      show(result)
    }
  }

  const failed = report.checks.filter((result) => result.status === "fail").length
  report.summary = { checks: report.checks.length, passed: report.checks.filter((result) => result.status === "pass").length, failed, skipped: report.checks.filter((result) => result.status === "skipped").length, ms: Date.now() - started }
  save()
  console.log(`${failed ? "FAILED" : "OK"}: ${report.summary.checks} checks, ${report.summary.passed} passed, ${failed} failed, ${report.summary.skipped} skipped, in ${seconds(report.summary.ms)}.`)
  for (const result of report.checks.filter((item) => item.status === "fail")) console.log(`  ✗ ${result.check}${result.seats ? ` · ${result.seats} seats` : ""}: ${result.problems[0]}${result.problems.length > 1 ? ` (and ${result.problems.length - 1} more)` : ""}`)
  console.log(`Sheets, frames and report.json are in ${out}`)
  return failed ? 1 : 0
}

process.on("SIGINT", () => process.exit(130))
main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Usage ? error.message : (error?.stack ?? error))
    process.exit(error instanceof Usage ? 2 : 1)
  },
)

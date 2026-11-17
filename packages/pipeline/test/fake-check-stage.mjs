// A stand-in for `node scripts/check-game.mjs <slug> --stage <stage>` / `--only <stage>` (PBGO_CHECK_STAGE_BIN): the report it prints and its exit code are in the file FAKE_STAGE_FILE, written by the scenario of a
// session ({ exit, report }); without that file the stage passes. Every call is added to FAKE_STAGE_LOG, so that a test can read which gate was asked.
import { appendFileSync, existsSync, readFileSync } from "node:fs"

const [slug = "", flag = "", stage = ""] = process.argv.slice(2)
if (process.env.FAKE_STAGE_LOG) appendFileSync(process.env.FAKE_STAGE_LOG, `${JSON.stringify({ slug, flag, stage })}\n`)
const file = process.env.FAKE_STAGE_FILE
const said = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null
console.log(said?.report ?? `\n${stage}\n  ✓ registered: registered\n\n${slug} has got as far as: ${stage}. ${flag === "--only" ? `The stage ${stage} passes.` : `Ready for what follows ${stage}.`}\n`)
process.exit(said?.exit ?? 0)

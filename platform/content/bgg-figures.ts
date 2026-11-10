// The figures of the games that BoardGameGeek has and the Studio does not (players, duration, minimum age, complexity), as drafts to publish: PLT-78.
// Usage and guarantees: `node content/bgg-figures.ts --help`, docs/platform-sanity.md ("Figures from BoardGameGeek").
import { readToken } from "@pbgo/content-kit/seed"
import { createBggClient } from "./bgg/client.ts"
import { describeFigures, run } from "./bgg/figures.ts"
import { describeRefresh, runRefresh } from "./bgg/refresh.ts"
import { describeCandidates, findIds, needingAnId, pickIds, type IdCandidates } from "./bgg/ids.ts"
import { createFiguresStore } from "./bgg/store.ts"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"

const HELP = `Reads BoardGameGeek for the games of the catalog that have a BGG id and lack a figure, and proposes what it has as drafts: the complexity (its weight),
the players, the duration and the minimum age. A figure the Studio holds, in the draft or, when there is none, published, is never replaced; a game with a draft gets it
patched, a game without gets one made of the published document. Nothing is published.

With --refresh it does something else: it brings the complexity of the games up to date (it moves as people weigh the games on BoardGameGeek), where that complexity is still
the one BoardGameGeek gave. The weights the script wrote are recorded (the document bgg-sync); one the owner set by hand is never changed. It writes where the hub reads:
the published document and the draft that hold BoardGameGeek's weight, and only when it moved by 0.05 or more. The first run records the weights written before the record
existed. By hand for now.

Usage: node content/bgg-figures.ts [options]

  --dry-run   Read the dataset and BoardGameGeek and print exactly what would be written. Writes nothing. This is the default.
  --apply     Write it as drafts, in one transaction, then read the dataset back. Only on the owner's word.
  --refresh   Refresh the complexity instead of filling the missing figures (see above). With --apply it writes the published documents: only on the owner's word.
  --find-ids  Also search BoardGameGeek by name for the games that have no BGG id or a wrong one, and print the results to pick from. Writes nothing.
  --set-ids   Same search, and where one result has exactly the name of the game, propose its BGG id too (written with the figures, as a draft), the figures being read for
              it as well. A name that several BGG games bear is only printed. A wrong id (another game, or not a board game) is replaced in the draft.
  --help, -h  This text

An age from 16 up is not proposed: on the platform it makes a game for adults (a guest cannot play it). A weight that fewer than 10 people gave is not proposed.
BoardGameGeek's terms apply to what is read: show "Powered by BGG" next to the figures, unaltered, and no commercial use without their licence.
The write token is read from SANITY_API_WRITE_TOKEN_PLATFORM and BoardGameGeek's from BGG_API_TOKEN, in the environment, else in apps/web/.env.local
(pnpm setup-env --no-push writes it there from ~/.config/pbgo/secrets.env). They are never printed.`

/** A wrong command line: reported with a hint, not with a stack trace. */
class UsageError extends Error {}

function parse(argv: string[]): { help: boolean; apply: boolean; refresh: boolean; findIds: boolean; setIds: boolean } {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options = { help: false, apply: false, refresh: false, findIds: false, setIds: false }
  let dryRun = false
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--apply") options.apply = true
    else if (arg === "--dry-run") dryRun = true
    else if (arg === "--refresh") options.refresh = true
    else if (arg === "--find-ids") options.findIds = true
    else if (arg === "--set-ids") options.setIds = true
    else throw new UsageError(arg.startsWith("-") ? `Unknown option ${arg}` : `Unexpected argument "${arg}"`)
  }
  if (options.apply && dryRun) throw new UsageError("--apply and --dry-run exclude each other")
  if (options.refresh && (options.findIds || options.setIds)) throw new UsageError("--refresh is a run of its own: it does not look for ids")
  return options
}

/** BoardGameGeek's token, from the environment (`--env-file-if-exists` of the script loads apps/web/.env.local into it). */
function readBggToken(): string {
  const token = process.env.BGG_API_TOKEN?.trim()
  if (!token) throw new Error("BGG_API_TOKEN is not set (put it in ~/.config/pbgo/secrets.env and run `pnpm setup-env --no-push`, or in apps/web/.env.local)")
  return token
}

const secrets: string[] = []
try {
  const options = parse(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
  } else {
    const sanityToken = readToken({ slug: SLUG, envFile: ENV_FILE })
    const bggToken = readBggToken()
    secrets.push(sanityToken, bggToken)
    const store = createFiguresStore({ projectId: PROJECT_ID, dataset: DATASET, token: sanityToken })
    const client = createBggClient({ token: bggToken })
    if (options.refresh) {
      const refreshed = await runRefresh(store, (ids) => client.things(ids), { apply: options.apply })
      console.log(describeRefresh(refreshed.plan, { projectId: PROJECT_ID, dataset: DATASET, mode: refreshed.mode }))
      if (refreshed.afterProblems.length > 0) {
        console.error(`\nThe write is not what the plan said:\n${refreshed.afterProblems.map((problem) => `  - ${problem}`).join("\n")}`)
        process.exitCode = 1
      }
    } else {
      // The search of the ids is made once, for --set-ids to choose from and for the report
      let searched: IdCandidates[] | null = null
      const search = async (games: ReturnType<typeof needingAnId>) => (searched ??= await findIds(games, client))
      const outcome = await run(store, (ids) => client.things(ids), {
        apply: options.apply,
        chooseIds: options.setIds ? async (plan) => pickIds(await search(needingAnId(plan))) : undefined,
      })
      console.log(describeFigures(outcome.plan, { projectId: PROJECT_ID, dataset: DATASET, mode: outcome.mode }))
      if (outcome.afterProblems.length > 0) console.error(`\nThe write is not what the plan said:\n${outcome.afterProblems.map((problem) => `  - ${problem}`).join("\n")}`)
      if (options.findIds || options.setIds) console.log(`\n${describeCandidates(searched ?? (await findIds(needingAnId(outcome.plan), client)))}`)
      // A write that is not what the plan said is a failure
      if (outcome.afterProblems.length > 0) process.exitCode = 1
    }
  }
} catch (error) {
  // Only the message, and never a token, even if a library echoes it
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of secrets) message = message.split(secret).join("[token]")
  console.error(`Error: ${message}`)
  if (error instanceof UsageError) console.error("Run with --help for the options.")
  process.exitCode = 1
}

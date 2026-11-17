// `pnpm game-flow`: the state of a game that goes through `/add-game` (the skill is `.claude/skills/add-game`). Run by Node, which strips the types, hence the `.ts` extensions.
import { assetsRoot, gamesDocsRoot, REPO_ROOT } from "../src/config.ts"
import { DownloadError, downloadPdf } from "../src/download.ts"
import { nodeExec } from "../src/exec.ts"
import { runFlow } from "../src/flow.ts"
import { missingPublished } from "../src/sanity.ts"

const env = process.env

process.exitCode = await runFlow(process.argv.slice(2), {
  assets: assetsRoot(env),
  repoRoot: REPO_ROOT,
  gamesDocs: gamesDocsRoot(env),
  exec: nodeExec,
  fetchRulebook: async (url, dest) => {
    try {
      return { ok: true, bytes: await downloadPdf(url, dest) }
    } catch (error) {
      return { ok: false, reason: error instanceof DownloadError ? error.message : error instanceof Error ? error.message.slice(0, 160) : "the fetch failed" }
    }
  },
  missingPublished: (ids) => missingPublished(ids, { base: env.PBGO_SANITY_API_BASE }),
  now: () => new Date(),
  out: (text) => console.log(text),
  err: (text) => console.error(text),
})

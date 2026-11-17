// Places the pictures of ONE game of the platform's catalog (its cover, logo, icon, background and box front) as a draft of its document: the step after the catalog entry, which leaves them empty
// (`.claude/skills/platform-assets`, PLT-99). It is the platform's seed (`content/seed.ts`) with one document and the slots of one game, so it has the guarantees of every seed: a dry run by default,
// drafts only (a published document is never touched), a picture that was edited in the Studio is kept, the same files again change nothing. Usage: `node content/attach-art.ts <slug> --art-dir <folder> [--apply]`.
import { runSeedCli } from "@pbgo/content-kit/seed"
import { slugProblem } from "@pbgo/games/slug"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { pictureSlots } from "./data/art.ts"
import { gameId } from "./data/ids.ts"

const USAGE = `Places the pictures of one game of the platform's catalog as a draft of its document.

Usage: node content/attach-art.ts <slug> --art-dir <folder> [--apply] [--overwrite --only game-<slug>] [--verbose]

  <slug>             the game, as the catalog names it (flip-7)
  --art-dir <dir>    the folder of the files, named game-<slug>-cover, -logo, -icon, -background and -boxFront (png, jpg, webp, avif or svg); an absolute path
  --apply            write the draft and upload the pictures (a dry run without it)

The rest is the seed's: node content/seed.ts --help.`

const args = process.argv.slice(2)
const [slug, ...rest] = args[0] === "--" ? args.slice(1) : args
if (slug === undefined || slug === "--help" || slug === "-h") {
  console.log(USAGE)
} else if (slug.startsWith("-") || slugProblem(slug, [], slug.length > 40 ? "expansion" : "game") !== undefined) {
  console.error(`${slug.startsWith("-") ? "Give the slug of the game first" : slugProblem(slug, [], slug.length > 40 ? "expansion" : "game")}\n\n${USAGE}`)
  process.exitCode = 2
} else if (!rest.some((arg) => arg === "--art-dir" || arg.startsWith("--art-dir="))) {
  console.error(`This command places pictures: give the folder with --art-dir\n\n${USAGE}`)
  process.exitCode = 2
} else {
  await runSeedCli(
    {
      slug: SLUG,
      projectId: PROJECT_ID,
      dataset: DATASET,
      envFile: ENV_FILE,
      // one document, with nothing in it but what its pictures put there: the published game is the base, the draft gets the gaps filled
      content: () => ({ docs: [{ _id: gameId(slug), _type: "game" }], slots: pictureSlots(slug, slug) }),
    },
    rest,
  )
}

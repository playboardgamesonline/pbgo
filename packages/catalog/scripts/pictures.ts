// `pnpm catalog:pictures <slug>`: which of the five pictures (cover, logo, icon, background, box front) the published entry of a game has in the platform's Sanity project, from its public API (no token). It
// is what the pictures step of `pnpm add-game` checks once the owner has left the session of `platform-assets`. Run by Node, which strips the types, hence the `.ts` extensions below. Exit 0: the game is
// published (whatever pictures it has); 1: no published game has that slug, or the project cannot be read; 2: a wrong command line.
import { SLUG_PATTERN } from "@pbgo/games/slug"
import { describePictures, readPictures } from "../src/pictures.ts"

const USAGE = `Usage: pnpm catalog:pictures <slug>

  <slug>     a game of the platform's catalog (flip-7)
  --help     this text`

const args = process.argv.slice(2)[0] === "--" ? process.argv.slice(3) : process.argv.slice(2)
if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE)
} else if (args.length !== 1 || !SLUG_PATTERN.test(args[0] ?? "")) {
  console.error(`${args.length !== 1 ? "Give the slug of one game" : `"${args[0]}" is not a slug`}\n\n${USAGE}`)
  process.exitCode = 2
} else {
  const slug = args[0] ?? ""
  try {
    const read = await readPictures(slug)
    if (read === null) {
      console.log(`No published game has the slug ${slug} in the platform's Sanity project: publish its entry first (platform-catalog-entry)`)
      process.exitCode = 1
    } else {
      console.log(describePictures(read).join("\n"))
    }
  } catch (error) {
    console.error(`The platform's Sanity project could not be read: ${error instanceof Error ? error.message : "unknown error"}`)
    process.exitCode = 1
  }
}

// Downloads the pictures of the Notion rows (the games' logos, icons and backgrounds, the publishers' logos) into a folder, under the
// names of the art slots of the seed, so that `content/seed.ts --art-dir <folder>` can place them. Usage: `node content/fetch-art.ts --help`.
import { mkdir, readdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { readPictureLinks } from "@pbgo/catalog/notion"
import { fetchPicture } from "@pbgo/catalog/picture"
import { artJobs, fetchArt, formatFetchReport } from "./art-files.ts"
import { notionOptions, readSource } from "./notion.ts"

const HELP = `Downloads the pictures of the Notion rows into a folder, named after the art slots of the seed. Safe to run again.

Usage: node content/fetch-art.ts --out <folder> [--apply]

  --out <folder>   Where the pictures go: outside the repo (the Hanabi folder is ~/Companies/PBGO/assets/hanabi), say ~/Companies/PBGO/assets/platform
  --dry-run        Read Notion and say what would be downloaded. Writes nothing. This is the default.
  --apply          Download the pictures that are not in the folder yet. A file that is there is left as it is: delete it to bring it again.
  --help, -h       This text

Then: node content/seed.ts --art-dir <folder>   (a dry run), and again with --apply.
The Notion token is read from NOTION_API_KEY in the environment, else from apps/web/.env.local. It is never printed, nor any link of Notion.`

/** A picture is a few hundred kilobytes: this is only a bound against a link that leads to something else. */
const MAX_BYTES = 20 * 1024 * 1024

function parse(argv: string[]): { help: boolean; apply: boolean; out?: string } {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options: { help: boolean; apply: boolean; out?: string } = { help: false, apply: false }
  let dryRun = false
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? ""
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--apply") options.apply = true
    else if (arg === "--dry-run") dryRun = true
    else if (arg === "--out" || arg.startsWith("--out=")) {
      const value = arg.startsWith("--out=") ? arg.slice("--out=".length) : args[(i += 1)]
      if (!value || value.startsWith("-")) throw new Error("--out needs a folder")
      options.out = value
    } else throw new Error(arg.startsWith("-") ? `Unknown option ${arg}` : `Unexpected argument "${arg}"`)
  }
  if (options.apply && dryRun) throw new Error("--apply and --dry-run exclude each other")
  if (!options.help && !options.out) throw new Error("--out <folder> says where the pictures go")
  return options
}

try {
  const options = parse(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
  } else {
    const folder = resolve(options.out ?? "")
    const notion = notionOptions()
    const { games, publishers, notes } = await readSource(notion)
    console.log(notes.join("\n"), "\n")
    const links = await readPictureLinks(notion)
    const { jobs, problems } = artJobs(games, links, publishers)

    let existing: string[] = []
    try {
      existing = await readdir(folder)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    if (options.apply) await mkdir(folder, { recursive: true })

    const report = await fetchArt({
      jobs,
      existing,
      apply: options.apply,
      download: (link) => fetchPicture(link, { maxBytes: MAX_BYTES, timeoutMs: 30_000 }).then(({ bytes, type }) => ({ bytes, type })),
      write: (file, bytes) => writeFile(join(folder, file), bytes),
    })
    console.log(formatFetchReport(report, { apply: options.apply, folder, problems }))
    if (report.failed.length > 0) process.exitCode = 1
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof Error && /^(Unknown option|Unexpected argument|--)/.test(error.message)) console.error("Run with --help for the options.")
  process.exitCode = 1
}

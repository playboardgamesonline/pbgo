// `pnpm check:production <slug>`: what production says of a game that went live, with requests that change nothing (section 5 of the skill `game-go-live`): its two addresses, the metadata of its page, the
// sitemap, its API, its own files and the pictures of its Sanity project (`src/production-check.ts`, which says what each check looks at). Run by Node, which strips the types, hence the `.ts` extensions below.
// Exit 0: every check passes; 1: a check fails; 2: a wrong command line, a game that is not in the registry or not live.
import { GAMES } from "@pbgo/games/registry"
import { SLUG_PATTERN, cleanName, nameProblem } from "@pbgo/games/slug"
import { checkProduction, describeChecks } from "../src/production-check.ts"

const DEFAULT_SITE = "https://playboardgamesonline.app"

const USAGE = `Usage: pnpm check:production <slug> [--site <url>] [--sanity <project id>] [--name <name>] [--json]

  <slug>             a live game of the registry (packages/games/src/registry.ts), flip-7
  --site <url>       the site to read, with no path (${DEFAULT_SITE}): its pages must name that address as their own
  --sanity <id>      the game's own Sanity project, when it is not the one of the registry
  --name <name>      the name the page prints, when the game's own in the platform's Studio is not the registry's
  --json             one line of JSON: the slug, the site and each check with its label, its result and what was found
  --help             this text

It reads the game's two addresses (/<slug> and /game/<slug>), the sitemap, the game's API, its own files and the pictures of its Sanity project, with GET and HEAD alone:
no account, no cookie, no table, nothing is written.`

/** A wrong command line: reported with the usage, exit 2. */
class UsageError extends Error {}

/** The origin of a site address: http or https, no credentials, no path. */
function siteOf(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new UsageError(`--site is not an address: ${value}`)
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UsageError("--site is an http or https address")
  if (url.username !== "" || url.password !== "") throw new UsageError("--site takes no credentials")
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") throw new UsageError("--site is the address of the site, with no path")
  return url.origin
}

function parse(argv: string[]): { help: boolean; json: boolean; slug: string; site: string; sanity: string | null; name: string | null } {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options = { help: false, json: false, slug: "", site: DEFAULT_SITE, sanity: null as string | null, name: null as string | null }
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] ?? ""
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--json") options.json = true
    else if (arg === "--site" || arg === "--sanity" || arg === "--name") {
      const value = args[at + 1]
      if (value === undefined || value.startsWith("--")) throw new UsageError(`${arg} takes a value`)
      at += 1
      if (arg === "--site") options.site = siteOf(value)
      else if (arg === "--name") {
        const problem = nameProblem(value)
        if (problem !== undefined) throw new UsageError(`--name: ${problem}`)
        options.name = cleanName(value)
      } else if (/^[a-z0-9-]+$/.test(value)) options.sanity = value
      else throw new UsageError(`--sanity is the id of a Sanity project (letters and digits), got "${value}"`)
    } else if (arg.startsWith("-")) throw new UsageError(`Unknown option ${arg}`)
    else if (options.slug !== "") throw new UsageError(`One game only, got "${options.slug}" and "${arg}"`)
    else options.slug = arg
  }
  if (!options.help && options.slug === "") throw new UsageError("Give the slug of a live game")
  if (!options.help && !SLUG_PATTERN.test(options.slug)) throw new UsageError(`"${options.slug}" is not a slug`)
  return options
}

try {
  const options = parse(process.argv.slice(2))
  if (options.help) {
    console.log(USAGE)
  } else {
    const game = GAMES.find((each) => each.slug === options.slug)
    if (game === undefined) throw new UsageError(`"${options.slug}" is not a game of the registry (packages/games/src/registry.ts)`)
    if (!game.live) throw new UsageError(`${game.name} is not live: these are the checks of a game in production, once its \`live\` flag is on (pnpm check:game ${game.slug} says where it stands)`)
    const checks = await checkProduction({ slug: game.slug, name: options.name ?? game.name, indexable: game.indexable }, { site: options.site, sanityProjectId: options.sanity ?? game.sanityProjectId })
    const ok = checks.every((check) => check.ok)
    if (options.json) console.log(JSON.stringify({ slug: game.slug, site: options.site, ok, passed: checks.filter((check) => check.ok).length, total: checks.length, checks }))
    else console.log(describeChecks(game.slug, options.site, checks).join("\n"))
    process.exitCode = ok ? 0 : 1
  }
} catch (error) {
  if (!(error instanceof UsageError)) throw error
  console.error(`${error.message}\n\n${USAGE}`)
  process.exitCode = 2
}

import type { BggClient } from "./client.ts"
import { round2 } from "./figures.ts"
import type { BggLink, BggThing, BggVersion } from "./xml.ts"

// What `content:bgg-lookup` says of a game that is not in the catalog yet (GAM-32): the API of the figures (`client.ts`) read for one name or one id, as JSON, for the scout
// to decide from. Read only: no dataset and no token but BoardGameGeek's. Its terms apply (`docs/platform-sanity.md`, "Figures from BoardGameGeek"): the figures are given as
// BGG has them, the weight rounded to two decimals and nothing else changed, and the long texts of BGG are not read.

/** The candidates a search shows at most. */
export const LOOKUP_CANDIDATES = 8
/** How many matches of a search have their figures read: the ids of one request of `thing`. */
export const LOOKUP_READ = 20
/** The versions of a game shown at most (the popular games have hundreds). */
export const LOOKUP_VERSIONS = 40
/** The other names of a game, and the games that came from it, shown at most. */
export const LOOKUP_SHOWN = 6

/** The types a search is made for: a name may be an expansion's. */
const TYPES = ["boardgame", "boardgameexpansion"]

/**
 * A name as it is compared: capitals, the accents of Latin letters and punctuation do not count ("6 nimmt!" is "6 Nimmt"), the letters and digits of any script do. A name with nothing
 * in it that can be compared is compared as it is.
 */
export function comparable(name: string): string {
  const plain = name
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim()
    .normalize("NFC")
  return plain || name.trim().toLowerCase()
}

const same = (a: string, b: string): boolean => comparable(a) === comparable(b)

export type LookupCandidate = {
  id: number
  name: string | null
  /** The other names it is known by, the one that matched the search first: "Take 5" is also "6 nimmt!" */
  alsoKnownAs: string[]
  /** `boardgame` or `boardgameexpansion` */
  type: string
  year: number | null
  /** The name searched is its name or one of the names it is known by */
  exact: boolean
  rank: number | null
  rating: number | null
  ratings: number
  weight: number | null
  weights: number
}

export type LookupSearch = {
  query: string
  /** How many items the search found: only the first twenty have their figures read */
  matched: number
  /** The exact matches first, then the best known (most ratings) */
  candidates: LookupCandidate[]
}

export type LookupRelation = { type: string; inbound: boolean; id: number; name: string }

export type LookupItem = {
  id: number
  type: string
  name: string | null
  alsoKnownAs: string[]
  year: number | null
  minPlayers: number | null
  maxPlayers: number | null
  playingTime: number | null
  minAge: number | null
  rank: number | null
  rating: number | null
  ratings: number
  weight: number | null
  weights: number
  publishers: string[]
  designers: string[]
  artists: string[]
  /**
   * The games the item comes from (`inbound`: an expansion's base game, and, taken to work the same way, the game a reimplementation reimplements) and the
   * reimplementations that came from it (not `inbound`, six at most).
   */
  relations: LookupRelation[]
  /** How many expansions it has */
  expansions: number
  /** With `--versions`: how many matched (the language filter applied), and the newest of them */
  versions?: { total: number; shown: BggVersion[] }
}

const roundedWeight = (thing: BggThing): number | null => (thing.weight === null ? null : round2(thing.weight))

function candidateOf(thing: BggThing, query: string): LookupCandidate {
  const others = thing.names.slice(1)
  const matching = others.find((other) => same(other, query))
  return {
    id: thing.id,
    name: thing.name,
    alsoKnownAs: (matching === undefined ? others : [matching, ...others.filter((other) => other !== matching)]).slice(0, LOOKUP_SHOWN),
    type: thing.type,
    year: thing.year,
    exact: thing.names.some((known) => same(known, query)),
    rank: thing.rank,
    rating: thing.rating,
    ratings: thing.ratings,
    weight: roundedWeight(thing),
    weights: thing.weights,
  }
}

/**
 * The games and the expansions of BoardGameGeek that a name matches: the exact matches, then the loose ones, their figures read for the first twenty and shown the best
 * known first. The two searches and the read are made one after the other, which the client spaces out.
 */
export async function lookupByName(client: Pick<BggClient, "search" | "things">, query: string, { limit = LOOKUP_CANDIDATES }: { limit?: number } = {}): Promise<LookupSearch> {
  const exact = await client.search(query, { exact: true, types: TYPES })
  const loose = await client.search(query, { types: TYPES })
  const ids = [...new Set([...exact, ...loose].map((found) => found.id))]
  const read = ids.slice(0, LOOKUP_READ)
  const things = await client.things(read)
  const candidates = read.flatMap((id) => {
    const thing = things.get(id)
    return thing === undefined ? [] : [candidateOf(thing, query)]
  })
  candidates.sort((a, b) => Number(b.exact) - Number(a.exact) || b.ratings - a.ratings || a.id - b.id)
  return { query, matched: ids.length, candidates: candidates.slice(0, limit) }
}

const relationOf = ({ type, inbound, id, name }: BggLink): LookupRelation => ({ type, inbound, id, name })

/**
 * One item of BoardGameGeek: its figures, its credits, what it comes from and, with `versions`, its printings (the newest first, those in `language` only when one is
 * given: a version knows the languages it is printed in). Throws when BGG has no such item.
 */
export async function lookupItem(
  client: Pick<BggClient, "detail">,
  id: number,
  { versions = false, language = null }: { versions?: boolean; language?: string | null } = {},
): Promise<LookupItem> {
  const detail = await client.detail(id, { versions })
  if (detail === null) throw new Error(`BoardGameGeek has no item ${id}`)
  const { thing, links } = detail
  const named = (type: string) => [...new Set(links.filter((link) => link.type === type).map((link) => link.name))]
  const comesFrom = links.filter((link) => link.inbound && (link.type === "boardgameexpansion" || link.type === "boardgameimplementation"))
  const cameFrom = links.filter((link) => !link.inbound && link.type === "boardgameimplementation").slice(0, LOOKUP_SHOWN)
  const item: LookupItem = {
    id: thing.id,
    type: thing.type,
    name: thing.name,
    alsoKnownAs: thing.names.slice(1, 1 + LOOKUP_SHOWN),
    year: thing.year,
    minPlayers: thing.minPlayers,
    maxPlayers: thing.maxPlayers,
    playingTime: thing.playingTime,
    minAge: thing.minAge,
    rank: thing.rank,
    rating: thing.rating,
    ratings: thing.ratings,
    weight: roundedWeight(thing),
    weights: thing.weights,
    publishers: named("boardgamepublisher"),
    designers: named("boardgamedesigner"),
    artists: named("boardgameartist"),
    relations: [...comesFrom, ...cameFrom].map(relationOf),
    expansions: links.filter((link) => link.type === "boardgameexpansion" && !link.inbound).length,
  }
  if (versions) {
    const wanted = language === null ? detail.versions : detail.versions.filter((version) => version.languages.some((known) => same(known, language)))
    wanted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.id - a.id)
    item.versions = { total: wanted.length, shown: wanted.slice(0, LOOKUP_VERSIONS) }
  }
  return item
}

/** A wrong command line: reported with a hint, not with a stack trace. */
export class UsageError extends Error {}

export type LookupArgs = { help: boolean; name: string; id: number | null; versions: boolean; language: string | null; limit: number }

export const LOOKUP_HELP = `What BoardGameGeek says of a game, as JSON, for the scout (GAM-32). Read only: nothing is written anywhere.

Usage: pnpm --filter @pbgo/platform content:bgg-lookup "<name>" [--limit <n>]
       pnpm --filter @pbgo/platform content:bgg-lookup --id <n> [--versions [--language <language>]]

  "<name>"       Search the games and the expansions of that name: the exact matches first, then the best known, each with its rank, its rating, how many rated it, its
                 weight (complexity, 1 to 5) and its type. The first twenty matches are read.
  --limit <n>    How many candidates to show, 1 to ${LOOKUP_READ} (default ${LOOKUP_CANDIDATES}).
  --id <n>       One item in full: its figures, its publishers, designers and artists, the game it comes from (an expansion's base game, what a reimplementation
                 reimplements) and how many expansions it has.
  --versions     With --id: its versions (publisher, year, languages, code on the box), the newest first, ${LOOKUP_VERSIONS} at most.
  --language <l> With --versions: only the versions printed in that language ("English").
  --             What follows is the name, even when it starts with a dash.
  --help, -h     This text

The token is BGG_API_TOKEN, in the environment, else in apps/web/.env.local (the pnpm script loads that file). It is never printed.
BoardGameGeek's terms apply to what is read: show "Powered by BGG" next to the figures, unaltered, and no commercial use without their licence.`

/** The options of the command line: a name or an id, never both. A value is `--flag value` or `--flag=value`; a lone `--` makes what follows the name, a lone `-` is a word of it. */
export function parseLookupArgs(argv: readonly string[]): LookupArgs {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options: LookupArgs = { help: false, name: "", id: null, versions: false, language: null, limit: LOOKUP_CANDIDATES }
  const words: string[] = []
  // What is wrong is told once the whole line is read, unless --help is there
  const wrong: string[] = []
  let limitGiven = false
  let literal = false
  let at = 0
  /** The value of a flag: what follows its equals sign, else the next argument (which is not another flag). */
  const valueOf = (flag: string, inline: string | undefined): string | null => {
    const next = args[at + 1]
    const found = inline ?? (next !== undefined && !next.startsWith("-") ? next : undefined)
    if (found === undefined || found.trim() === "") {
      wrong.push(`${flag} needs a value`)
      return null
    }
    if (inline === undefined) at += 1
    return found.trim()
  }
  for (; at < args.length; at += 1) {
    const arg = args[at] ?? ""
    if (literal || arg === "-") {
      words.push(arg)
      continue
    }
    if (arg === "--") {
      literal = true
      continue
    }
    const [flag = "", inline] = arg.startsWith("--") ? arg.split(/=(.*)/s, 2) : [arg]
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--versions") options.versions = true
    else if (flag === "--id") {
      const text = valueOf(flag, inline)
      if (text === null) continue
      if (/^[1-9]\d{0,8}$/.test(text)) options.id = Number.parseInt(text, 10)
      else wrong.push(`--id is the number of an item of BoardGameGeek, got "${text}"`)
    } else if (flag === "--language") options.language = valueOf(flag, inline)
    else if (flag === "--limit") {
      const text = valueOf(flag, inline)
      if (text === null) continue
      const number = /^\d+$/.test(text) ? Number.parseInt(text, 10) : 0
      if (number < 1 || number > LOOKUP_READ) wrong.push(`--limit is a number from 1 to ${LOOKUP_READ}, got "${text}"`)
      else {
        options.limit = number
        limitGiven = true
      }
    } else if (arg.startsWith("-")) wrong.push(`Unknown option ${arg}`)
    else words.push(arg)
  }
  options.name = words.join(" ").trim()
  if (options.help) return options
  const first = wrong[0]
  if (first !== undefined) throw new UsageError(first)
  if (options.name === "" && options.id === null) throw new UsageError("Give the name of a game, or --id and the number of an item")
  if (options.name !== "" && options.id !== null) throw new UsageError("A name and --id exclude each other")
  if ((options.versions || options.language !== null) && options.id === null) throw new UsageError("--versions and --language are for one item: give --id")
  if (options.language !== null && !options.versions) throw new UsageError("--language filters the versions: give --versions too")
  if (limitGiven && options.id !== null) throw new UsageError("--limit is for a search by name")
  return options
}

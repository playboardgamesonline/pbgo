// The file the scout leaves for the rest of the pipeline (GAM-32, `.claude/skills/game-scout`): which game it is, which edition, what BoardGameGeek says of it and what the catalog could
// say, in one JSON file that the skill `platform-catalog-entry` and `pnpm add-game` read. The one definition of its shape: the skill writes it, `pnpm check:scout` judges it with
// `scoutProblems` (and, with `--online`, with `stateProblems`), and the readers rely on it. Pure and made of what Node strips as it is (type stripping), like `slug.ts` that it builds on,
// so that the test and the scripts cannot disagree.
import { cleanName, nameProblem, slugFromName, slugProblem } from "./slug.ts"

/** The version of the shape. A reader written for one refuses the others: a new shape is a new version. */
export const SCOUT_VERSION = 1

/**
 * What the game is to the platform: `base-game`, a game of its own (a `game` of the catalog of kind game); `expansion`, which needs another game to be played (an `expansion`
 * document); `reimplementation`, a game of its own that rebuilds or extends another one and plays alone (a `game` of kind reimplementation).
 */
export const SCOUT_TYPES = ["base-game", "expansion", "reimplementation"] as const
export type ScoutType = (typeof SCOUT_TYPES)[number]

/** How sure the scout is that the edition is the one meant. */
export const SCOUT_CONFIDENCE = ["high", "medium", "low"] as const
export type ScoutConfidence = (typeof SCOUT_CONFIDENCE)[number]

/** What BoardGameGeek calls the item. */
export const BGG_TYPES = ["boardgame", "boardgameexpansion"] as const
export type BggType = (typeof BGG_TYPES)[number]

/** What the platform's catalog held when the game was scouted: nothing, or a published entry (a draft is not visible from outside the Studio). */
export const EXISTING_CATALOG = ["none", "published"] as const
export type ExistingCatalog = (typeof EXISTING_CATALOG)[number]

/** A game of the platform's catalog, by its slug and its name. */
export type ScoutBaseGame = { slug: string; name: string }

/** What the scout thinks the game may be instead of a base game, with the game it comes from. */
export type ScoutSuggestion = { type: Exclude<ScoutType, "base-game">; baseGame: ScoutBaseGame; why: string }

/** The rulebook the engine will implement: its language, its address, and the version and the date it prints (null when it prints none). Dates are `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
export type ScoutRules = { language: string; url: string; version: string | null; date: string | null }

/** The one edition scouted: the publisher and the year of that edition (not of the first release) and its reference rulebook. */
export type ScoutEdition = { publisher: string; year: number; label: string | null; bggVersionId: number | null; rules: ScoutRules | null; confidence: ScoutConfidence }

/** What BoardGameGeek says of the item, as it says it (the weight rounded to two decimals): the rank, the rating and how many rated are the popularity, the weight and how many weighed the complexity. */
export type ScoutBgg = { id: number; type: BggType; year: number | null; rank: number | null; rating: number | null; ratings: number; weight: number | null; weights: number }

/** What the catalog could say, with the names and the units of the fields of the Studio: a maximum of players of null is "or more", the duration is in minutes, the complexity is 1 to 5. */
export type ScoutFacts = { playersMin: number | null; playersMax: number | null; duration: number | null; minAge: number | null; complexity: number | null }

export type ScoutSource = { label: string; url: string }

export type Scout = {
  version: typeof SCOUT_VERSION
  /** The day it was scouted, `YYYY-MM-DD` */
  scoutedAt: string
  /** The name of the game as its English edition prints it */
  name: string
  slug: string
  type: ScoutType
  /** The game it comes from: null for a base game, a published game of the catalog for the others */
  baseGame: ScoutBaseGame | null
  suggestion: ScoutSuggestion | null
  edition: ScoutEdition
  bgg: ScoutBgg | null
  facts: ScoutFacts
  existing: { catalog: ExistingCatalog }
  notes: string[]
  sources: ScoutSource[]
}

const KEYS = ["version", "scoutedAt", "name", "slug", "type", "baseGame", "suggestion", "edition", "bgg", "facts", "existing", "notes", "sources"]
const EDITION_KEYS = ["publisher", "year", "label", "bggVersionId", "rules", "confidence"]
const RULES_KEYS = ["language", "url", "version", "date"]
const BGG_KEYS = ["id", "type", "year", "rank", "rating", "ratings", "weight", "weights"]
const FACTS_KEYS = ["playersMin", "playersMax", "duration", "minAge", "complexity"]

/** The most a text may hold, by what it is. */
const MAX = { publisher: 120, label: 80, version: 40, why: 300, note: 400, sourceLabel: 80, url: 2048 }
const MAX_NOTES = 20
const MAX_SOURCES = 30
/** The first year of a game that BoardGameGeek has, and how far ahead a game can be announced. */
const FIRST_YEAR = 1800
const YEARS_AHEAD = 3
const MAX_PLAYERS = 100
const MAX_MINUTES = 24 * 60

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const show = (value: unknown): string => (typeof value === "string" ? JSON.stringify(value.length > 60 ? `${value.slice(0, 57)}...` : value) : (JSON.stringify(value) ?? String(value)))

/** A check of one value: what is wrong with it, or `undefined`. */
type Check = (value: unknown) => string | undefined

/** What is wrong with a text, or `undefined`: some text, as long as it may be, trimmed, one line with nothing a terminal would obey in it. */
function textProblem(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return `${show(value)} is not text`
  if (value === "") return "is empty"
  if (value !== value.trim()) return "has spaces around it"
  if (/\p{Cc}/u.test(value)) return "has a control character: it is one line of printable text"
  const length = [...value].length
  return length > max ? `is ${length} characters long, ${max} at most` : undefined
}

function integerProblem(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): string | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return `${show(value)} is not a whole number`
  if (value < min) return `${value} is under ${min}`
  return value > max ? `${value} is over ${max}` : undefined
}

/** A number from `min` to `max`, with at most `decimals` decimals when that is asked for. */
function numberProblem(value: unknown, min: number, max: number, decimals?: number): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return `${show(value)} is not a number`
  if (value < min) return `${value} is under ${min}`
  if (value > max) return `${value} is over ${max}`
  if (decimals === undefined) return undefined
  return Math.round(value * 10 ** decimals) / 10 ** decimals === value ? undefined : `${value} has more than ${decimals} decimals`
}

/** An address that opens a page for anybody: https, a host, no credentials, no space. */
function urlProblem(value: unknown): string | undefined {
  const problem = textProblem(value, MAX.url)
  if (problem !== undefined) return problem
  const text = value as string
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return `${show(text)} is not an address`
  }
  if (url.protocol !== "https:" || url.hostname === "") return `${show(text)} is not an https address`
  return url.username !== "" || url.password !== "" || /\s/.test(text) ? `${show(text)} has credentials or a space in it` : undefined
}

/** A day of the calendar, `YYYY-MM-DD`; with `partial` a year (`YYYY`) or a month (`YYYY-MM`) too. */
function dateProblem(value: unknown, partial = false): string | undefined {
  const found = typeof value === "string" ? /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value) : null
  if (found === null || (!partial && found[3] === undefined)) return `${show(value)} is not a date (${partial ? "YYYY, YYYY-MM or YYYY-MM-DD" : "YYYY-MM-DD"})`
  const year = Number(found[1])
  const month = found[2] === undefined ? 1 : Number(found[2])
  const day = found[3] === undefined ? 1 : Number(found[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? undefined : `${show(value)} is not a day of the calendar`
}

const oneOf =
  (choices: readonly string[]): Check =>
  (value) =>
    typeof value === "string" && choices.includes(value) ? undefined : `${show(value)} is not one of ${choices.join(", ")}`

/** A check that lets null through: the key is there and it is not known. */
const orNull =
  (check: Check): Check =>
  (value) =>
    value === null ? undefined : check(value)

const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const languageProblem: Check = (value) => (typeof value === "string" && LANGUAGE.test(value) ? undefined : `${show(value)} is not a language code (en, fr, en-GB)`)
const yearProblem: Check = (value) => integerProblem(value, FIRST_YEAR, new Date().getFullYear() + YEARS_AHEAD)

/**
 * What is wrong with a scout file, in sentences that start with the key they are about (`edition.year: …`); an empty list is a file the readers can rely on. It judges the shape, the
 * slug and the name by the rules of `slug.ts`, and one key against another; what it cannot know, whether the game is already in the repo or in the catalog, is `stateProblems`'s. A file
 * that is not an object, or of another version, is not judged any further.
 */
export function scoutProblems(data: unknown): string[] {
  if (!isRecord(data)) return ["The file is not a JSON object"]
  if (data.version !== SCOUT_VERSION) return [`version: ${show(data.version)} is not the version this reader knows (${SCOUT_VERSION})`]

  const problems: string[] = []
  const report = (where: string, problem: string | undefined) => {
    if (problem !== undefined) problems.push(`${where}: ${problem}`)
  }
  /** Every key there, and no other: a typo or a newer shape is told, not read past. */
  const keysOf = (value: Record<string, unknown>, keys: readonly string[], where: string) => {
    const prefix = where === "" ? "" : `${where}.`
    for (const key of keys) if (!(key in value)) problems.push(`${prefix}${key}: is missing (every key is there, null when it is not known)`)
    for (const key of Object.keys(value)) if (!keys.includes(key)) problems.push(`${prefix}${key}: is not a key of a scout file`)
  }
  /** One key of an object, judged if it is there (a key that is missing has been told). */
  const check = (value: Record<string, unknown>, key: string, where: string, problem: Check) => {
    if (key in value) report(where === "" ? key : `${where}.${key}`, problem(value[key]))
  }
  /** An object with exactly these keys, or null when it is not an object (told) or is missing. */
  const objectOf = (value: Record<string, unknown>, key: string, where: string, keys: readonly string[], what: string): Record<string, unknown> | null => {
    if (!(key in value)) return null
    const object = value[key]
    if (!isRecord(object)) {
      report(where, `is not ${what}`)
      return null
    }
    keysOf(object, keys, where)
    return object
  }
  /** The game that a key holds, a slug and a name, whatever else is wrong with it. */
  const baseGameOf = (value: Record<string, unknown>, key: string, where: string): ScoutBaseGame | null => {
    const object = objectOf(value, key, where, ["slug", "name"], "an object with a slug and a name")
    if (object === null) return null
    check(object, "slug", where, (slug) => (typeof slug === "string" ? slugProblem(slug) : `${show(slug)} is not text`))
    check(object, "name", where, (name) => (typeof name !== "string" ? `${show(name)} is not text` : name === cleanName(name) ? nameProblem(name) : "has spaces around it or twice in a row"))
    return typeof object.slug === "string" && typeof object.name === "string" ? { slug: object.slug, name: object.name } : null
  }

  keysOf(data, KEYS, "")
  check(data, "scoutedAt", "", (value) => dateProblem(value))
  check(data, "type", "", oneOf(SCOUT_TYPES))
  const type = SCOUT_TYPES.find((one) => one === data.type)
  check(data, "name", "", (name) => (typeof name !== "string" ? `${show(name)} is not text` : name === cleanName(name) ? nameProblem(name) : "has spaces around it or twice in a row"))
  check(data, "slug", "", (slug) => (typeof slug === "string" ? slugProblem(slug, [], type === "expansion" ? "expansion" : "game") : `${show(slug)} is not text`))

  // The game it comes from: none for a base game, one for the others
  const base = data.baseGame === null ? null : baseGameOf(data, "baseGame", "baseGame")
  if ("baseGame" in data) {
    if (type === "base-game" && data.baseGame !== null) report("baseGame", "a base game comes from no game: it is null")
    if (type !== undefined && type !== "base-game" && data.baseGame === null) report("baseGame", `${type === "expansion" ? "an expansion" : "a reimplementation"} comes from a game of the catalog: it is not null`)
  }
  if (base !== null && base.slug === data.slug) report("baseGame.slug", "a game is not its own base game")
  if (type === "expansion" && base !== null && typeof data.slug === "string" && !data.slug.startsWith(`${base.slug}-`)) report("slug", `an expansion's slug starts with its base game's ("${base.slug}-…")`)

  // What it may be instead
  if ("suggestion" in data && data.suggestion !== null) {
    const suggestion = objectOf(data, "suggestion", "suggestion", ["type", "baseGame", "why"], "null nor an object with a type, a baseGame and a why")
    if (suggestion !== null) {
      check(suggestion, "type", "suggestion", oneOf(["expansion", "reimplementation"]))
      const suggested = baseGameOf(suggestion, "baseGame", "suggestion.baseGame")
      check(suggestion, "why", "suggestion", (why) => textProblem(why, MAX.why))
      if (suggested !== null && suggestion.type === type && suggested.slug === base?.slug) report("suggestion", "repeats what type and baseGame already say: it is null once it is taken")
    }
  }

  // The edition
  const edition = objectOf(data, "edition", "edition", EDITION_KEYS, "an object")
  if (edition !== null) {
    check(edition, "publisher", "edition", (value) => textProblem(value, MAX.publisher))
    check(edition, "year", "edition", yearProblem)
    check(edition, "label", "edition", orNull((value) => textProblem(value, MAX.label)))
    check(edition, "bggVersionId", "edition", orNull((value) => integerProblem(value, 1)))
    check(edition, "confidence", "edition", oneOf(SCOUT_CONFIDENCE))
    if (edition.rules !== null) {
      const rules = objectOf(edition, "rules", "edition.rules", RULES_KEYS, "null nor an object with a language, a url, a version and a date")
      if (rules !== null) {
        check(rules, "language", "edition.rules", languageProblem)
        check(rules, "url", "edition.rules", urlProblem)
        check(rules, "version", "edition.rules", orNull((value) => textProblem(value, MAX.version)))
        check(rules, "date", "edition.rules", orNull((value) => dateProblem(value, true)))
      }
    }
  }

  // What BoardGameGeek says
  if ("bgg" in data && data.bgg !== null) {
    const bgg = objectOf(data, "bgg", "bgg", BGG_KEYS, "null nor an object")
    if (bgg !== null) {
      check(bgg, "id", "bgg", (value) => integerProblem(value, 1))
      check(bgg, "type", "bgg", oneOf(BGG_TYPES))
      check(bgg, "year", "bgg", orNull(yearProblem))
      check(bgg, "rank", "bgg", orNull((value) => integerProblem(value, 1)))
      check(bgg, "rating", "bgg", orNull((value) => numberProblem(value, 1, 10)))
      check(bgg, "ratings", "bgg", (value) => integerProblem(value, 0))
      check(bgg, "weight", "bgg", orNull((value) => numberProblem(value, 1, 5, 2)))
      check(bgg, "weights", "bgg", (value) => integerProblem(value, 0))
    }
  }

  // What the catalog could say
  const facts = objectOf(data, "facts", "facts", FACTS_KEYS, "an object")
  if (facts !== null) {
    check(facts, "playersMin", "facts", orNull((value) => integerProblem(value, 1, MAX_PLAYERS)))
    check(facts, "playersMax", "facts", orNull((value) => integerProblem(value, 1, MAX_PLAYERS)))
    if (typeof facts.playersMin === "number" && typeof facts.playersMax === "number" && facts.playersMax < facts.playersMin) report("facts.playersMax", `${facts.playersMax} is under the minimum, ${facts.playersMin}`)
    check(facts, "duration", "facts", orNull((value) => integerProblem(value, 1, MAX_MINUTES)))
    check(facts, "minAge", "facts", orNull((value) => integerProblem(value, 1, 99)))
    check(facts, "complexity", "facts", orNull((value) => numberProblem(value, 1, 5, 2)))
  }

  const existing = objectOf(data, "existing", "existing", ["catalog"], "an object with a catalog")
  if (existing !== null) check(existing, "catalog", "existing", oneOf(EXISTING_CATALOG))

  if ("notes" in data) {
    if (!Array.isArray(data.notes)) report("notes", "is not a list")
    else {
      if (data.notes.length > MAX_NOTES) report("notes", `holds ${data.notes.length} notes, ${MAX_NOTES} at most`)
      data.notes.forEach((note: unknown, index) => report(`notes[${index}]`, textProblem(note, MAX.note)))
    }
  }

  // Where the edition was read: at least one, so that it can be checked
  if ("sources" in data) {
    if (!Array.isArray(data.sources)) report("sources", "is not a list")
    else {
      if (data.sources.length === 0) report("sources", "is empty: say where the edition was read")
      if (data.sources.length > MAX_SOURCES) report("sources", `holds ${data.sources.length} sources, ${MAX_SOURCES} at most`)
      data.sources.forEach((source: unknown, index) => {
        const where = `sources[${index}]`
        if (!isRecord(source)) {
          report(where, "is not an object with a label and a url")
          return
        }
        keysOf(source, ["label", "url"], where)
        check(source, "label", where, (value) => textProblem(value, MAX.sourceLabel))
        check(source, "url", where, urlProblem)
      })
    }
  }

  return problems
}

/** A scout file read from its text: the file when it is sound, else null and what is wrong with it. */
export function readScout(text: string): { scout: Scout | null; problems: string[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    return { scout: null, problems: [`The file is not JSON (${error instanceof Error ? error.message : "unreadable"})`] }
  }
  const problems = scoutProblems(data)
  return { scout: problems.length === 0 ? (data as Scout) : null, problems }
}

/** A game of the platform's catalog, as far as the scout needs it. `kind` is null for an expansion. */
export type ScoutCatalogEntry = { slug: string; name: string; bggId: number | null; kind: "game" | "reimplementation" | null }

/** What exists when a game is scouted: the games of the registry (a folder each) and the published documents of the platform's Sanity project, read from outside by `pnpm check:scout --online`. */
export type ScoutState = {
  registry: readonly string[]
  games: readonly ScoutCatalogEntry[]
  expansions: readonly (ScoutCatalogEntry & { baseGame: string | null })[]
}

const TYPE_WORDS: Record<ScoutType, string> = { "base-game": "a base game", expansion: "an expansion", reimplementation: "a reimplementation" }

/**
 * What is wrong with a sound scout file against what exists: a game that already has its folder, an `existing.catalog` that is not what the catalog holds, a game that the catalog
 * already has under another slug or as another type (one game has one entry), a base game that is not published. It is the state at the time of the scout: a file kept after the entry
 * was made says "none" no more, and is not judged again.
 */
export function stateProblems(scout: Scout, state: ScoutState): string[] {
  const problems: string[] = []
  const kind = scout.type === "expansion" ? "expansion" : "game"
  const there = (kind === "expansion" ? state.expansions : state.games).find((entry) => entry.slug === scout.slug)

  if (state.registry.includes(scout.slug)) problems.push(`slug: "${scout.slug}" is already a game of the site (games/${scout.slug}): scouting is for a game that is not built yet`)

  if (scout.existing.catalog === "published" && there === undefined) problems.push(`existing.catalog: says "published", but the catalog has no published ${kind} "${scout.slug}"`)
  if (scout.existing.catalog === "none" && there !== undefined) problems.push(`existing.catalog: says "none", but the catalog has published the ${kind} "${scout.slug}"`)
  // A game and a reimplementation are both games of the catalog, told apart by their kind
  if (there !== undefined && there.kind !== null && (there.kind === "reimplementation") !== (scout.type === "reimplementation")) {
    problems.push(`type: the catalog has "${scout.slug}" as ${TYPE_WORDS[there.kind === "game" ? "base-game" : "reimplementation"]}, not as ${TYPE_WORDS[scout.type]}`)
  }

  // The same game under another slug, or in the other type: one game has one entry, with its slug and its type
  const key = slugFromName(scout.name)
  for (const [type, list] of [["game", state.games], ["expansion", state.expansions]] as const) {
    for (const entry of list) {
      if (type === kind && entry.slug === scout.slug) continue
      const same = [
        scout.bgg !== null && entry.bggId === scout.bgg.id ? "the same BoardGameGeek item" : "",
        key !== "" && slugFromName(entry.name) === key ? "the same name" : "",
        entry.slug === scout.slug ? "the same slug" : "",
      ].filter(Boolean)
      if (same.length > 0) problems.push(`slug: the catalog already has this game as the ${type} "${entry.slug}" (${same.join(", ")}): one game has one entry, with its slug and its type`)
    }
  }

  // A base game comes first: the entry of an expansion or a reimplementation points at a published game
  for (const [where, base] of [["baseGame", scout.baseGame], ["suggestion.baseGame", scout.suggestion?.baseGame ?? null]] as const) {
    if (base === null) continue
    const entry = state.games.find((game) => game.slug === base.slug)
    if (entry === undefined) problems.push(`${where}: "${base.slug}" is not a published game of the catalog: its entry comes first`)
    else if (cleanName(entry.name) !== base.name) problems.push(`${where}.name: "${base.name}" is not the name that the catalog gives "${base.slug}" ("${entry.name}")`)
  }
  return problems
}

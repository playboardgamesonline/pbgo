import { nameProblem, slugProblem } from "@pbgo/games/slug"
import { DEFAULT_PLATFORM_LANGUAGE, DESCRIPTION_MAX, PLATFORM_LANGUAGES } from "@pbgo/studio-kit/constants"
import type { Path, ValidationContext } from "sanity"

// The validations the types share. A custom rule answers `true` for what it accepts, or the sentence the editor reads.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The targets of a reference or of a list of references. */
const refsOf = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).flatMap((item) => (isRecord(item) && typeof item._ref === "string" ? item._ref : []))

/** The published id of a document: the Studio hands a draft's id, which starts with `drafts.`. */
const publishedId = (id: string | undefined) => id?.replace(/^drafts\./, "")

/** A name is one line of printable text, 60 characters at most (the hub prints it). */
export const checkName = (name: string | undefined): true | string => (name === undefined ? true : (nameProblem(name) ?? true))

/** A slug is what a game's slug can be: a page of the hub, and a route of the site once the game is live. The uniqueness is the slug field's own. */
export const checkSlug = (slug: { current?: string } | undefined): true | string => (slug?.current === undefined ? true : (slugProblem(slug.current) ?? true))

/** An expansion's slug is a game's but for its length: it names no package, token or Studio host, and starts with its base game's slug, so it may be longer (`MAX_EXPANSION_SLUG_LENGTH`). The uniqueness is the slug field's own. */
export const checkExpansionSlug = (slug: { current?: string } | undefined): true | string => (slug?.current === undefined ? true : (slugProblem(slug.current, [], "expansion") ?? true))

/** A game is not its own base game, nor related to itself. The document is not there when a seed checks the rule: nothing to compare with. */
export const checkNotItself =
  (message: string) =>
  (value: unknown, context: ValidationContext): true | string => {
    const own = publishedId(context.document?._id)
    return own !== undefined && refsOf(value).includes(own) ? message : true
  }

/** A creator is on one line of a game, with all their roles: two lines would say the same person twice. */
export const checkCreatorsOnce = (lines: unknown): true | string => {
  const people = (Array.isArray(lines) ? lines : []).flatMap((line) => (isRecord(line) ? refsOf(line.creator) : []))
  return new Set(people).size === people.length ? true : "A creator is on one line: give them all their roles there"
}

/** The key of a helper is what the game calls it: lowercase letters and digits, joined by single dashes, 40 characters at most. */
export const checkHelperKey = (key: string | undefined): true | string =>
  key === undefined || (key.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) ? true : "Lowercase letters and digits joined by single dashes, 40 characters at most (for instance: show-score)"

/** A key names one helper of a game: two with the same key would be one aid twice. */
export const checkHelpersOnce = (helpers: unknown): true | string => {
  const keys = (Array.isArray(helpers) ? helpers : []).flatMap((helper) => (isRecord(helper) && typeof helper.key === "string" ? helper.key : []))
  return new Set(keys).size === keys.length ? true : "A key names one helper: give each its own"
}

/** The most players is not under the fewest (a game with no most is "or more"). The document is not there when a seed checks the rule. */
export const checkPlayersMax = (max: number | undefined, context: ValidationContext): true | string => {
  const min = context.document?.playersMin
  return max !== undefined && typeof min === "number" && max < min ? "The maximum is under the minimum" : true
}

/** A message that is shown for a while ends after it starts. The document is not there when a seed checks the rule. */
export const checkEndsAfterStart = (endsAt: string | undefined, context: ValidationContext): true | string => {
  const startsAt = context.document?.startsAt
  return endsAt !== undefined && typeof startsAt === "string" && Date.parse(endsAt) <= Date.parse(startsAt) ? "It ends before it starts" : true
}

// The translated fields (PLT-104) are arrays of rows `{ _key, language, value }`, one row per language. Nothing is required of them: a game
// may have no description yet. What the Studio asks is that English, the language every other one falls back on, is never missing
// where another language is there.
//
// A field's own `validation` replaces the one of its type, and the type of a translated field is made by the plugin, which checks the
// languages of the rows in its own: so these rules do it too (`checkRows`), as the plugin does.

type Row = Record<string, unknown>

const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRecord) : [])

const LANGUAGE_IDS: ReadonlySet<string> = new Set(PLATFORM_LANGUAGES.map((language) => language.id))

/** Does a translation hold something: a text that is not blank, a picture that has its file. A row can be there with nothing in it, the row of English that every translated field has. */
export const isFilled = (value: unknown): boolean =>
  typeof value === "string" ? value.trim() !== "" : isRecord(value) && isRecord(value.asset) && typeof value.asset._ref === "string" && value.asset._ref !== ""

/** What a rule of a translated field answers when it refuses: a sentence, and the place it is about (the row of this key, or its value). */
type Refusal = { message: string; paths: Path[] }

const rowAt = (row: Row): Path => [{ _key: String(row._key) }]
const valueAt = (row: Row): Path => [...rowAt(row), "value"]

/** The rows are of languages of the platform, one row for each. */
export const checkRows = (value: unknown): true | Refusal => {
  const seen = new Set<string>()
  for (const row of rowsOf(value)) {
    const language = typeof row.language === "string" ? row.language : ""
    if (!LANGUAGE_IDS.has(language)) return { message: language ? `"${language}" is not a language of the platform` : "A row has no language", paths: [rowAt(row)] }
    if (seen.has(language)) return { message: "There can only be one row per language", paths: [rowAt(row)] }
    seen.add(language)
  }
  return true
}

/** The rows are right, and a language has a value only if English has one too: it is what the others fall back on. A field with no value at all, or only English, is fine. */
export const checkTranslations = (value: unknown): true | Refusal => {
  const wrong = checkRows(value)
  if (wrong !== true) return wrong
  const rows = rowsOf(value)
  const filled = rows.filter((row) => isFilled(row.value))
  if (filled.length === 0 || filled.some((row) => row.language === DEFAULT_PLATFORM_LANGUAGE)) return true
  const english = rows.find((row) => row.language === DEFAULT_PLATFORM_LANGUAGE)
  return { message: "Fill English (US) first: it is what every other language falls back on", paths: [valueAt(english ?? filled[0] ?? {})] }
}

/**
 * The descriptions of a document: the translations are right, and no language has a description over `DESCRIPTION_MAX` characters. The
 * refusal is about the value of the row that is too long. The rule is the field's, not a `max()` on the type of the value: the plugin hands
 * the rules of that type to the row too, an object, and a length would measure the object.
 */
export const checkDescriptions = (value: unknown): true | Refusal => {
  const wrong = checkTranslations(value)
  if (wrong !== true) return wrong
  const long = rowsOf(value).find((row) => typeof row.value === "string" && row.value.length > DESCRIPTION_MAX)
  return long ? { message: `A description is ${DESCRIPTION_MAX} characters at most (this one has ${String(long.value).length})`, paths: [valueAt(long)] } : true
}

/** The names of a document: the rows are right, and the name in English is the `name` of the document, so its row stays empty: there would be two English names to disagree. */
export const checkNameTranslations = (value: unknown): true | Refusal => {
  const wrong = checkRows(value)
  if (wrong !== true) return wrong
  const english = rowsOf(value).find((row) => row.language === DEFAULT_PLATFORM_LANGUAGE && isFilled(row.value))
  return english ? { message: "English (US) is the Name above: leave this row empty", paths: [valueAt(english)] } : true
}

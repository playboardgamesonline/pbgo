import { nameProblem, slugProblem } from "@pbgo/games/slug"
import type { ValidationContext } from "sanity"

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

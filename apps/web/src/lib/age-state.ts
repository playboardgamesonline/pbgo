import "server-only"
import type { Account, AgeRefusal } from "@pbgo/accounts"
import { ageRulesOf } from "@pbgo/catalog/server"
import { NO_AGE_STATES, ageStatesFor, hasAgeRules, type AgeStates } from "@pbgo/core/lib/age-rules"
import { ageSubjectOf } from "@pbgo/core/server/age-gate"
import { actorOf } from "@pbgo/core/server/profile"
import type { Expansion } from "./game-activity"

// What a visitor has to do to take part in the games and expansions that ask for an age (PLT-125), for the pages to say before the visitor asks: a lock on an expansion, a message on a button. The server decides all the same, on its own, when they ask
// (`@pbgo/core/server/age-gate`): this is only what the page tells. A game that asks for no age costs no lookup, and the date of the visitor is read once for all the games a page draws.

/**
 * What each of these games asks of the visitor, by slug: for each, what they do not meet (`AgeStates`). The visitor is a guest (null), the demo account of development (an adult) or a member, whose date of birth is read when one of the games asks for an age.
 * A date that cannot be read is told as not declared (the page asks for it, and the server answers for itself): a page does not fall for a database that is not ready.
 */
export async function ageStatesOf(slugs: readonly string[], account: Pick<Account, "id"> | null): Promise<Map<string, AgeStates>> {
  const rules = await Promise.all(slugs.map(async (slug) => [slug, await ageRulesOf(slug)] as const))
  if (!rules.some(([, ruled]) => hasAgeRules(ruled))) return new Map(slugs.map((slug) => [slug, NO_AGE_STATES]))
  const actor = actorOf(account)
  const subject = await ageSubjectOf(actor).catch((error) => {
    console.error("The date of birth of a visitor could not be read, the page asks for it", error)
    return { kind: "member", birthdate: null } as const
  })
  const now = new Date()
  return new Map(rules.map(([slug, ruled]) => [slug, hasAgeRules(ruled) ? ageStatesFor(ruled, subject, now) : NO_AGE_STATES]))
}

/** What the game asks of the visitor: see `ageStatesOf`. */
export async function ageStatesOfGame(slug: string, account: Pick<Account, "id"> | null): Promise<AgeStates> {
  return (await ageStatesOf([slug], account)).get(slug) ?? NO_AGE_STATES
}

/** What a card says of an expansion the visitor cannot choose, by why, in a few words (the card has its age among the figures already: "Ages 18+"). */
const REASONS: Record<AgeRefusal, string> = {
  "sign-in": "Sign in to play it",
  date: "Add your date of birth to play it",
  "too-young": "Not available at your age",
}

/** The expansions of a game, with a lock on the ones the visitor cannot choose (`Expansion.locked`): the card says why, and a press on it is handed to the page. */
export function lockedExpansions(expansions: readonly Expansion[], states: AgeStates): Expansion[] {
  return expansions.map((expansion) => {
    const state = states.expansions[expansion.id]
    return state ? { ...expansion, locked: { reason: REASONS[state.refusal], kind: state.refusal } } : expansion
  })
}

// What the Studio says about the age that a game and its expansions ask, and the age that a table asks of everybody who sits at it (PLT-125). Pure: the server that decides and the pages that say what is needed read it the same way. The age of a
// member against that age is `ageRefusal` of `@pbgo/accounts`; where the numbers come from is `@pbgo/catalog` (the Studio's "Minimum age" of a game and of an expansion), which core never reads: the app hands the rules in (`AgeRulesSource`).

import { ageRefusal, restrictedAge, type AgeRefusal, type AgeSubject } from "@pbgo/accounts"
import type { OptionValues } from "@pbgo/engine-kit"

/**
 * The minimum ages of one game, as its game and its expansions say them in the platform's Sanity project: the game's (null when it says none) and, for each expansion that has an age of its own, that age under the id a table calls the expansion
 * by, its slug, which is also the key of the engine option that switches it on (`engineOptionsOf`). An expansion with no age of its own is played at its game's: it has no entry. The numbers are the Studio's as they are; which of them the platform
 * enforces is `restrictedAge`.
 */
export type AgeRules = { game: number | null; expansions: Readonly<Record<string, number>> }

/** Where the age rules of a game come from. The app gives it (the catalog): core never reads the hub's catalog, which depends on core. */
export type AgeRulesSource = (slug: string) => Promise<AgeRules>

/** A game that asks for no age, and has no expansion that does. */
export const NO_AGE_RULES: AgeRules = { game: null, expansions: {} }

/** Whether the game, or one of its expansions, asks for an age the platform enforces: when none does, nobody's age is looked up. */
export function hasAgeRules(rules: AgeRules): boolean {
  return restrictedAge(rules.game) !== null || Object.values(rules.expansions).some((age) => restrictedAge(age) !== null)
}

/**
 * The age that a table asks of everybody who sits at it: the highest of the ages the platform enforces among its game and the expansions its options switch on, null when none is enforced. An expansion for adults played with a game for everybody
 * makes the table a table for adults.
 */
export function tableAge(rules: AgeRules, options: Readonly<OptionValues>): number | null {
  let age = restrictedAge(rules.game)
  for (const [id, minAge] of Object.entries(rules.expansions)) {
    if (options[id] !== true) continue
    const own = restrictedAge(minAge)
    if (own !== null && (age === null || own > age)) age = own
  }
  return age
}

/** What a person has to do to take part in something that asks for `age` years: the refusal they would get, and the age asked. */
export type AgeState = { age: number; refusal: AgeRefusal }

/**
 * What a person has to do for each thing of one game that asks for an age, only for the ones they do not meet: the game itself (null when it asks none, or they meet it) and, by id, the expansions. The page uses it to say what is needed before the person asks
 * (a lock on an expansion, a message on a button); the server decides all the same, on its own, when they ask (`server/age-gate.ts`). An expansion with no age of its own is played at its game's, which `game` covers.
 */
export type AgeStates = { game: AgeState | null; expansions: Readonly<Record<string, AgeState>> }

/** Nothing to do: the game asks for no age, or the person meets all of them. */
export const NO_AGE_STATES: AgeStates = { game: null, expansions: {} }

/** The states of a game's rules for a person, counted at the instant `now`. */
export function ageStatesFor(rules: AgeRules, subject: AgeSubject, now: Date): AgeStates {
  const stateOf = (minAge: number | null | undefined): AgeState | null => {
    const age = restrictedAge(minAge)
    const refusal = age === null ? null : ageRefusal(age, subject, now)
    return age !== null && refusal !== null ? { age, refusal } : null
  }
  const expansions: Record<string, AgeState> = {}
  for (const [id, minAge] of Object.entries(rules.expansions)) {
    const state = stateOf(minAge)
    if (state) expansions[id] = state
  }
  return { game: stateOf(rules.game), expansions }
}

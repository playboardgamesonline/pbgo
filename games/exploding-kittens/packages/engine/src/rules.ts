import type { OptionDefinitions, OptionValues } from "@pbgo/engine-kit"
import { CARDS, type CatalogueRules, DECKS } from "./catalogue"
import { EFFECTS } from "./effects"
import type { Effect } from "./machine"
import { OPTIONS } from "./options"

/**
 * How a table is set up, from its options and its number of players. The Original Edition is one plan; a deck with another
 * setup brings its own.
 *
 * Setup order (the booklet's): the Kittens and the Defuses are taken out; each player gets `defusesEach` Defuses; some of the
 * others go back into the pool (`defusesBack`, the rest leave the game unseen); the pool is shuffled and `hand` cards are dealt to
 * each player; with `trim`, a third of what is left is removed unseen; then `kittens` Kittens are shuffled into it.
 */
export type SetupPlan = {
  defusesEach: number
  /** Cards dealt to each player on top of their Defuses. */
  hand: number
  /** The spare Defuses that go back into the pool: a number of them, or all. */
  defusesBack: number | "all"
  kittens: number
  /** Remove a third of the pile, unseen, before the Kittens go in. */
  trim: boolean
}

/**
 * Everything that makes a deck of Exploding Kittens: its cards and decks (`catalogue.ts`), what its action cards do, the options
 * it offers and how it is set up. `createGame` turns one into a `GameDefinition`; the Original Edition is `ORIGINAL_RULES`.
 */
export type Rules = CatalogueRules & {
  /** What each action card does, by `effect` key. */
  effects: Record<string, Effect>
  options: OptionDefinitions
  plan(options: OptionValues, players: number): SetupPlan
}

/** The Original Edition: 56 cards, one Defuse each and 7 more cards, a Kitten fewer than players. */
export const ORIGINAL_RULES: Rules = {
  cards: CARDS,
  decks: DECKS,
  selectDecks: () => ["original"],
  effects: EFFECTS,
  options: OPTIONS,
  plan(options, players) {
    const classic = options.classicDeal === true
    return {
      defusesEach: 1,
      hand: classic ? 4 : 7,
      // 6 Defuses: one each, then at most 2 go back (the booklet), or every spare one in the classic deal
      defusesBack: classic ? "all" : Math.min(2, Math.max(0, 6 - players)),
      kittens: players - 1,
      trim: options.fasterGame === true,
    }
  },
}

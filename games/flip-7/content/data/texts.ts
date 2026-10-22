import { localeString } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"

export const TEXTS_ID = "texts"

/**
 * A term the rulebooks print. English is the booklet (ruleset 3.1) or the card faces, French the French booklet (2.0) or the card faces.
 * There is no Spanish or German edition to read, so those two carry the English term until the owner translates them in the Studio: the
 * same choice as the names of the three action cards.
 */
const printed = (fr: string, en: string): Localized => ({ fr, en, es: en, de: en })

/**
 * The words of the board that the rulebooks print, and no other: nothing here is worded for the web edition. A word that no booklet or
 * card prints (a status like "stayed" or "frozen", the history lines, the Flip 7 banner, the home heading and the genres) is left to the
 * owner in the Studio, where the board reads it as `[missing: <field>]` until then.
 */
const WORDS: Record<string, Localized> = {
  // The two gestures of a turn: “Hit” and “Stay” in the English booklet, ENCORE and STOP in the French one
  hit: printed("Encore", "Hit"),
  stay: printed("Stop", "Stay"),
  dealer: printed("Donneur", "Dealer"),
  // The term the booklets print for a round, and the number the board adds to it
  round: printed("Manche {round}", "Round {round}"),
  busted: printed("Sauté", "Busted"),
  // The booklets use these as verbs and nouns in running text: the board needs a label, so the bare term is used
  scoreNow: printed("Score", "Score"),
  scoreTotal: printed("Total", "Total"),
  deck: printed("Paquet", "Deck"),
  discard: printed("Cartes défaussées", "Discarded cards"),
  // Fragments of the sentences that name the goal ("score 200 points to win", "atteindre 200 points"), the figure replaced by the option
  goal: printed("Atteindre {score} points", "Score {score} points to win"),
  // Printed on the Freeze and Flip Three cards ("Play on an active player", "Ciblez un joueur")
  targetPrompt: printed("Ciblez un joueur", "Play on an active player"),
  // The name of the bonus the booklets print as is, in every edition: the game over chip reads it, then the count
  detailFlip7: printed("Flip 7", "Flip 7"),
}

/** The part of `texts` the content seed fills: the printed words of the board. Everything else (labels, errors, victory lines, the other board words) is set in the Studio and left alone. */
export function buildTexts(): SeedDoc {
  const doc: SeedDoc = { _id: TEXTS_ID, _type: "texts" }
  for (const [field, words] of Object.entries(WORDS)) doc[field] = localeString(words)
  return doc
}

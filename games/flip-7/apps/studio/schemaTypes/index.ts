import { actionCard, modifierCard, numberCard } from "./cards"
import { game } from "./game"
import { texts } from "./texts"

/**
 * Flip 7's own types: one document type per category of cards, and `texts` with the words of the board (it replaces the shared one).
 * `settings` is the shared one of @pbgo/studio-kit.
 */
export const gameTypes = [game, texts, numberCard, actionCard, modifierCard]

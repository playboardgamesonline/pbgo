import { actionCard, modifierCard, numberCard } from "./cards"
import { game } from "./game"

/** Flip 7's own types: one document type per category of cards. `settings` is the shared one of @pbgo/studio-kit. */
export const gameTypes = [game, numberCard, actionCard, modifierCard]

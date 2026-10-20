import { bonusTile } from "./bonusTile"
import { card } from "./card"
import { game } from "./game"
import { suit } from "./suit"

/** Hanabi's own types; `settings` is the shared one of @pbgo/studio-kit. */
export const gameTypes = [game, suit, card, bonusTile]

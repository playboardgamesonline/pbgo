import { bonusTile } from "./bonusTile"
import { card } from "./card"
import { game } from "./game"
import { suit } from "./suit"

/** Hanabi's own types; `settings` and `rules` are the shared ones of @pbgo/studio-kit. */
export const gameTypes = [game, suit, card, bonusTile]

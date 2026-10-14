import { cardType } from "./cardType"
import { edition } from "./edition"
import { game } from "./game"

/** Exploding Kittens' own types; `settings` and `rules` are the shared ones of @pbgo/studio-kit. */
export const gameTypes = [game, cardType, edition]

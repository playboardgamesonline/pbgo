import { cardType } from "./cardType"
import { edition } from "./edition"
import { game } from "./game"

/** Exploding Kittens' own types; `settings` is the shared one of @pbgo/studio-kit. */
export const gameTypes = [game, cardType, edition]

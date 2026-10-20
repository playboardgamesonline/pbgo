import { actionCard, catCard, defuseCard, kittenCard, nopeCard } from "./cards"
import { edition } from "./edition"
import { game } from "./game"

/** Exploding Kittens' own types, the cards in five categories; `settings` and `rules` are the shared ones of @pbgo/studio-kit. */
export const gameTypes = [game, kittenCard, defuseCard, actionCard, nopeCard, catCard, edition]

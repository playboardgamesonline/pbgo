import { card } from "./card"
import { game } from "./game"
import { texts } from "./texts"

/** Skyjo's own types: the `card` list (one document per face), the `game` pictures and the `texts` with the words of the board (it replaces the shared one). `settings` is the shared one of @pbgo/studio-kit. */
export const gameTypes = [game, texts, card]

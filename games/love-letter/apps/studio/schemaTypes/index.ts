import { character } from "./character"
import { game } from "./game"
import { texts } from "./texts"

/** Love Letter's own types: the `character` list (one document per character), the `game` pictures and the `texts` with the words of the board (it replaces the shared one). `settings`, `audio` and `interface` are the shared ones of @pbgo/studio-kit. */
export const gameTypes = [game, texts, character]

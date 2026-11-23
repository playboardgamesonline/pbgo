import type { PlayerView } from "@skyjo/engine"
import type { Vocabulary } from "../../lib/words"

/**
 * What the viewer has to do now, in the game's words and the visitor's language: the ticker says it under whose turn it is (`prompt` of `Ticker`), since the table writes no sentence. Nothing while the viewer has nothing to do, a spectator, a player waiting for
 * another or the end of the game: the main line of the ticker already says whose turn it is, and who the game waits for.
 */
export function promptOf(view: PlayerView, words: Vocabulary): string | null {
  const { phase, me } = view
  if (me === null) return null
  switch (phase.kind) {
    case "reveal":
      return phase.waiting.includes(me) ? words.promptReveal : null
    case "choose":
      return phase.player === me ? words.promptChoose : null
    case "place":
      return phase.player === me ? (phase.from === "deck" ? words.promptPlaceDrawn : words.promptPlaceTaken) : null
    case "flip":
      return phase.player === me ? words.promptFlip : null
    case "between":
      return phase.dealer === me ? words.promptDeal : null
    case "over":
      return null
  }
}

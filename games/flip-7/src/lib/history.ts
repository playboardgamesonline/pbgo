import type { Flip7Event } from "@flip-7/engine"
import { cardName, isSecondChance } from "./cards"
import type { ClientCatalog } from "./catalog"
import { fill } from "./words"

/** What the history needs of the table: the words and the card names of the catalog, and a player's nickname. */
export type HistoryContext = Pick<ClientCatalog, "words" | "names"> & { nickname: (playerId: string) => string }

/**
 * What an event says, without who did it: the ticker of the HUD heads each turn with the player's name, so a sentence reads after it ("stays and banks 21"). The words are Sanity's (`words` of the catalog), never the code's.
 * Every kind of event has its sentence: the switch is exhaustive, so a new kind of event does not compile until it has one.
 */
export function sentenceOf(event: Flip7Event, { words, names, nickname }: HistoryContext): string {
  switch (event.kind) {
    case "round":
      return fill(words.eventRound, { number: event.number })
    case "draw":
      return fill(event.how === "deal" ? words.eventDeal : event.how === "hit" ? words.eventHit : words.eventFlip, { card: cardName(event.card.type, names) })
    case "stay":
      return fill(words.eventStay, { points: event.points })
    case "bust":
      return fill(words.eventBust, { card: cardName(event.card.type, names) })
    case "saved":
      return fill(words.eventSaved, { card: cardName(event.card.type, names) })
    case "play":
      // A Second Chance a player keeps goes in front of themselves; a Freeze or a Flip Three they play on themselves is still given, to themselves
      return event.by === event.target && isSecondChance(event.card.type)
        ? fill(words.eventKeep, { card: cardName(event.card.type, names) })
        : fill(words.eventPlay, { card: cardName(event.card.type, names), target: nickname(event.target) })
    case "discarded":
      return fill(words.eventDiscarded, { card: cardName(event.card.type, names) })
    case "reshuffle":
      return words.eventReshuffle
    case "flip7":
      return words.eventFlip7
    case "end":
      return words.eventEnd
    case "over":
      return words.eventOver
  }
}

/**
 * Who each event of the log is the doing of, for `groupTurns` of core, which groups the history into turns by author. A round is begun by its dealer; the other events name who made them. What the table does by itself (the discard
 * shuffled into a new deck, the end of a round, the end of the game) has no author of its own and goes to the one whose move set it off: the one before it in the log.
 */
export function actorsOf(events: readonly Flip7Event[]): (string | null)[] {
  let previous: string | null = null
  return events.map((event) => {
    const own = event.kind === "round" ? event.dealer : "by" in event ? event.by : null
    previous = own ?? previous
    return previous
  })
}

import type { SkyjoEvent } from "@skyjo/engine"
import { cardName } from "./cards"
import type { ClientCatalog } from "./catalog"
import { fill } from "./words"

/** What the history needs of the table: the words of the catalog. */
export type HistoryContext = Pick<ClientCatalog, "words">

/**
 * What an event says, without who did it: the ticker of the HUD heads each turn with the player's name, so a sentence reads after it ("draws 7"). The words are Sanity's (`words` of the catalog), never the code's. A card drawn from the pile is read in full
 * by the player who drew it and without its figure by everybody else: the log the platform sends each player already holds the right one (`viewLog`), this only words it. Every kind of event has its sentence: the switch is exhaustive, so a new kind of
 * event does not compile until it has one.
 */
export function sentenceOf(event: SkyjoEvent, { words }: HistoryContext): string {
  switch (event.kind) {
    case "round":
      return fill(words.eventRound, { number: event.number })
    case "reveal":
      return fill(event.how === "flip" ? words.eventFlip : words.eventReveal, { card: cardName(event.card.type) })
    case "take":
      return fill(words.eventTake, { card: cardName(event.card.type) })
    case "draw":
      return event.card ? fill(words.eventDrawSeen, { card: cardName(event.card.type) }) : words.eventDraw
    case "place":
      return fill(words.eventPlace, { card: cardName(event.card.type), replaced: cardName(event.replaced.type) })
    case "discard":
      return fill(words.eventThrow, { card: cardName(event.card.type) })
    case "column":
      return fill(words.eventColumn, { value: event.value })
    case "start":
      return fill(words.eventStart, { sum: event.sum })
    case "last":
      return words.eventLast
    case "reshuffle":
      return words.eventReshuffle
    case "end":
      return event.doubled ? words.eventEndDoubled : words.eventEnd
    case "over":
      return words.eventOver
  }
}

/**
 * Who each event of the log is the doing of, for `groupTurns` of core, which groups the history into turns by author. A round is begun by its dealer; the other events name who made them. What the table does by itself (the discard shuffled into a new
 * pile, the end of a round, the end of the game) has no author of its own and goes to the one whose move set it off: the one before it in the log.
 */
export function actorsOf(events: readonly SkyjoEvent[]): (string | null)[] {
  let previous: string | null = null
  return events.map((event) => {
    const own = event.kind === "round" ? event.dealer : "by" in event ? event.by : null
    previous = own ?? previous
    return previous
  })
}

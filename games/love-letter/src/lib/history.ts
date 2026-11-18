import type { LoveLetterEvent } from "@love-letter/engine"
import type { ClientCatalog } from "./catalog"
import { fill } from "./words"

/** What the history needs of the table: the words and the names of the characters of the catalog, and a player's nickname. */
export type HistoryContext = Pick<ClientCatalog, "words" | "names"> & { nickname: (playerId: string) => string }

/**
 * What an event says, without who did it: the ticker of the HUD heads each turn with the player's name, so a sentence reads after it ("plays the Guard"). The words are Sanity's (`words` of the catalog), never the code's. A private entry reaches each player as
 * the log gives it to them, in full for the ones it is for and masked for the others (`card` and `cards` missing): the sentence is the same and the card it was not given to read is left out. Every kind of event has its sentence: the switch is exhaustive, so
 * a new kind of event does not compile until it has one.
 */
export function sentenceOf(event: LoveLetterEvent, { words, names, nickname }: HistoryContext): string {
  const withCards = (sentence: string, ...cards: (string | undefined)[]) => (cards.every((card) => card === undefined) ? sentence : `${sentence} · ${cards.filter((card) => card !== undefined).join(" / ")}`)
  switch (event.kind) {
    case "round":
      return fill(words.eventRound, { number: event.number })
    case "draw":
      return withCards(words.eventDraw, event.card && names[event.card.type])
    case "play":
      return fill(words.eventPlay, { card: names[event.card.type] })
    case "guess":
      return fill(event.hit ? words.eventGuessHit : words.eventGuessMiss, { guess: names[event.guess], target: nickname(event.target) })
    case "look":
      return withCards(fill(words.eventLook, { target: nickname(event.target) }), event.card && names[event.card])
    case "compare":
      return withCards(fill(words.eventCompare, { target: nickname(event.target) }), event.cards && names[event.cards.by], event.cards && names[event.cards.target])
    case "swap":
      return withCards(fill(words.eventSwap, { target: nickname(event.target) }), event.cards && names[event.cards.by], event.cards && names[event.cards.target])
    case "protect":
      return words.eventProtect
    case "discard":
      return fill(event.by === event.player ? words.eventDiscardSelf : words.eventDiscard, { player: nickname(event.player), card: names[event.card.type] })
    case "out":
      return fill(event.cause === "guard" ? words.eventOutGuard : event.cause === "baron" ? words.eventOutBaron : words.eventOutPrincess, { player: nickname(event.player) })
    case "chancellor":
      return words.eventChancellor
    case "bottom":
      return withCards(words.eventBottom, event.kept && names[event.kept.type])
    case "fizzled":
      return words.eventFizzled
    case "reveal":
      return words.eventReveal
    case "end": {
      const won = fill(words.eventEnd, { winners: event.winners.map(nickname).join(", ") })
      return event.spy === null ? won : `${won} · ${fill(words.eventSpy, { player: nickname(event.spy) })}`
    }
    case "over":
      return fill(words.eventOver, { winners: event.winners.map(nickname).join(", ") })
  }
}

/**
 * Who each event of the log is the doing of, for `groupTurns` of core, which groups the history into turns by author. A round is begun by the player who takes its first turn; the other events name who made them, or the player an effect fell on
 * (an `out` is the doing of whoever's card knocked them out). What the table does by itself (the hands shown when the deck runs out, the end of a round and of the game) has no author of its own and goes to the one whose move set it off: the one before it in the log.
 */
export function actorsOf(events: readonly LoveLetterEvent[]): (string | null)[] {
  let previous: string | null = null
  return events.map((event) => {
    const own = event.kind === "round" ? event.first : "by" in event ? event.by : null
    previous = own ?? previous
    return previous
  })
}

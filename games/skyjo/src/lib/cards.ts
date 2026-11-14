import { CARDS, type CardKey } from "@skyjo/engine"

/** The figure printed on a card, from its key in the engine's catalogue (`card-minus-2` is -2). A key the catalogue does not know is written as it is. */
export function cardName(key: string): string {
  return Object.hasOwn(CARDS, key) ? String(CARDS[key as CardKey].value) : key
}

import { CARDS, type CardKey } from "@flip-7/engine"

const typeOf = (key: string) => (Object.hasOwn(CARDS, key) ? CARDS[key as CardKey] : undefined)

/**
 * The name of a card as a player reads it. A number and a modifier are named by the figure printed on them, which the engine's catalogue holds (a 7, a +4, the x2: no word, so nothing to translate); an action card is named by a word,
 * which is Sanity's (`names` of the catalog, in the language asked). A key the catalogue does not know is written as it is.
 */
export function cardName(key: string, names: Record<string, string>): string {
  const type = typeOf(key)
  if (!type) return key
  if (type.kind === "number") return String(type.value)
  if (type.kind === "modifier") return type.times > 1 ? `x${type.times}` : `+${type.plus}`
  return names[key] ?? key
}

/** Whether a card is the Second Chance: the one action card a player may keep for themselves, to cancel a number they already hold. */
export function isSecondChance(key: string): boolean {
  const type = typeOf(key)
  return type?.kind === "action" && type.effect === "second-chance"
}

import { localeString, localeText } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"
import { CARD_TYPE_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { CardTypeKey, KindKey } from "../../apps/studio/schemaTypes/constants.ts"

type CardTypeSpec = {
  kind: KindKey
  /** Copies of the face in the box: 94 cards in all (79 numbers, 6 score modifiers, 9 action cards). */
  copies: number
  name: Localized
  /** A short summary of the effect in PBGO's own words, never copied from the booklet. */
  effect: Localized
}

// Registers follow the site's translations: vous (fr), you (en), tú (es), du (de). The names of the numbers and of the modifiers are the
// figures of the cards. The three action cards keep their English names in every language, as printed on the cards. The FR, ES and DE
// texts are meant for a native read.

const same = (text: string): Localized => ({ fr: text, en: text, es: text, de: text })

const NUMBER_EFFECT: Localized = {
  fr: "Vaut son nombre de points. Piocher un nombre que vous avez déjà devant vous vous élimine de la manche : vous ne marquez rien.",
  en: "Worth its number in points. Drawing a number you already have in front of you busts you out of the round: you score nothing.",
  es: "Vale su número en puntos. Si robas un número que ya tienes delante, quedas eliminado de la ronda y no puntúas nada.",
  de: "Zählt so viele Punkte, wie die Zahl angibt. Wenn du eine Zahl ziehst, die schon vor dir liegt, scheidest du aus der Runde aus und bekommst keine Punkte.",
}

const ZERO_EFFECT: Localized = {
  fr: "Ne rapporte aucun point, mais compte comme un nombre : elle aide à réunir sept nombres différents pour un Flip 7.",
  en: "Worth no points, but it counts as a number: it helps you collect seven different numbers for a Flip 7.",
  es: "No vale ningún punto, pero cuenta como número: te ayuda a reunir siete números distintos para un Flip 7.",
  de: "Bringt keine Punkte, zählt aber als Zahl: Sie hilft dir, sieben verschiedene Zahlen für einen Flip 7 zu sammeln.",
}

const plusEffect = (points: number): Localized => ({
  fr: `Ajoute ${points} points au score de votre manche. Ne compte pas pour un Flip 7 et ne peut pas vous éliminer.`,
  en: `Adds ${points} points to your score for the round. It does not count toward a Flip 7 and cannot bust you.`,
  es: `Suma ${points} puntos a tu puntuación de la ronda. No cuenta para un Flip 7 y no puede eliminarte.`,
  de: `Addiert ${points} Punkte zu deiner Punktzahl der Runde. Zählt nicht für einen Flip 7 und kann dich nicht ausscheiden lassen.`,
})

const TIMES_EFFECT: Localized = {
  fr: "Double les points de vos cartes Nombre ; les bonus (+2 à +10) s’ajoutent ensuite. Ne compte pas pour un Flip 7.",
  en: "Doubles the points of your number cards; the bonuses (+2 to +10) are added afterwards. It does not count toward a Flip 7.",
  es: "Duplica los puntos de tus cartas de número; los bonos (+2 a +10) se suman después. No cuenta para un Flip 7.",
  de: "Verdoppelt die Punkte deiner Zahlenkarten; die Boni (+2 bis +10) kommen danach dazu. Zählt nicht für einen Flip 7.",
}

const FREEZE_EFFECT: Localized = {
  fr: "Se joue sur un joueur encore dans la manche, vous compris : il met ses points en banque et quitte la manche.",
  en: "Played on any player still in the round, yourself included: they bank their points and leave the round.",
  es: "Se juega sobre cualquier jugador que siga en la ronda, tú incluido: guarda sus puntos y sale de la ronda.",
  de: "Wird auf eine Person gespielt, die noch in der Runde ist, dich eingeschlossen: Sie sichert ihre Punkte und scheidet aus der Runde aus.",
}

const FLIP_THREE_EFFECT: Localized = {
  fr: "Se joue sur un joueur encore dans la manche, vous compris : il retourne les trois cartes suivantes, une à la fois, et s’arrête s’il est éliminé ou réussit un Flip 7. Les Freeze et Flip Three retournés se jouent après les trois cartes.",
  en: "Played on any player still in the round, yourself included: they flip the next three cards, one at a time, and stop if they bust or make a Flip 7. Any Freeze or Flip Three they flip is played after the three cards.",
  es: "Se juega sobre cualquier jugador que siga en la ronda, tú incluido: voltea las tres cartas siguientes, una a una, y se detiene si queda eliminado o consigue un Flip 7. Los Freeze y Flip Three que salgan se juegan tras las tres cartas.",
  de: "Wird auf eine Person gespielt, die noch in der Runde ist, dich eingeschlossen: Sie deckt die nächsten drei Karten nacheinander auf und hört auf, wenn sie ausscheidet oder einen Flip 7 schafft. Aufgedeckte Freeze und Flip Three werden nach den drei Karten gespielt.",
}

const SECOND_CHANCE_EFFECT: Localized = {
  fr: "À garder devant vous. Si vous piochez un nombre que vous avez déjà, défaussez la Second Chance et le doublon : vous restez dans la manche. Une seule à la fois ; une deuxième se donne à un autre joueur encore dans la manche.",
  en: "Keep it in front of you. If you draw a number you already have, discard the Second Chance and the duplicate: you stay in the round. You can hold only one: a second one goes to another player still in the round.",
  es: "Guárdala delante de ti. Si robas un número que ya tienes, descarta la Second Chance y el repetido: sigues en la ronda. Solo puedes tener una; una segunda se da a otro jugador que siga en la ronda.",
  de: "Behalte sie vor dir. Wenn du eine Zahl ziehst, die du schon hast, legst du die Second Chance und die doppelte Karte ab: Du bleibst in der Runde. Du kannst nur eine haben; eine zweite geht an eine andere Person, die noch in der Runde ist.",
}

const numberSpec = (value: number): CardTypeSpec => ({
  kind: "number",
  copies: Math.max(value, 1),
  name: same(String(value)),
  effect: value === 0 ? ZERO_EFFECT : NUMBER_EFFECT,
})

const SPECS: Record<CardTypeKey, CardTypeSpec> = {
  "number-0": numberSpec(0),
  "number-1": numberSpec(1),
  "number-2": numberSpec(2),
  "number-3": numberSpec(3),
  "number-4": numberSpec(4),
  "number-5": numberSpec(5),
  "number-6": numberSpec(6),
  "number-7": numberSpec(7),
  "number-8": numberSpec(8),
  "number-9": numberSpec(9),
  "number-10": numberSpec(10),
  "number-11": numberSpec(11),
  "number-12": numberSpec(12),
  "plus-2": { kind: "modifier", copies: 1, name: same("+2"), effect: plusEffect(2) },
  "plus-4": { kind: "modifier", copies: 1, name: same("+4"), effect: plusEffect(4) },
  "plus-6": { kind: "modifier", copies: 1, name: same("+6"), effect: plusEffect(6) },
  "plus-8": { kind: "modifier", copies: 1, name: same("+8"), effect: plusEffect(8) },
  "plus-10": { kind: "modifier", copies: 1, name: same("+10"), effect: plusEffect(10) },
  "times-2": { kind: "modifier", copies: 1, name: same("x2"), effect: TIMES_EFFECT },
  freeze: { kind: "action", copies: 3, name: same("Freeze"), effect: FREEZE_EFFECT },
  "flip-three": { kind: "action", copies: 3, name: same("Flip Three"), effect: FLIP_THREE_EFFECT },
  "second-chance": { kind: "action", copies: 3, name: same("Second Chance"), effect: SECOND_CHANCE_EFFECT },
}

export const cardTypeId = (key: CardTypeKey) => `card-type-${key}`

/** Copies of each face in the box, by key: the engine's `DECK` (`parity/engine.test.ts` checks it). */
export const COPIES = Object.fromEntries(CARD_TYPE_KEYS.map((key) => [key, SPECS[key].copies])) as Record<CardTypeKey, number>

/** The 22 faces, in the order of the engine catalogue. `order` is the place in it, from 0. */
export function buildCardTypes(): SeedDoc[] {
  return CARD_TYPE_KEYS.map((key, order) => {
    const spec = SPECS[key]
    return {
      _id: cardTypeId(key),
      _type: "cardType",
      key,
      kind: spec.kind,
      order,
      copies: spec.copies,
      name: localeString(spec.name),
      effect: localeText(spec.effect),
    }
  })
}

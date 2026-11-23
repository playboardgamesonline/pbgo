import { FLIP_7, type CardFace } from "@flip-7/engine"

/** Whether a line of the board holds a Flip 7: seven different number cards (a number is `number-<figure>` in the engine's catalogue, so two of a figure count once; the action cards and the modifiers never count), the rule of `isFlip7` of the engine for the faces the board is given */
export const madeFlip7 = (cards: readonly CardFace[]): boolean => new Set(cards.filter((card) => card.type.startsWith("number-")).map((card) => card.type)).size >= FLIP_7

import { CARDS, type CharacterKey, type Face, GUESSES, type PlayerView } from "@love-letter/engine"
import type { Vocabulary } from "../../lib/words"

/**
 * What the viewer does with the mouse, as plain data, so that the rules of it are tested without a browser. The engine decides and the board offers: `me.playable` says which cards can be played (the Countess rule) and `phase.targets` which players can be
 * picked, and the board never offers a move the engine would refuse. A choice between objects is made by pressing the objects: a card is pressed to play it (at once when it picks nobody, else it is held until the player it picks is pressed), a player by their
 * cards, the card to keep and then the card that goes under the deck first by the cards themselves. A Guard's player is pressed on the table too, and the character it names in the row of the nine characters that takes the place of the hand at the foot of the
 * screen, with the button that plays it. A button is for the actions with no object: dealing, and playing the Guard once its player and its character are chosen.
 */

/** What the viewer has picked so far: a card of their hand (the card to play that picks a player, or after a Chancellor the card to keep), and for a Guard the player it picks and the character it names, each until it is chosen */
export type Choice = { card: number | null; target?: string | null; guess?: CharacterKey | null }

export const NO_CHOICE: Choice = { card: null }

/**
 * What the board offers now.
 * - `none`: nothing to do (not the viewer's move, a spectator, a player who is out).
 * - `pick`: on their turn, a card of the hand to play. `forced`: the Countess is the only one that can be played. A card that picks nobody is played by pressing it, and so is one that picks another player when nobody can be picked (it is played with no effect).
 * - `target`: the card picked (a Priest, a Baron, a King, a Prince) picks a player: `targets` are the ones that can be picked, the viewer included for a Prince (`self`), pressed on the table.
 * - `name`: a Guard is picked: its player is pressed on the table among `targets` (`target`, chosen already when there is one), the character it names in the row of the nine others at the foot of the screen (`guess`), and the Guard is played by its button once both are chosen.
 * - `keep`: a Chancellor was played: the card of the hand to keep.
 * - `order`: `kept` was picked: the `others` go under the deck, and the one that is pressed goes first.
 * - `deal`: the round is counted and the viewer takes the first turn of the next one: a Deal button.
 */
export type Step =
  | { kind: "none" }
  | { kind: "pick"; forced: boolean }
  | { kind: "target"; card: Face; targets: string[]; self: boolean }
  | { kind: "name"; card: Face; targets: string[]; target: string | null; guess: CharacterKey | null }
  | { kind: "keep" }
  | { kind: "order"; kept: Face; others: Face[] }
  | { kind: "deal" }

const faceIn = (faces: readonly Face[], id: number | null) => (id === null ? undefined : faces.find((face) => face.id === id))

/** Whether a card has to be held until a player is pressed: it picks a player, and somebody can be picked (the Prince always can: it picks its own player at the least) */
function needsPlayer(card: Face, targets: readonly string[]): boolean {
  const rule = CARDS[card.type].target
  return rule === "any" || (rule === "other" && targets.length > 0)
}

/** What the board offers the viewer for what they have picked, in the view as it is: a choice that no longer fits the view (the card left the hand, the turn passed) offers what it offered before it. */
export function stepOf(view: PlayerView, choice: Choice): Step {
  const { me, phase } = view
  if (!me) return { kind: "none" }
  if (phase.kind === "between") return phase.next === me.id ? { kind: "deal" } : { kind: "none" }
  if (phase.kind === "keep") {
    if (phase.player !== me.id) return { kind: "none" }
    const kept = faceIn(me.hand, choice.card)
    if (!kept) return { kind: "keep" }
    return { kind: "order", kept, others: me.hand.filter((face) => face.id !== kept.id) }
  }
  if (phase.kind !== "turn" || phase.player !== me.id) return { kind: "none" }
  const card = faceIn(me.hand, choice.card)
  if (!card || !me.playable.includes(card.id) || !needsPlayer(card, phase.targets)) return { kind: "pick", forced: me.playable.length < me.hand.length }
  if (CARDS[card.type].target === "any") return { kind: "target", card, targets: [me.id, ...phase.targets], self: true }
  if (card.type === "guard") {
    const target = choice.target && phase.targets.includes(choice.target) ? choice.target : phase.targets.length === 1 ? phase.targets[0]! : null
    return { kind: "name", card, targets: phase.targets, target, guess: choice.guess && GUESSES.includes(choice.guess) ? choice.guess : null }
  }
  return { kind: "target", card, targets: phase.targets, self: false }
}

/** The choice the view allows: the one given when it still fits, else nothing picked. A card that left the hand, a turn that passed, or a card that picks nobody now end what was picked. */
export function validChoice(view: PlayerView, choice: Choice): Choice {
  if (choice.card === null) return choice
  const { me, phase } = view
  const mine = me !== null && (phase.kind === "turn" || phase.kind === "keep") && phase.player === me.id
  const card = me ? faceIn(me.hand, choice.card) : undefined
  if (!me || !mine || !card) return NO_CHOICE
  if (phase.kind === "turn" && (!me.playable.includes(choice.card) || !needsPlayer(card, phase.targets))) return NO_CHOICE
  return choice
}

/** Whether the viewer can press a card of their hand now: to play it, or after a Chancellor to keep it, or to put it under the deck */
export function pressable(view: PlayerView, face: Face): boolean {
  const { me, phase } = view
  if (!me || !me.hand.some((held) => held.id === face.id)) return false
  if (phase.kind === "keep") return phase.player === me.id
  return phase.kind === "turn" && phase.player === me.id && me.playable.includes(face.id)
}

/** What the viewer sends, by the engine's actions, the id of the player left out (the platform puts the player in) */
export type ClientAction =
  | { type: "play"; card: number; target?: string; guess?: CharacterKey }
  | { type: "keep"; card: number; bottom: number[] }
  | { type: "deal" }

/** A card played: with the player it picks, and the character a Guard names, when it has them */
export function playAction(card: Face, target?: string, guess?: CharacterKey): ClientAction {
  return { type: "play", card: card.id, ...(target === undefined ? {} : { target }), ...(guess === undefined ? {} : { guess }) }
}

/** The card kept after a Chancellor, and the others under the deck, the first one first, so the last of them is the last card of the deck */
export function keepAction(kept: Face, bottom: readonly Face[]): ClientAction {
  return { type: "keep", card: kept.id, bottom: bottom.map((face) => face.id) }
}

/** What pressing something does: it changes what is held (`choose`), or it sends a move (`send`) */
export type Press = { kind: "choose"; choice: Choice } | { kind: "send"; action: ClientAction }

/**
 * What pressing a card of the hand does. On the viewer's turn, the card held is put back; a card that picks nobody is played at once, and so is one that picks another player when nobody can be picked; any other is held until the player it picks is pressed.
 * After a Chancellor, the first card pressed is the one kept, which is sent at once when it is the only one that could be put back and held when two could; then the card pressed goes under the deck first and the other last, and the move is sent. The card kept
 * is put back by pressing it again. Nothing for a card that cannot be pressed.
 */
export function pressCard(view: PlayerView, choice: Choice, face: Face): Press | null {
  const { me, phase } = view
  if (!me || !pressable(view, face)) return null
  if (choice.card === face.id) return { kind: "choose", choice: NO_CHOICE }
  if (phase.kind === "keep") {
    const kept = faceIn(me.hand, choice.card)
    if (kept) return { kind: "send", action: keepAction(kept, [face, ...me.hand.filter((held) => held.id !== kept.id && held.id !== face.id)]) }
    const others = me.hand.filter((held) => held.id !== face.id)
    return others.length > 1 ? { kind: "choose", choice: { card: face.id } } : { kind: "send", action: keepAction(face, others) }
  }
  if (phase.kind !== "turn") return null
  return needsPlayer(face, phase.targets) ? { kind: "choose", choice: { card: face.id } } : { kind: "send", action: playAction(face) }
}

/** What pressing a player does while one is to be chosen on the table: the card picked (a Priest, a Baron, a King, a Prince) is played with them */
export const pressPlayer = (step: Extract<Step, { kind: "target" }>, id: string): Press => ({ kind: "send", action: playAction(step.card, id) })

type Naming = Extract<Step, { kind: "name" }>

/** What pressing a player does while a Guard is picked: they are the player it picks, and pressed again they are not any more; the character named stays */
export const pickPlayer = (step: Naming, id: string): Press => ({ kind: "choose", choice: { card: step.card.id, target: step.target === id && step.targets.length > 1 ? null : id, guess: step.guess } })

/** What pressing a character of the row does while a Guard is picked: it is the one named, and pressed again it is not any more; the player chosen stays */
export const pickGuess = (step: Naming, type: CharacterKey): Press => ({ kind: "choose", choice: { card: step.card.id, target: step.target, guess: step.guess === type ? null : type } })

/** What the button of a Guard does: the Guard is played, naming the character to the player chosen, once both are chosen; nothing before */
export const pressName = (step: Naming): Press | null => (step.target && step.guess ? { kind: "send", action: playAction(step.card, step.target, step.guess) } : null)

/** What the viewer is told to do, in the game's words, for the ticker: nothing when there is nothing to press but a button that says it itself (Deal) */
export function promptOf(step: Step, words: Vocabulary): string | null {
  switch (step.kind) {
    case "pick":
      return step.forced ? words.mustPlayCountess : words.pickCard
    case "target":
      return step.self ? words.chooseAny : words.chooseOther
    case "name":
      return step.target ? words.nameCharacter : words.chooseOther
    case "keep":
      return words.keepOne
    case "order":
      return words.putBack
    default:
      return null
  }
}

/**
 * The ids by which the lens knows the cards that are on the table now, for the board to let go of a card that has gone (a card that is played, a choice that ends, a reveal that is over gets no pointer-out event): the faces in the hands and the play areas, the hand of the viewer, the cards
 * laid down and set aside face up, by their id in the game; the two faces of a reveal take negative numbers of their own (`-100` and `-101`).
 */
export function lensIds(view: PlayerView, revealing: boolean): Set<number> {
  const ids = new Set<number>()
  for (const player of view.players) for (const face of [...player.area, ...(player.hand ?? [])]) ids.add(face.id)
  for (const face of [...(view.me?.hand ?? []), ...view.faceUp]) ids.add(face.id)
  if (revealing) for (const id of [-100, -101]) ids.add(id)
  return ids
}

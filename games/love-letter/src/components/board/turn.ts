import { CARDS, type CharacterKey, type Face, type PlayerView } from "@love-letter/engine"

/**
 * What the viewer does with the mouse, as plain data, so that the rules of it are tested without a browser. The engine decides and the board offers: `me.playable` says which cards can be played (the Countess rule) and `phase.targets` which players can be
 * picked, and the board never offers a move the engine would refuse. Nothing is sent before the last press, so a mistake is undone by pressing the card again.
 */

/** What the viewer has picked so far: a card of their hand (the card to play, or after a Chancellor the card to keep), the player a Guard names a character for, and after a Chancellor the order the other cards go under the deck in (`null`: as they lie in the hand) */
export type Choice = { card: number | null; target: string | null; order: readonly number[] | null }

export const NO_CHOICE: Choice = { card: null, target: null, order: null }

/**
 * What the board offers now.
 * - `none`: nothing to do (not the viewer's move, a spectator, a player who is out).
 * - `pick`: on their turn, a card of the hand to play. `forced`: the Countess is the only one that can be played.
 * - `pad`: the card picked picks nobody, or picks another player and nobody can be picked (`empty`: it is played with no effect): a Play pad.
 * - `target`: the card picked picks a player: `targets` are the ones that can be picked, the viewer included for a Prince (`self`).
 * - `guess`: a Guard picked `target`: the nine other characters are offered.
 * - `keep`: a Chancellor was played: the card of the hand to keep.
 * - `order`: `kept` was picked: the `others` go under the deck in this order (the first one first); a Keep pad, and a Swap pad when there are two.
 * - `deal`: the round is counted and the viewer takes the first turn of the next one: a Deal pad.
 */
export type Step =
  | { kind: "none" }
  | { kind: "pick"; forced: boolean }
  | { kind: "pad"; card: Face; empty: boolean }
  | { kind: "target"; card: Face; targets: string[]; self: boolean }
  | { kind: "guess"; card: Face; target: string; targets: string[] }
  | { kind: "keep" }
  | { kind: "order"; kept: Face; others: Face[] }
  | { kind: "deal" }

const faceIn = (faces: readonly Face[], id: number | null) => (id === null ? undefined : faces.find((face) => face.id === id))

/** The cards put back, in the order they go under the deck: the viewer's order when it names exactly those cards, else as they lie in the hand */
function orderedOthers(others: Face[], order: readonly number[] | null): Face[] {
  if (order === null || order.length !== others.length || !order.every((id) => others.some((face) => face.id === id))) return others
  return order.map((id) => others.find((face) => face.id === id)!)
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
    return { kind: "order", kept, others: orderedOthers(me.hand.filter((face) => face.id !== kept.id), choice.order) }
  }
  if (phase.kind !== "turn" || phase.player !== me.id) return { kind: "none" }
  const card = faceIn(me.hand, choice.card)
  if (!card || !me.playable.includes(card.id)) return { kind: "pick", forced: me.playable.length < me.hand.length }
  const rule = CARDS[card.type].target
  if (rule === null) return { kind: "pad", card, empty: false }
  if (rule === "any") return { kind: "target", card, targets: [me.id, ...phase.targets], self: true }
  if (phase.targets.length === 0) return { kind: "pad", card, empty: true }
  if (card.type === "guard" && choice.target !== null && phase.targets.includes(choice.target)) return { kind: "guess", card, target: choice.target, targets: phase.targets }
  return { kind: "target", card, targets: phase.targets, self: false }
}

/** The choice the view allows: the one given when it still fits, else nothing picked. A card that left the hand, a turn that passed or a player that is no longer to be picked end what was picked. */
export function validChoice(view: PlayerView, choice: Choice): Choice {
  if (choice.card === null) return choice
  const { me, phase } = view
  const mine = me !== null && (phase.kind === "turn" || phase.kind === "keep") && phase.player === me.id
  if (!me || !mine || !me.hand.some((face) => face.id === choice.card)) return NO_CHOICE
  if (phase.kind === "turn" && !me.playable.includes(choice.card)) return NO_CHOICE
  if (choice.target !== null && !(phase.kind === "turn" && phase.targets.includes(choice.target))) return { ...choice, target: null }
  return choice
}

/** Whether the viewer can press a card of their hand now: to play it, or after a Chancellor to keep it */
export function pressable(view: PlayerView, face: Face): boolean {
  const { me, phase } = view
  if (!me || !me.hand.some((held) => held.id === face.id)) return false
  if (phase.kind === "keep") return phase.player === me.id
  return phase.kind === "turn" && phase.player === me.id && me.playable.includes(face.id)
}

/** Pressing a card picks it, and pressing the card that is picked puts it back (the other picks go with it) */
export function pressCard(choice: Choice, id: number): Choice {
  return choice.card === id ? NO_CHOICE : { card: id, target: null, order: null }
}

/** Pressing a player after a Guard: it names that player, and the nine characters are offered */
export function pressTarget(choice: Choice, id: string): Choice {
  return { ...choice, target: id }
}

/** Swapping the two cards put back: the order they go under the deck in is turned round */
export function swapOrder(step: Extract<Step, { kind: "order" }>, choice: Choice): Choice {
  return { ...choice, order: step.others.map((face) => face.id).reverse() }
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

/** The card kept after a Chancellor, and the others under the deck in the order they lie in the step (the first goes in first, so the last of them is the last card of the deck) */
export function keepAction(step: Extract<Step, { kind: "order" }>): ClientAction {
  return { type: "keep", card: step.kept.id, bottom: step.others.map((face) => face.id) }
}

/**
 * The ids by which the lens knows the cards that are on the table now, for the board to let go of a card that has gone (a card that is played, a choice that ends, a reveal that is over gets no pointer-out event): the faces in the play areas, in the viewer's hand, in the hands
 * laid down and set aside face up, by their id in the game; the nine faces of a Guard's guess and the two of a reveal take negative numbers of their own (`-1` to `-9`, and `-100` and `-101`).
 */
export function lensIds(view: PlayerView, guessing: boolean, revealing: boolean): Set<number> {
  const ids = new Set<number>()
  for (const player of view.players) for (const face of [...player.area, ...(player.hand ?? [])]) ids.add(face.id)
  for (const face of [...(view.me?.hand ?? []), ...view.faceUp]) ids.add(face.id)
  if (guessing) for (let i = 1; i <= 9; i++) ids.add(-i)
  if (revealing) for (const id of [-100, -101]) ids.add(id)
  return ids
}

/**
 * What the strip says when there is nothing to press: the viewer is out of the round (they read the table and wait for it to end), or the next round is dealt by another player (the one who takes the first turn deals it). Nothing otherwise: it is somebody's turn, the ticker
 * says whose, and the game over has its own screen.
 */
export type Note = { kind: "out" } | { kind: "deal"; player: string }

export function noteOf(view: PlayerView): Note | null {
  const { me, phase } = view
  if (!me) return null
  if (phase.kind === "between") return phase.next === me.id ? null : { kind: "deal", player: phase.next }
  if (phase.kind === "turn" || phase.kind === "keep") return view.players.find((player) => player.id === me.id)?.out ? { kind: "out" } : null
  return null
}

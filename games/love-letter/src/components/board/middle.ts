import { CARDS, type Face, type PlayerView } from "@love-letter/engine"

/**
 * Where the cards of the round lie, as plain data, so that the rules of it are tested without a browser. The engine keeps, for each player, the cards they played or discarded this round (`area`, oldest first); the board does not lay them out by player. A card that is done
 * with goes to one area in the middle of the table, sorted by the value printed on it, so that what is gone can be read at a glance. Two kinds of card stay in front of their player, because they still count: a Spy until the round ends (it earns a token then) and a Handmaid
 * while it protects (until the start of its player's next turn). The view says which: `shielded` is the protection, and the Spy is a Spy.
 */
export type TableCards = {
  /** The cards in the middle, from the lowest value to the highest (the Spy, 0, to the Princess, 9): the cards of one value together, in the order of the seats and then in the order they were played in */
  middle: Face[]
  /** What stays in front of each player, by id, oldest first. For the viewer, the card they picked and have not played yet comes last: it is taken out of their hand and laid in front of them while they choose the player it picks */
  front: ReadonlyMap<string, Face[]>
}

/** The place in `faces` of the last card of the character `type`, or -1: the Handmaid that protects is the last one its player played, the older ones have done their work */
function lastOf(faces: readonly Face[], type: Face["type"]): number {
  for (let i = faces.length - 1; i >= 0; i--) if (faces[i]!.type === type) return i
  return -1
}

/**
 * The cards in the middle and the cards in front of each player, for the view as it is and the card the viewer has picked (`picked`, one of their hand, `null` when they have picked none or it picks nobody). A player who is out keeps nothing in front of them: a Spy that is
 * out of the round counts for nothing, and their Handmaid has no one left to protect.
 */
export function tableCards(view: PlayerView, picked: Face | null = null): TableCards {
  const front = new Map<string, Face[]>()
  const middle: Face[] = []
  for (const player of view.players) {
    const protecting = player.shielded && !player.out ? lastOf(player.area, "handmaid") : -1
    const kept: Face[] = []
    player.area.forEach((face, i) => {
      const stays = !player.out && (face.type === "spy" || i === protecting)
      if (stays) kept.push(face)
      else middle.push(face)
    })
    front.set(player.id, kept)
  }
  if (picked && view.me) front.set(view.me.id, [...(front.get(view.me.id) ?? []), picked])
  // `sort` is stable: the cards of one value stay in the order they were gathered in
  middle.sort((a, b) => CARDS[a.type].value - CARDS[b.type].value)
  return { middle, front }
}

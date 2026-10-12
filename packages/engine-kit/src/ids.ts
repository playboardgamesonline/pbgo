import type { Rng } from "./rng"

/**
 * Opaque card ids. A card that clients can see (face down on the table, in a hand, in a pile) is shown under an id, never under
 * what it is. An id is a number that says nothing about the card or about its place; the card behind it is found in the game's
 * catalogue through `ids`, the table kept in the state.
 *
 * `ids` is aligned with the catalogue: `ids[card]` is the id held, now, by the card at index `card` of the catalogue. Piles,
 * hands and tables only hold ids. A card that goes back into hiding after it has been seen (a revealed card turned face down
 * again, a Defuse slid back into the deck) gets a new id with `reissueId`: nobody can follow it from what they saw.
 *
 * The numbers come from a side stream (`sideSeed`, saved with `createSaveableRng`), never from the stream that shuffles: ids
 * reach the clients, and they would give the shuffle away.
 */

/** The ids are integers in [0, ID_SPACE): the widest range a stream of 32 bits can fill. */
export const ID_SPACE = 2 ** 32

function checkSpace(space: number): void {
  if (!Number.isInteger(space) || space < 1 || space > ID_SPACE) {
    throw new RangeError(`The id space is an integer from 1 to 2^32, got ${String(space)}`)
  }
}

/** An id that nobody holds, drawn from `rng`. */
function freshId(taken: ReadonlySet<number>, rng: Rng, space: number): number {
  if (taken.size >= space) throw new RangeError(`No id left to issue: ${taken.size} are held out of ${space}`)
  let id: number
  do id = Math.floor(rng() * space)
  while (taken.has(id))
  return id
}

/**
 * The ids of `count` cards, all different, in catalogue order: the first `ids` table of a game. `space` is the size of the id
 * space (a game that shows its ids in a fixed format may need fewer than `ID_SPACE`).
 */
export function issueIds(count: number, rng: Rng, space = ID_SPACE): number[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`The number of ids is a non-negative integer, got ${String(count)}`)
  checkSpace(space)
  if (count > space) throw new RangeError(`Cannot issue ${count} different ids out of ${space}`)
  const taken = new Set<number>()
  const ids: number[] = []
  while (ids.length < count) {
    const id = freshId(taken, rng, space)
    taken.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * Gives the card that holds `id` a new id, one that no card holds, and returns the new table with it. Call it when the card
 * goes back into hiding; the caller then puts `fresh` where the card is now (the old id must not stay anywhere in the state).
 * A retired id is not remembered: it could come back, by chance, one time in `space`.
 * Throws a `RangeError` for an id the table does not hold: the game checked the player's input before.
 */
export function reissueId(ids: readonly number[], id: number, rng: Rng, space = ID_SPACE): { ids: number[]; fresh: number } {
  checkSpace(space)
  const card = ids.indexOf(id)
  if (card < 0) throw new RangeError(`Card id ${String(id)} is not in the table`)
  const fresh = freshId(new Set(ids), rng, space)
  const next = [...ids]
  next[card] = fresh
  return { ids: next, fresh }
}

/** `reissueId` for several cards at once (e.g. the three revealed cards of a failed trio): `fresh[i]` replaces `held[i]`. */
export function reissueIds(ids: readonly number[], held: readonly number[], rng: Rng, space = ID_SPACE): { ids: number[]; fresh: number[] } {
  let table = [...ids]
  const fresh: number[] = []
  for (const id of held) {
    const next = reissueId(table, id, rng, space)
    table = next.ids
    fresh.push(next.fresh)
  }
  return { ids: table, fresh }
}

/** The card (its index in the catalogue) that holds `id`, or -1 when nobody does. */
export function cardOf(ids: readonly number[], id: number): number {
  return ids.indexOf(id)
}

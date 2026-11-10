/**
 * Bags. A bag holds tokens of several kinds and nobody can say which one comes out next: the tiles of Azul and of Scrabble, the chips of a bag-building game. The state keeps how many tokens of each kind are in it, as an array of whole numbers:
 * the kinds are numbers from 0 (the game keeps the list of what each is, a colour, a letter) and `counts[kind]` is how many of that kind are inside. Nothing else: the state is lean, and an order comes from an array, never from the keys of an object.
 *
 * A draw takes tokens at random from the game's seeded stream, as a shuffle does: the same seed and the same actions draw the same tokens on every machine, and a client that reads the view cannot know the next draw. The view tells the others how
 * many tokens are left, and which ones only to the player who drew them. The board draws the bag with a `Bag`, and the tokens that come out of its mouth fly to where they go.
 */
import type { Rng } from "./rng"

function checkCounts(counts: readonly number[]): void {
  if (!Array.isArray(counts) && !ArrayBuffer.isView(counts)) throw new RangeError("A bag is an array of counts, one for each kind of token")
  counts.forEach((count, kind) => {
    if (!Number.isInteger(count) || count < 0) throw new RangeError(`A bag holds a whole number of tokens of each kind, got ${String(count)} of kind ${kind}`)
  })
}

/** How many tokens are in the bag, all kinds together */
export function bagSize(counts: readonly number[]): number {
  checkCounts(counts)
  return counts.reduce((sum, count) => sum + count, 0)
}

/**
 * Draws `count` tokens from the bag, one after the other, each as likely to come out as any other that is in it, and without putting them back: `drawn` lists their kinds in the order they came, and `bag` is the counts that are left. A bag that
 * holds fewer tokens gives all of them (the caller sees it in `drawn.length` and fills the bag again, from the discard, if the game says so). One draw of the stream for each token drawn, and none for an empty bag. Returns new arrays and leaves
 * `counts` alone. Throws a `RangeError` for counts that are not whole numbers and for a number of tokens that is not.
 */
export function drawFromBag(rng: Rng, counts: readonly number[], count = 1): { drawn: number[]; bag: number[] } {
  checkCounts(counts)
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`The number of tokens to draw is a whole number, none at the least, got ${String(count)}`)
  const bag = [...counts]
  const drawn: number[] = []
  let left = bag.reduce((sum, tokens) => sum + tokens, 0)
  while (drawn.length < count && left > 0) {
    // The place of the token among all those in the bag, counted kind by kind: the kind it falls in
    let place = Math.floor(rng() * left)
    let kind = 0
    while (place >= bag[kind]!) place -= bag[kind++]!
    bag[kind]!--
    left--
    drawn.push(kind)
  }
  return { drawn, bag }
}

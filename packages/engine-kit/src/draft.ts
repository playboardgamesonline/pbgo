/**
 * Drafting. In a draft every player picks a card from their hand, then the hands go on to the next player and the picking starts again, until the hands are empty (7 Wonders, Sushi Go). The picks are made at once and revealed together, which is a
 * simultaneous step (`Submissions`); what is left to do when they are in is to take each card out of the hand it came from and to turn the hands round the table, which these two helpers do. The hands are lists in seat order: `hands[seat]` is
 * the hand of the player in that seat.
 */

/**
 * The hands after they were passed `steps` seats on: the hand of the player in seat `i` goes to the player in seat `i + steps`, round the table, so one step gives each hand to the next player in seat order and a negative number gives it to
 * the player before. A number of steps that is a whole turn of the table, or none, gives the hands back where they were. A new list of the same hands: none of them is copied or changed. Throws a `RangeError` for a number of steps that is not a
 * whole number.
 */
export function passAround<Hand>(hands: readonly Hand[], steps: number): Hand[] {
  if (!Number.isInteger(steps)) throw new RangeError(`Hands are passed a whole number of seats, got ${String(steps)}`)
  const seats = hands.length
  if (seats === 0) return []
  return hands.map((_, seat) => hands[(((seat - steps) % seats) + seats) % seats] as Hand)
}

/**
 * Each player takes the card they picked: the hands without the picked cards, and the cards taken, `taken[seat]` being the card of the player in that seat. A card that is twice in a hand leaves it once, the first of them. Neither list that is
 * given is changed. Throws a `RangeError` for a table where the picks are not as many as the hands, or a pick that is not in the hand of its player, which is a bug of the game since the players pick from what they hold.
 */
export function takePicks<Card>(hands: readonly (readonly Card[])[], picks: readonly Card[]): { hands: Card[][]; taken: Card[] } {
  if (picks.length !== hands.length) throw new RangeError(`There are ${hands.length} hands but ${picks.length} picks`)
  const left = hands.map((hand, seat) => {
    const at = hand.indexOf(picks[seat] as Card)
    if (at < 0) throw new RangeError(`The pick of seat ${seat} is not in its hand`)
    return [...hand.slice(0, at), ...hand.slice(at + 1)]
  })
  return { hands: left, taken: [...picks] }
}

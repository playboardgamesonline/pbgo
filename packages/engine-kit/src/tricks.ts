/**
 * Tricks. A trick is a round of the table in which every player plays one card: the card of the player who leads sets the suit, the others follow it when they can, and the best card takes the trick (Skull King, Wizard, Hearts, Omens, Cry Baby,
 * French Tarot). The cards of a game are opaque ids in its state, so the helpers are given `suitOf` and `rankOf`, which read a card in the game's own catalogue. Nothing here keeps a state: who led and what was played is the game's to store, and
 * the helpers answer the questions about it, the same way for every game: which suit was led, which cards a player may play, who wins.
 */

/** A card played to a trick, and who played it */
export type TrickPlay<Card = string | number> = { playerId: string; card: Card }

/** What a card is to a trick: the suit it belongs to, or null when it has none (a jester, an escape: it leads no suit and follows none), and how high it ranks in its suit, a higher rank beating a lower one */
export type TrickCards<Card> = {
  suitOf: (card: Card) => string | null
  rankOf: (card: Card) => number
}

/** What the rules of a game's own are told about a trick: the suit that was led and the trump suit of the round, null when there is none */
export type TrickContext = { led: string | null; trump: string | null }

/** The rules of a trick: the cards, the trump of the round, and two ways for the special cards of a game to overrule the usual ones */
export type TrickRules<Card> = TrickCards<Card> & {
  /** The suit that beats every other suit this round (default none) */
  trump?: string | null
  /** A rule between two cards of the game's own: true when `card` takes the trick from `winning`, false when it does not, undefined to leave it to the usual rules. A wizard that beats everything is `true` for it, and `false` for any card that meets it */
  beats?: (card: Card, winning: Card, context: TrickContext) => boolean | undefined
  /** A rule for the whole trick, when no comparison of two cards gives it (Skull King's mermaid, who takes the Skull King, who takes the pirates, who take the mermaid): the winning play, or undefined to leave it to the other rules */
  decide?: (plays: readonly TrickPlay<Card>[], context: TrickContext) => TrickPlay<Card> | undefined
}

/**
 * The suit that was led: the suit of the first card played that has one. A card with no suit (a jester) leads nothing, so the next card that has a suit leads it; null while no card played has one, or none was played.
 */
export function ledSuit<Card>(plays: readonly TrickPlay<Card>[], suitOf: (card: Card) => string | null): string | null {
  for (const { card } of plays) {
    const suit = suitOf(card)
    if (suit !== null) return suit
  }
  return null
}

/**
 * The cards of `hand` that may be played to a trick whose suit is `led`, in the order of the hand: the cards of that suit when the hand holds any, every card otherwise (a hand with none of the suit may play what it likes) and every card when
 * nothing was led yet. `free` names the cards that may always be played, whatever was led (a wizard, an escape): they are playable beside the cards of the suit.
 */
export function playableCards<Card>(hand: readonly Card[], led: string | null, { suitOf, free }: { suitOf: (card: Card) => string | null; free?: (card: Card) => boolean }): Card[] {
  if (led === null || !hand.some((card) => suitOf(card) === led)) return [...hand]
  return hand.filter((card) => suitOf(card) === led || free?.(card) === true)
}

/**
 * Whether `card` takes the trick from `winning`, the card that is winning it so far, by the usual rules: a card with a suit beats one with none and one with none beats nothing; a trump beats any card that is not a trump, and a card that is
 * not a trump never beats one; two cards of one suit are told by their rank, the higher winning, and the one played first keeps a tie; a card of another suit never wins, since the one that wins is of the led suit or a trump.
 */
export function outranks<Card>(card: Card, winning: Card, { suitOf, rankOf, trump = null }: TrickCards<Card> & { trump?: string | null }): boolean {
  const suit = suitOf(card)
  const held = suitOf(winning)
  if (suit === null) return false
  if (held === null) return true
  if (trump !== null) {
    if (suit === trump && held !== trump) return true
    if (held === trump && suit !== trump) return false
  }
  return suit === held && rankOf(card) > rankOf(winning)
}

/**
 * The play that takes the trick. The plays are in the order they were made, the first being the lead. `decide` overrules for the whole trick, then each card meets the one that is winning so far, in order, through `beats` of the game and then
 * the usual rules (`outranks`): the card that survives wins. A trick in which no card has a suit is taken by the first, and so is one in which every card of another suit is off. Returns one of the plays. Throws a `RangeError` for no play.
 */
export function trickWinner<Card>(plays: readonly TrickPlay<Card>[], rules: TrickRules<Card>): TrickPlay<Card> {
  const first = plays[0]
  if (!first) throw new RangeError("A trick has at least one card played to it")
  const context: TrickContext = { led: ledSuit(plays, rules.suitOf), trump: rules.trump ?? null }
  const decided = rules.decide?.(plays, context)
  if (decided) return decided
  let winning = first
  for (const play of plays.slice(1)) {
    const own = rules.beats?.(play.card, winning.card, context)
    if (own ?? outranks(play.card, winning.card, rules)) winning = play
  }
  return winning
}

/**
 * The players in the order they play to a trick: the leader first, then the others in seat order, round to the start of the list and back to the leader's side. The winner of a trick usually leads the next one.
 * Throws a `RangeError` for a leader who is not among the players.
 */
export function playOrder(players: readonly string[], leader: string): string[] {
  const start = players.indexOf(leader)
  if (start < 0) throw new RangeError(`The leader ${leader} is not one of the players`)
  return [...players.slice(start), ...players.slice(0, start)]
}

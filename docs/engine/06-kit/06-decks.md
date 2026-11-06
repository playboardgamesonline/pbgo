# Decks

The deck helpers draw, look at, insert into, reshuffle and deal piles of cards. The module is `packages/engine-kit/src/deck.ts`. A pile is an array of cards, in practice ids ([Opaque ids](05-opaque-ids.md)), with the top first: `pile[0]` is drawn next and the last element is the bottom.

## Exports

| Export | What it does | Errors |
| --- | --- | --- |
| `Piles<T>` | The two piles of a game, `{ deck: T[]; discard: T[] }`; `T` is a numeric id unless set | |
| `draw(pile, count?)` | `{ drawn, pile }`: `count` cards from the top (one when not given), or all of them when the pile holds fewer | `RangeError` for a `count` that is not a non-negative integer |
| `peek(pile, count?)` | The `count` cards on top, left where they are | `RangeError` for a `count` that is not a non-negative integer |
| `insertAt(pile, card, position)` | The pile with `card` slid in so that `position` cards stay above it: `0` is the top, the pile's length the bottom | `RangeError` for a position outside the pile |
| `reshuffleDiscard(piles, rng, { keep? })` | Shuffles the discard and puts it under what is left of the deck; the `keep` cards on top of the discard stay | `RangeError` for a `keep` that is not a non-negative integer |
| `drawWithReshuffle(piles, count, rng, { keep? })` | `{ drawn, piles }`: draws `count` cards; when the deck runs out in the middle of the draw, reshuffles the discard once and goes on | Those of `draw` and `reshuffleDiscard` |
| `deal(pile, seats, size)` | `{ hands, pile }`: `size` cards to each seat, seat after seat from the top | `RangeError` when the pile is too short, and for `seats` or `size` that is not a non-negative integer |

## Rules

- The discard follows the same convention: its top is the card discarded last, so a card is discarded with `[card, ...discard]` or `insertAt(discard, card, 0)`, and `keep` counts from that top.
- Every function returns new arrays and leaves its input alone, so `{ ...state, ...piles }` is the state with the new piles.
- What needs a random number takes an `Rng`: restore it from the state and save its position afterwards ([Carrying a stream](../03-state-and-determinism.md#carrying-a-stream)).
- `drawWithReshuffle` never reshuffles a deck that holds exactly the cards asked for, and returns fewer only when both piles are exhausted: the game decides what that means.
- `deal` refuses to deal uneven hands, so a game checks its deck first.
- A card that goes back into hiding gets a new id before `insertAt` ([Opaque ids](05-opaque-ids.md)).

From `games/courtisans/packages/engine/src/setup.ts`, cards set aside and then a hand dealt to each seat:

```ts
const { drawn: setAside, pile: rest } = draw(shuffled, toSetAside)
const { hands, pile: deck } = deal(rest, count, HAND_SIZE)
```

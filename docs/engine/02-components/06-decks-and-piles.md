# Decks and piles

The deck helpers draw, look at, insert into, reshuffle and deal piles of cards (`packages/engine-kit/src/deck.ts`), and `Pile` draws a pile the game only counts (`packages/table/src/zone/pile.tsx`). A pile is an array of cards, in practice ids ([Opaque ids](../01-the-game/10-views.md#opaque-ids)), with the top first: `pile[0]` is drawn next and the last element is the bottom.

## Deck helpers

| Export | What it does | Errors |
| --- | --- | --- |
| `Piles<T>` | The two piles of a game, `{ deck: T[]; discard: T[] }`; `T` is a numeric id unless set | |
| `draw(pile, count?)` | `{ drawn, pile }`: `count` cards from the top (one when not given), or all of them when the pile holds fewer | `RangeError` for a `count` that is not a non-negative integer |
| `peek(pile, count?)` | The `count` cards on top, left where they are | `RangeError` for a `count` that is not a non-negative integer |
| `insertAt(pile, card, position)` | The pile with `card` slid in so that `position` cards stay above it: `0` is the top, the pile's length the bottom | `RangeError` for a position outside the pile |
| `reshuffleDiscard(piles, rng, { keep? })` | Shuffles the discard and puts it under what is left of the deck; the `keep` cards on top of the discard stay | `RangeError` for a `keep` that is not a non-negative integer |
| `drawWithReshuffle(piles, count, rng, { keep? })` | `{ drawn, piles }`: draws `count` cards; when the deck runs out in the middle of the draw, reshuffles the discard once and goes on | Those of `draw` and `reshuffleDiscard` |
| `deal(pile, seats, size)` | `{ hands, pile }`: `size` cards to each seat, seat after seat from the top | `RangeError` when the pile is too short, and for `seats` or `size` that is not a non-negative integer |

- The discard follows the same convention: its top is the card discarded last, so a card is discarded with `[card, ...discard]` or `insertAt(discard, card, 0)`, and `keep` counts from that top.
- Every function returns new arrays and leaves its input alone, so `{ ...state, ...piles }` is the state with the new piles.
- What needs a random number takes an `Rng`: restore it from the state and save its position afterwards ([Carrying a stream](../01-the-game/09-state.md#carrying-a-stream)).
- `drawWithReshuffle` never reshuffles a deck that holds exactly the cards asked for, and returns fewer only when both piles are exhausted: the game decides what that means.
- `deal` refuses to deal uneven hands, so a game checks its deck first.
- A card that goes back into hiding gets a new id with `reissueId` before `insertAt`.

From `games/courtisans/packages/engine/src/setup.ts`, cards set aside and then a hand dealt to each seat:

```ts
const { drawn: setAside, pile: rest } = draw(shuffled, toSetAside)
const { hands, pile: deck } = deal(rest, count, HAND_SIZE)
```

## Pile

`Pile` is a stack of cards the game only counts: a deck, a discard pile. It is a [Zone](07-zones.md#zone) over `pile` whose cards are all face down but the top one, when it is given a front. For a pile of cards the game names, use a `Zone` over `pile(n, { face: "up" })`.

`PileProps` takes the options of `pile` but `face` and `topFace` (`y`, `step`, `lean`, `leanAmplitude`, `scale`: see [Layout helpers](08-layout-helpers.md)), and:

| Prop | Role |
| --- | --- |
| `frame` | Where the pile lies, a `Spot`; the middle of the table when not given |
| `count` | How many cards it holds |
| `size` | The `CardSize` of every card |
| `back` | The texture of the back of the cards |
| `top` | The top card turned up, a `PileTop`: give it a `front`. Without one the whole pile lies face down |
| `limit` | The most cards drawn; `LIMIT` in `pile.tsx` when not given |
| `enter`, `stagger` | Where the cards come in from, and the seconds between two ([Zone](07-zones.md#zone)) |

`PileTop` is the props of a [Card](04-cards.md#card), all optional, but `target`, `size` and `back`: its `front`, and whatever else a card takes, such as a `glow` or an `onClick`. A `glow` and a `gloss` show on a card that lies face up only ([Glows](04-cards.md#glows)): a deck that lights up on the viewer's turn gives its top card the back for its `front`.

Turn the top card up, draw one, and push the count past the limit: a taller pile looks no different.

```specimen
scene-pile
```

- `count` is rounded down and held between zero and `limit`: a taller pile looks no different and costs a card each to draw.
- The cards are keyed by their height in the pile: when the top card changes, the one below turns face down where it lies.
- Give the top card the `id` of the card it shows, and a card played onto a discard pile starts from where it was ([Pose memory](05-poses-and-motion.md#pose-memory)). A card is known by the `id` it has when it mounts, and the card that becomes the top after a draw came without one: say where each drawn card starts with its `from` ([Zone](07-zones.md#zone)), as the specimen does.
- `lean` on a pile turns each card a hair by its own number, the same on every client ([Poses](05-poses-and-motion.md)).
- The template draws no pile: its `DECK_POSE` in `template/src/components/board/layout.ts` is only where its cards enter from.

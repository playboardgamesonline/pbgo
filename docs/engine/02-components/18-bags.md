# Bags

A bag holds tokens of several kinds and nobody can say which one comes out next: the tiles of Azul and of Scrabble, the chips of a bag-building game. The engine keeps how many tokens of each kind are in it and draws from the seeded stream; the table draws a `Bag`, and the token that is drawn comes out of its mouth and flies to its place. The bag slumps as it empties and rocks when a hand rummages in it. The table's side is `packages/table/src/bag/`, the engine's is `bag.ts` of the kit.

Press the bag, or draw tokens with the buttons: each comes out of its mouth into the row, the counter says how many are left, and the bag slumps. Put them back and draw again: the same stream gives the same draws.

```specimen
scene-bag
```

## The parts of a bag

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Kinds | What the tokens are: colours, letters, values. Numbers from 0, and the game keeps the list of what each is | The game's data, in its engine and its Sanity project |
| Counts | How many tokens of each kind are in the bag | The state: an array of whole numbers |
| Draw | Which tokens come out, at random | `drawFromBag` of the kit, from the seeded stream |
| Bag | The cloth, its mouth, how full it looks | `Bag` |
| Tokens | What was drawn and goes where the game says | `Piece`s that appear at `bagMouth` and fly to their places |

## In the engine

The state holds the counts, as an array indexed by kind, and nothing else: no list of tokens, no object keyed by kind (an order always comes from an array, [Lean state](../01-the-game/09-state.md#lean-state)). `drawFromBag` draws tokens at random, each as likely to come out as any other that is in the bag, and without putting them back:

| Export | What it does | Errors |
| --- | --- | --- |
| `bagSize(counts)` | How many tokens are in the bag, all kinds together | `RangeError` for counts that are not whole numbers |
| `drawFromBag(rng, counts, count = 1)` | Draws `count` tokens: `drawn` lists their kinds in the order they came and `bag` is the counts that are left. A bag that holds fewer gives all it has, and an empty one gives none. One number of the stream for each token drawn. New arrays: `counts` is left alone | `RangeError` for counts that are not whole numbers and for a number of tokens that is not |

```ts
// Azul: the five kinds of tile, a bag of twenty of each; four tiles go to a factory, and the bag is filled again from the discard when it runs out
// (`countsOf` is the game's own: how many tiles of each kind a pile holds)
const rng = restoreRng(state.rng)
let { drawn, bag } = drawFromBag(rng, state.bag, 4)
if (drawn.length < 4) {
  const refill = drawFromBag(rng, countsOf(state.discard), 4 - drawn.length)
  drawn = [...drawn, ...refill.drawn]
  bag = refill.bag
}
state.bag = bag
state.rng = rng.save()
events.push({ type: "filled", factory, tiles: drawn })
```

- Like a shuffle, a draw is a use of the stream: the same seed and the same actions draw the same tokens on every machine, and a client that reads the view cannot know the next one. Save the position of the stream after the last draw of a step, as for any roll ([Random numbers](../01-the-game/09-state.md#random-numbers)).
- The view tells the others how many tokens are left (`bagSize`), not which: a token that nobody has seen is a secret, and one that was drawn in public is in the view of everybody.
- A bag is a deck of tokens that are not told apart, so a bag of tokens that are each their own (cards with a name, tiles with an id) is a [deck](06-decks-and-piles.md) of ids, which keeps an order the game may peek at. The bag has no order: it is the right model when only the kind matters.
- Putting tokens in is the game's: it adds to `counts[kind]`, and the bag is as full as the sum says.

## On the table

### Bag

`packages/table/src/bag/bag.tsx`. The props are `BagProps`:

| Prop | Role |
| --- | --- |
| `at` | `{ x, z, yaw? }`: where the bag stands on the table |
| `size` | The width of the bag across its belly, in world units (default `BAG_SIZE`). Its height follows |
| `fill` | How full the bag is, from 0 to 1 (default 1): a bag that is nearly empty slumps, and swells as it fills. The game works it out from the tokens that are left |
| `color` | The colour of the cloth: the dark of its mouth and the cord of its neck are darker |
| `shake` | A number or a word that the game changes at each draw: when it changes after the bag appeared, the bag rocks, as when a hand rummages in it. Use something every player sees alike, such as the count of draws |
| `halo` | A ring on the table round the bag, in this colour, that pulses: the bag can be pressed |
| `shadow` | Casts a drop shadow (default true) |
| `onClick`, `onHover` | Make the bag a click target ([Clicks and hover](../01-the-game/05-actions.md#clicks-and-hover)) |

`bagMouth(at, size, fill)` gives the middle of the mouth of a bag, as `{ x, y, z }`: give it to the `from` of the `Piece` that is drawn and the piece flies from the mouth to its place. A bag that has slumped has its mouth lower, so give the same `fill` as the bag's.

```tsx
const fill = view.left / view.total

<Bag at={bagAt} fill={fill} shake={view.draws} halo={canDraw ? ring : null} onClick={() => canDraw && post({ type: "draw" })} />
{view.row.map((kind, i) => (
  <Piece key={i} id={`token-${i}`} model="disc" color={kindColour[kind]} at={slot(i)} from={bagMouth(bagAt, BAG_SIZE, fill)} />
))}
<Counter value={view.left} at={countAt} />
```

### How a bag moves

- The bag slumps to a fraction of its height as it empties, and swells back as it fills, with a time of its own (`slump`). A bag that is empty stays a flat pouch.
- When `shake` changes the bag rocks and squashes a little, and the rocking dies away. The first value is not a change: a bag that appears does not rock.
- A token that is drawn is a new `Piece` that appears with a `from`: it flies from the mouth to its place along the curve of a card's flight ([Pieces](13-pieces.md#how-a-piece-moves)).
- The bag carries its own light, so it needs none from the table. A visitor who asks for less motion sees it in its new shape at once, and it does not rock.

### Settings

`BAG_SETTINGS` is read on every frame by every bag: how far and how long it rocks, how fast it slumps, and its shadow. The debug panel has a Bag folder for it ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- A token that goes into the bag: a piece that leaves the table is not animated, so it disappears where it is. A game that wants it to go in moves it to `bagMouth` first.
- A hand that reaches into the bag, or a bag that opens to show what is in it.
- A bag that is pressed and held: pressing it draws, once.
- Dragging a token out of the bag: pressing the bag draws, and which token comes out is the engine's, so a drag would choose nothing. The token that came out is a `Piece`, which can be dragged on from where it lies ([Dragging](19-dragging.md)).

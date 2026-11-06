# Opaque ids

A card that clients can see face down, in a hand or in a pile is shown under an id, a number that says nothing about the card or its place. The module is `packages/engine-kit/src/ids.ts`. The state holds one table, `ids`, aligned with the game's catalogue: `ids[card]` is the id the card at index `card` holds now, and piles, hands and tables hold ids only.

## Exports

| Export | What it does | Errors |
| --- | --- | --- |
| `ID_SPACE` | The size of the id space: ids are non-negative integers below it, and it is the widest a stream can fill | |
| `issueIds(count, rng, space?)` | The ids of `count` cards, all different, in catalogue order: the first `ids` table of a game | `RangeError` for a `count` that is not a non-negative integer, a `space` that is not an integer between one and `ID_SPACE`, or more cards than ids |
| `reissueId(ids, id, rng, space?)` | Gives the card that holds `id` a new id that no card holds; returns `{ ids, fresh }`, the new table and the new id | `RangeError` for an id the table does not hold, and when every id of the space is held |
| `reissueIds(ids, held, rng, space?)` | The same for several cards: `fresh[i]` replaces `held[i]` | Those of `reissueId`, and an id listed twice |
| `cardOf(ids, id)` | The index in the catalogue of the card that holds `id`, or `-1` | |

## Rules

- A card that goes back into hiding after it was seen gets a new id from `reissueId`, so nobody can follow it from what they saw.
- Put `fresh` wherever the card is after the move: the old id must not stay anywhere in the state.
- The ids' stream is a side stream ([Carrying a stream](../03-state-and-determinism.md#carrying-a-stream)): keep its position in the state when the game reissues.
- `issueIds` draws one number per id, and another when an id is taken, so the same stream issues the same ids.
- A retired id is not remembered: by chance it can be issued again.
- A game that shows its ids in a fixed format asks for a smaller `space` (`assignOpaqueIds` of Courtisans).

From `games/exploding-kittens/packages/engine/src/machine.ts`, the helper of a step that sends a card back into hiding:

```ts
/** `id` goes back into hiding: it holds a new id, which nobody has seen. Gives the new one. */
export function reissue(ctx: Ctx, id: number): number {
  const { ids, fresh } = reissueId(ctx.s.ids, id, ctx.idsRng)
  ctx.s.ids = ids
  return fresh
}
```

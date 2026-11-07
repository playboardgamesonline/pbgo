# Views

A view is what one viewer sees of a game: `GAME.view(state, playerId)`. The `State` is read by the server only (the `state` column of `games` has row level security and no policy), so the view is all a browser gets of it.

## What is public

- `PublicGame` (`packages/core/lib/game-types.ts`) is what a browser receives of a table: its code, host, `status`, `players` (id, nickname and the picture of their account, if any), `options`, `replay` (who voted for a rematch), `waitingFor`, `present` and `takeovers`, a few more fields of core's, and the `view`.
- `waitingFor`, `present` and `takeovers` are public: every viewer gets them.
- `view` gets the viewer's id when they sit at the table and `null` for everybody else. The read route needs no cookie, so a view must be safe to show to anybody.
- Neither the seed nor a saved stream position is in a view.

## What core reads from a view

Core reads four optional fields of a view (`CoreView` in `packages/core/lib/binding.ts`); the server reads none.

- `phase`: a string; the shared UI takes `"over"` for the end of the game.
- `results`: see [Results](06-victory.md#victory-and-results).
- `me`: `{ id: string }` for the viewer, `null` for a spectator; the ticker's "your turn" and the takeover pill need `me.id`.
- `log`: a list; only its length is read, to pick the victory phrase.

## Hidden information

The state keeps every secret of a game; the view returns what that viewer may see and nothing more: no other player's hand, no secret answer, no order of a pile. Test it for every kind of viewer. From `template/packages/engine/src/demo/game.test.ts`, a player sees their own hand and nobody else's, and a spectator has no `me`:

```ts
const view = demo.view(e, "j1")
expect(view.me?.hand).toEqual(e.players[1]!.hand)
expect(JSON.stringify(view)).not.toContain(e.players[0]!.hand[0]!.id + '"')
expect(demo.view(e, null).me).toBeNull()
```

## Opaque ids

A card that clients can see face down, in a hand or in a pile is shown under an id, a number that says nothing about the card or its place. The module is `packages/engine-kit/src/ids.ts`. The state holds one table, `ids`, aligned with the game's catalogue: `ids[card]` is the id the card at index `card` holds now, and piles, hands and tables hold ids only.

| Export | What it does | Errors |
| --- | --- | --- |
| `ID_SPACE` | The size of the id space: ids are non-negative integers below it, and it is the widest a stream can fill | |
| `issueIds(count, rng, space?)` | The ids of `count` cards, all different, in catalogue order: the first `ids` table of a game | `RangeError` for a `count` that is not a non-negative integer, a `space` that is not an integer between one and `ID_SPACE`, or more cards than ids |
| `reissueId(ids, id, rng, space?)` | Gives the card that holds `id` a new id that no card holds; returns `{ ids, fresh }`, the new table and the new id | `RangeError` for an id the table does not hold, and when every id of the space is held |
| `reissueIds(ids, held, rng, space?)` | The same for several cards: `fresh[i]` replaces `held[i]` | Those of `reissueId`, and an id listed twice |
| `cardOf(ids, id)` | The index in the catalogue of the card that holds `id`, or `-1` | |

- A card that goes back into hiding after it was seen gets a new id from `reissueId`, so nobody can follow it from what they saw. Put `fresh` wherever the card is after the move: the old id must not stay anywhere in the state.
- The ids' stream is a side stream ([Carrying a stream](09-state.md#carrying-a-stream)): keep its position in the state when the game reissues.
- `issueIds` draws one number per id, and another when an id is taken, so the same stream issues the same ids. A retired id is not remembered: by chance it can be issued again.
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

## Per-viewer log

Some of what happens is private: the card a player looks at, the card a Favor gives. A log entry holds the event in full for the players it concerns and a masked version for everybody else, and the kit filters the entries for one viewer. The module is `packages/engine-kit/src/log.ts`.

| Export | What it does |
| --- | --- |
| `LogEntry<E>` | One thing that happened: `event` in full, `to` the players who see it in full (absent: everybody), `masked` what everyone else sees instead (absent: nothing) |
| `viewLog(entries, viewerId)` | The log as that viewer reads it, oldest first: the full event when the entry is public or addressed to them, else its `masked` version, else nothing |

- `viewLog` does not throw. `viewerId` is `null` for a spectator, and a player who is not at the table is read like one; `to: []` shows the event in full to nobody, so everyone sees only its `masked` version.
- `event` and `masked` are plain data, never display text: the client turns them into sentences in the viewer's language.
- The log is not in the state ([Lean state](09-state.md#lean-state)): `viewLog` only filters, wherever the entries are kept.
- An engine builds its entries in its own `step`, which returns them next to the state, and `apply` keeps the state (Flip 7, Exploding Kittens). Exploding Kittens adds one with `emit(ctx, event, to, masked)` (`games/exploding-kittens/packages/engine/src/machine.ts`): the card a Favor gives is shown in full to the two players, and the others see who gave to whom.
- Test an entry for the players it is addressed to, the others and a spectator, as a view ([Hidden information](#hidden-information)).

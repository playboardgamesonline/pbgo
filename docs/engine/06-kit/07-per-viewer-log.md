# Per-viewer log

Some of what happens is private: the card a player looks at, the card a Favor gives. A log entry holds the event in full for the players it concerns and a masked version for everybody else, and the kit filters the entries for one viewer. The module is `packages/engine-kit/src/log.ts`.

## Exports

| Export | What it does |
| --- | --- |
| `LogEntry<E>` | One thing that happened: `event` in full, `to` the players who see it in full (absent: everybody), `masked` what everyone else sees instead (absent: nothing) |
| `viewLog(entries, viewerId)` | The log as that viewer reads it, oldest first: the full event when the entry is public or addressed to them, else its `masked` version, else nothing |

Neither throws.

## Rules

- `viewerId` is `null` for a spectator, and a player who is not at the table is read like one.
- The others see `masked` or, when it is missing, nothing; `to: []` shows the event in full to nobody, so everyone sees only its `masked` version.
- `event` and `masked` are plain data, never display text: the client turns them into sentences in the viewer's language.
- The log is not in the state ([Lean state](../03-state-and-determinism.md#lean-state)): `viewLog` only filters, wherever the entries are kept.
- An engine builds its entries in its own `step`, which returns them next to the state, and `apply` keeps the state (Flip 7, Exploding Kittens).
- Test every kind of viewer: the players an entry is addressed to, the others and a spectator ([Hidden information](../03-state-and-determinism.md#hidden-information)).

From `games/exploding-kittens/packages/engine/src/actions.ts`, where `emit(ctx, event, to, masked)` adds an entry to the step: the card a Favor gives is shown in full to the two players, and the others see who gave to whom.

```ts
emit(ctx, { kind: "give", from: by, to: phase.to, card: faceOf(ctx, card) }, [by, phase.to], { kind: "give", from: by, to: phase.to })
```

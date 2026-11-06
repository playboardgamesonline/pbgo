# Pose memory

A card that changes zone is not the same React element: it unmounts from one `Zone` and mounts in another. The pose memory lets the new one start from where the old one was instead of popping into place. Shared, and internal to `Table` and `Card`: `packages/table/src/table/memory.ts`, carried to the cards by `memory-context.tsx`. A game only gives a card an `id`, a `CardId` (a string or a number). Each `Table` has one memory.

Press a card to move it to the other zone: it is a new element there with the same `id`, and it flies from where it was.

```specimen
scene-pose-memory
```

## How a card is remembered

1. A card with an `id` that leaves the table writes down where it was, in the world.
2. A card with the same `id` that mounts within `maxAge`, in another zone, asks for it: the memory hands back that pose, put in the frame of the new card's parent, and the card starts there.
3. The card flies when that pose is farther than `JUMP` from its `target`, and glides when it is nearer ([Flight and fold](09-flight-and-fold.md)).

From `packages/table/src/card/card.tsx`, the mount of a card:

```ts
const left = memory && id !== undefined ? memory.recall(id, g, target) : null
const p = from ?? left ?? target
```

## Rules

- Give a card the game's own id for it, stable and unique at the table. The template uses a card's id as its `key` and its `id` both in the hand and in the middle, so a card a player plays flies from the hand to the middle with no `from` written.
- A given `from` wins over the memory, but the sighting is still taken out, so an old one never misleads a later card.
- A sighting is handed back once, and only while it is fresh: the memory forgets after a time (`maxAge`) and keeps a bounded number of sightings (`capacity`), the oldest going first. `Table` uses the defaults of `createPoseMemory`.
- A card that is already where it should be (same place, orientation and scale, within a hair) gets nothing back, so it does not fly.
- A card with no `id` is not remembered, and a `Card` outside a `Table` has no memory to ask.
- A card reads its `id` once, when it mounts. If the `id` of a card that stays changes, the memory still knows it by the first one, or not at all when it came with none.
- The memory holds poses, not cards: it keeps nothing alive.

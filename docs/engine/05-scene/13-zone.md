# Zone

A zone is some cards on the table in a layout: the first card takes the first slot, the second the second, and so on, all drawn in the frame of the zone. Shared: `packages/table/src/zone/zone.tsx`. A hand, a player's cards and the middle of the table are all zones.

## Props

| Prop | Role |
| --- | --- |
| `frame` | Where the zone lies and which way it faces, a `Spot`; the layout is drawn in it. The table itself when not given |
| `layout` | The slots, one `Pose` per card, in the frame of the zone: `fan`, `row`, `pile`, `grid` or the game's own |
| `size` | The `CardSize` of every card of the zone |
| `enter` | Where a card with no `from` of its own comes in from, on the table and not in the frame: the deck a hand is dealt from |
| `stagger` | The seconds between two cards coming in from `enter`; zero sends them together |
| `cards` | The cards, in the order of the slots, as `ZoneCard`s |

A `ZoneCard` is the props of a [Card](06-card.md) but `target` and `size`, which the zone gives, plus a React `key`. `ZoneProps` is the type of the props.

## Three zones of a board

| Zone | `frame` | `layout` | In the template |
| --- | --- | --- | --- |
| The viewer's hand | None, the table | A `fan` in front of the viewer | `handLayout` |
| A player's cards | The player's seat, from `seats` | A `row` of backs, a `fan`, a `grid` | `backFrame`, `backLayout` |
| A shared zone, the middle of the table | None | The game's own, one pose per card | `trickPose`, `collectedPose` |

The three zones of a table, each a `Zone` with its own frame and layout, named on the mat.

```specimen
scene-zones
```

## Rules

- Card `i` takes slot `i`. A card with no slot is not drawn, and a slot with no card stays empty.
- A zone owns no state: the game decides which cards are in it and in what order.
- A card keeps its `key` from one render to the next, so it glides from slot to slot instead of flying in again. A card that changes zone is a new element: give it the same `id` in both zones, and the [pose memory](10-pose-memory.md) does the rest.
- A card comes in from `enter` a `stagger` after the one before it, counted from the first card of the zone: a card that joins later waits for its place in the list. Its own `from` wins, and `from` set to `null` keeps the zone from adding an entrance. An entrance only plays when a card mounts.
- A zone is a toolbox the game composes, not a declarative board: one `Zone` per area, with the layout and the cards the game computes from its view.
- `place` and `STAGGER` of `zone/place.ts` are internal: they work out each card's `target` and `from`, and `place.test.ts` states how.

From `template/src/components/board/scene.tsx`, the cards an opponent holds, seen from behind:

```tsx
<Zone
  frame={backFrame(s)}
  layout={backLayout(s, j.cardCount)}
  size={CARD_SIZE}
  enter={DECK_POSE}
  cards={Array.from({ length: j.cardCount }, (_, i) => ({ key: `back-${j.id}-${i}`, front: back, back }))}
/>
```

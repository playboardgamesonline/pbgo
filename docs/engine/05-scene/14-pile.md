# Pile

A pile is a stack of cards the game only counts: a deck, a discard pile. Shared: `packages/table/src/zone/pile.tsx`, a [Zone](13-zone.md) over `pile` whose cards are all face down but the top one, when it is given a front. For a pile of cards the game names, use a `Zone` over `pile(n, { face: "up" })`.

## Props

`PileProps` takes the options of `pile` but `face` and `topFace` (`y`, `step`, `lean`, `leanAmplitude`, `scale`: see [Layout helpers](12-layout-helpers.md)), and:

| Prop | Role |
| --- | --- |
| `frame` | Where the pile lies, a `Spot`; the middle of the table when not given |
| `count` | How many cards it holds |
| `size` | The `CardSize` of every card |
| `back` | The texture of the back of the cards |
| `top` | The top card turned up, a `PileTop`: give it a `front`. Without one the whole pile lies face down |
| `limit` | The most cards drawn; `LIMIT` in `pile.tsx` when not given |
| `enter`, `stagger` | Where the cards come in from, and the seconds between two ([Zone](13-zone.md)) |

`PileTop` is the props of a [Card](06-card.md) but `key` and `back`: its `front`, and whatever else a card takes, such as a `glow` or an `onClick`.

## Rules

- `count` is rounded down and held between zero and `limit`: a taller pile looks no different and costs a card each to draw.
- The cards are keyed by their height in the pile. When the top card changes, the one below turns face down where it lies. That suits cards the game only counts; a discard pile whose cards must stay readable is a `Zone`.
- Give the top card the `id` of the card it shows, and a card played onto a discard pile starts from where it was ([Pose memory](10-pose-memory.md)).
- `lean` on a pile turns each card a hair by its own number, the same on every client ([Poses](11-poses.md)).
- The template draws no pile: its `DECK_POSE` in `layout.ts` is only where its cards enter from.

From `packages/table/src/zone/pile.tsx`, what a pile asks of `pile`:

```tsx
const n = Math.max(0, Math.min(Math.floor(count), limit))
const layout = pile(n, { ...options, face: "down", topFace: top?.front ? "up" : "down" })
```

# Opening and ending

The shared tools give an opening one piece, the camera's entrance, and an ending none: the sequences around a game are written per game. The template has neither. It announces the start and the victory and shows the game over. This page says what a sequence can be built on, and how a board that has them does it.

## What the tools give

- The camera's entrance ([The entrance](02-camera.md#the-entrance)): it plays when the `Table` mounts, and again when `playIntro` turns true after being false.
- Cards that come in one after the other: `enter` and `stagger` of a [Zone](13-zone.md), or a `from` pose with a `delay` on a card.
- The `start` and `victory` announcements and the `GameOver` panel, which the shared UI draws over the board ([Announcements](../../design/04-in-game/06-announcements.md), [Game over](../../design/04-in-game/07-game-over.md)). The template announces the start when a game begins and the victory when `phase` is `over`, then shows `GameOver` once the announcement is done.
- The photo of the finished table for the share image ([Share photo](05-share-photo.md)).

## A sequence of the game's own

A sequence is a state in the game's component, not something in `@pbgo/table`. The board of Courtisans has two, in `games/courtisans/src/components/game/game.tsx` and `game3d/`. The opening is a step that the board moves forward with timers once the scene reports it is mounted (`onReady`). From `games/courtisans/src/components/game3d/scene.tsx`:

```ts
export type OpeningStep = "unroll" | "deal" | "missions" | null
```

- The scene reads the step to decide what to draw and where cards come from: the mat unrolls, the cards are dealt, the missions are shown.
- Its pieces are written in the same file: a mat with a shader and a roller that unroll it, a pile that drops card by card (`DrawPile`) and a group that rises out of the table with a height fade (`Appear`, `withFade`).
- The ending is `useEndingSequence` in `game3d/ending.ts`: a list of steps, each a time and a patch of an `EndingState`, played with timers once the game is over. The scene reads that state to draw each step (`game3d/ending3d.tsx`), and a button jumps to the final state.
- Both start from the view, not from a click; a visitor who reloads during one sees it again from its start.
- The announcement queue is held while the opening runs (`paused` of `useAnnouncements`), and the debug panel replays each sequence, the ending step by step ([Tuning](24-tuning.md)).

## Rules

- Time belongs to the board. An engine has no clock ([Limits](../04-turns-and-absent-players.md#limits)), so a timer lives in a component, and the state it advances is presentation only.

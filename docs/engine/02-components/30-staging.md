# Staging

What a board does with time on the table, beyond the moves of the players: a **sequence**, a short film made of states (the end of a game, an opening), an **appear**, something that comes onto the table, and a **veil**, the dark that makes one thing stand out. None of them is the engine's: nothing here is kept or sent, a visitor who comes in late or reloads has the whole of it again, and what the engine says (the game is over, here are the results) is what a sequence starts from. Shared: `packages/table/src/staging/`, with what is pure in `sequence.ts`, `appear-look.ts` and `veil-look.ts`, tested in `sequence.test.ts` and `staging.test.ts`.

The end of a game, as a sequence: the points of each card come down onto the table one by one, then the table goes dark and the winner is lit. Play it again, and change its pace.

```specimen
scene-staging
```

## Sequence

A sequence is a state that changes on a clock. A board starts in `start`, and each step changes a part of it at its moment, so the board draws the state it is given and the sequence is its clock: the numbers that come up one by one, the dark, the title are fields of the state (`shown`, `veil`, `title`) and the scene reads them.

`useSequence({ active, start, final, steps, key })` plays it and gives `{ state, skip, replay, hold, length }`:

| Field | Role |
| --- | --- |
| `active` | Whether it plays. When it turns true the sequence starts from `start`; while it is false the sequence is over and `state` is null, so a board draws its own state meanwhile |
| `start`, `final` | The state before anything has happened, and the state it ends in, which `skip` jumps to and which a visitor who asks for less motion gets at once |
| `steps` | `[at, patch]` pairs: the milliseconds from the start, and the part of the state that changes then. They may be written in any order, and two at the same moment keep the order they were written in (`inOrder`) |
| `key` | Another value than the last starts the sequence again: a game whose steps depend on something, such as how many piles there are, says it here |
| `skip()` | Jumps to `final` and cancels what is left to happen |
| `replay()` | Plays it again from its start |
| `hold(count)` | Holds it after the first `count` steps; nothing more happens until `replay`. For a debug panel that goes through it step by step |

- **The numbers behind it are pure.** `stateAfter` (the state after a number of steps), `stateAt` (the state at a moment), `inOrder` and `sequenceEnd` (when the last step happens) are tested without a canvas, and a board can use them to draw a frame of the sequence without playing it.
- **It plays with timers.** One timer for each step, set when the sequence starts and cleared when it ends, is skipped, or is played again. A sequence is not an animation: it says what the state is, and the pieces that draw the state animate themselves (`Appear`, a counter that counts up).
- **Reduced motion.** A visitor who asks for less motion (`usePrefersReducedMotion`) gets `final` at once, with nothing played.

## Appear

`Appear` is something that comes onto the table: it waits `delay`, then comes in over `duration`, fading in and coming down by `drop`, fast at first and settling (a cubic ease-out: `appearAt`).

| Prop | Role |
| --- | --- |
| `entering` | Whether it comes in (default true): the entrance plays from its start when this turns true and, while it is true, from the first frame it is drawn. While it is false what is inside is simply there |
| `drop` | How far above its place it starts, in world units (default 0: it fades in where it is). It comes down as it comes in |
| `delay`, `duration` | Seconds it waits before it begins and takes to come in (`APPEAR`: 0 and 0.6) |

- **Not seen before its delay.** An entrance that waits is hidden until its delay has passed, and has not come in at that moment.
- **What it fades.** The materials under it that have an opacity, which is all of the table's flat ones (lettering, glyphs, planes). It remembers what each was and gives it back when the entrance is over, and leaves it alone after that, so what a game does to its materials later is its own. A material a game shares with something that is not entering is faded with it: give an entrance its own.
- **Order.** A piece under it that sets its own opacity every frame, as `TableText` does, is set first and faded after, since a parent's frame runs after its children's.
- **Reduced motion.** A visitor who asks for less motion gets what is inside as it is, at once.

## Veil

`Veil` is the dark the table is put in so that one thing stands out: the missions a player reads, the winner at the end of a game. It is a plane in front of the camera, which follows it, drawn after what is on the table and dimming all of it.

| Prop | Role |
| --- | --- |
| `active` | Whether the table is dark: it comes on when this turns true and goes when it turns false |
| `opacity` | How dark, 0 to 1 (`VEIL.opacity`, 0.5) |
| `fade`, `away` | Seconds it takes to come on (`VEIL.fade`, 0.2) and to go (`VEIL.away`, 0.2): the time constant of its easing (`veilTarget`) |
| `color` | Its colour, black unless the game says another: a very dark colour of its own is a quieter dark than black |

- **What stays lit.** What is drawn after the veil is not dimmed: a piece that is transparent and has a `renderOrder` above `VEIL.order` (10), which is what lettering, glyphs and planes are. `TableText` takes it as `layer`, and the title of the specimen is lit that way.
- **A card is dimmed.** A card is drawn in the opaque pass, before the veil, so the veil dims it whatever its order. A game that keeps a card lit while the table is dark draws a transparent copy of it above the veil.
- **No click.** The veil takes none, and is not drawn while it is nothing. A visitor who asks for less motion gets it at once.

## Limits

- A sequence is the view's: it is not saved, and a visitor who reloads at the end of a game sees it from its start unless the board says otherwise (`active`, or `skip` for one who has seen it). What the engine decided is in the results, not in the film.
- The sequence changes a state and does not draw: the board that reads it does.

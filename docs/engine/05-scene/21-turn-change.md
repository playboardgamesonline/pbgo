# Turn change

There is no turn-transition component. A turn changes the way everything on a board does: the view changes, and each piece that depends on whose turn it is follows. Per game: the template's `board/scene.tsx` and `game/game.tsx` are the reference. The announcement and the ticker are the shared UI's.

## What follows the turn

| Piece | What it does | Page |
| --- | --- | --- |
| The aura | Lights the seat of the player whose turn it is, and fades from the one before | [Aura](16-aura.md) |
| The crown | Grows beside the nickname of the player whose turn it is, and shrinks away from the one before | [Crown and the turn marker](17-crown.md) |
| The hand | Takes clicks and the hover glow only on the viewer's turn | [Clicks and hover](20-clicks-and-hover.md) |
| The cards played | Fly from where they were to the middle | [Pose memory](10-pose-memory.md) |
| The trick won | Rests in the middle, then flies to its winner's side (`useCollect` in `scene.tsx`, `collectedPose` in `layout.ts`) | [Zone](13-zone.md) |
| The announcement | `turn`, with its sound, when the turn comes to the viewer | Below |
| The ticker | Names the player the game waits for; a strip lists several | [Players strip](../../design/04-in-game.md#players-strip) |

## The announcement

The board watches the view in an effect and announces when the viewer's turn begins. From `template/src/components/game/game.tsx`:

```tsx
if (myTurn && (before?.active !== view.activePlayerId || before?.round !== view.round))
  announce(t("yourTurn"), "turn", { sound: "turn", replace: ["turn"], seats: seatsFor(meId ? [meId] : []) })
```

- `replace: ["turn"]` drops a `turn` announcement that is still queued, so a quick succession shows the latest. `useAnnouncements` can also be `paused`, which holds the queue while something else, an opening for instance, has the screen ([Opening and ending](22-opening-and-ending.md)).
- The kinds are `start`, `round`, `turn` and `victory`; their look is `UI_THEME.announcement` ([Announcements](../../design/04-in-game.md#announcements)).
- The TRANSITION tab of the debug panel holds the presets of the four kinds and a "Replay" folder with a button for each: the way to see a turn change without playing one ([Tuning](24-tuning.md)).

## Rules

- The scene learns that the turn changed from the view (`activePlayerId` in the template's view), never from a timer or from its own click.
- A player can leave `waitingFor` without having acted, because somebody played for them: follow the view ([What the game waits for](../04-turns-and-absent-players.md#what-the-game-waits-for)).
- A step the game waits several players for has no single active player. The strip of the ticker lists who is pending; a crown or an aura per waiting seat is the game's choice.

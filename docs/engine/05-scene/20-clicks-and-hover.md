# Clicks and hover

The scene takes the pointer through react-three-fiber events on meshes. `Card` is the shared piece that reports it; the rest is what a game adds. The template's `board/scene.tsx` is the reference.

## What takes events

| Piece | Events | Cursor |
| --- | --- | --- |
| `Card` | `onClick` and `onHover`, on its face, its rim and its back | A pointer while hovered, when it has an `onClick` |
| `TableText` | `onClick` and `onHover`, only when one is given | A pointer while hovered, when it has an `onClick` |
| A click target the game adds | Its own handlers, on a mesh it draws | `useCursor` of drei |

## Rules

- Everything that decorates takes no events. The picture of the table, the parts of a glow, the shadow and the shine of a card, `Aura`, `SeatAvatarMesh` and `TurnCrown` all set `raycast={() => null}`. A decoration a game adds does the same, or it steals the click from what lies under it.
- A hovered card stops the event, so only the front-most card is hovered. A click handler stops it too, so the click does not also reach what lies behind: the template's does.
- Hover is reported, not shown. The game keeps the id of the hovered card, moves the pose (`shifted`) and sets `glow` or `gloss`. The template lifts the hovered card of the hand and gives it the selection glow, on the viewer's turn only.
- A card the viewer may not click has no `onClick`, and its cursor stays an arrow: the template passes `onClick` only on the viewer's turn.
- `Table` has no prop for a click on empty space; the `onPointerMissed` of its canvas is not passed on.
- Hover has no touch equivalent: game pages are desktop only ([Desktop only](../../design/04-in-game/01-screens-and-game-flow.md#desktop-only)).

From `template/src/components/board/scene.tsx`, the click that plays a card of the hand:

```tsx
onClick: myTurn
  ? (e) => {
      e.stopPropagation()
      setHovered(null)
      onPlay(c.id)
    }
  : undefined,
```

## Click targets

A place on the table that the player clicks, such as a column of the board or a player's area, is not a shared piece. It is a flat mesh over the table with `onClick`, `onPointerOver`, `onPointerOut` and `useCursor`, drawn only while the move is possible. A board that has them: `ClickableZone`, an invisible plane just above a zone, in `games/courtisans/src/components/game3d/scene.tsx`, and `Column`, a glowing rectangle on the table, in `column.tsx` of the same folder.

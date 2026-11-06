# Crown and the turn marker

The turn marker is a crown that stands beside the nickname of the player whose turn it is. Per game: the template's `board/crown.tsx`, `TurnCrown`, is the reference. The shared UI has its own marker for the DOM ([Turn crown](../../design/04-in-game/01-screens-and-game-flow.md#turn-crown)).

## Props

| Prop | Role |
| --- | --- |
| `show` | Whether the crown is up: it grows in when true and shrinks away when false |
| `position` | Where it stands, in the frame it is placed in |
| `icon` | The URL of the game's icon, the skin's `hostIcon`; a game with none shows a drawn crown |
| `size` | How big it grows |

## Rules

- Every seat has its own crown, and `show` says which one is up. The crown does not travel around the table, so it never crosses the mat or the cards.
- The template places it as a child of the nickname's `TableText`, in a frame whose origin is the left edge of the first letter ([Text on the table](19-text-on-the-table.md)).
- It is a plane that turns to face the camera about the vertical axis only, so it stays upright. While it is up it bobs and its gold pulses.
- It takes no pointer events ([Clicks and hover](20-clicks-and-hover.md)).
- The icon is a picture from the game's skin, so it comes from Sanity; the drawn crown is the fallback when the skin has none.
- Which seat has `show` set comes from the view ([Turn change](21-turn-change.md)).

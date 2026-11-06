# Not in the package yet

What the tools do not do, and the ticket that tracks each. The other pages of this group describe what exists.

| What | Ticket | What holds instead |
| --- | --- | --- |
| A `Seat` component: the name plate with its avatar, the aura and the turn marker as one piece | PLT-67 | Each game writes the pieces of a seat ([Seats](15-seats.md)) |
| A debug panel of the table: knobs for `CARD_SETTINGS`, the camera and the glows | PLT-68 | A game binds the objects to folders of its own ([Tuning](24-tuning.md)) |
| Dragging a card onto a zone | PLT-69 | `draggable`, `onDrop` and `CardDrop` are reserved and do nothing ([Card](06-card.md)) |
| Courtisans on the shared tools | GAM-25 | Its board keeps its own copies of the tools; only the template imports `@pbgo/table` |
| Flip 7's board | GAM-24 | Flip 7 has an engine and no board |
| A skill for building a board, `engine-board` | PLT-70 | These pages and `template/docs/GAME_GUIDE.md` |
| The template as a showcase of every feature | PLT-79 | Its board draws no `Pile`, no `grid`, no overlay in a card's `children`, no `standIn`, no glow but the frame and no `lights`; the tests of the package and these pages cover them |

Also not in the package, with no ticket of its own:

- A zone anchored to the camera, such as a hand that stays on the screen: a `Zone` lays cards on the table.
- A mat with a behaviour of its own, such as a shader that unrolls it: the table's surface is a colour and a repeating picture, nothing more, and a mat is a plane the game draws on it.
- A table lit like a room, such as Courtisans' vignette: the surface is flat and unlit, so the game draws its own gradient, and that plane has an edge to hide.
- A click on empty space: `Table` does not pass on the `onPointerMissed` of its canvas ([Clicks and hover](20-clicks-and-hover.md)).

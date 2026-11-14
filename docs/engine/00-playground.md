# Playground

Every component of the table on one table, in an interface of its own: [open the playground](/docs/playground). The table fills the window and the controls are at its side. It opens on a scene, a whole table that looks played on, and every change can be taken back.

## How to use it

| Where | What it does |
| --- | --- |
| Toolbar | The scene picker, Undo and Redo, Reset (the scene and the tuning as they start), Share (copies a link) and the help for the keys |
| Scene tab | Six scenes to start from, each one press: Card game (a ring of four seats, piles, floor buttons, your hand in the bottom left, as Flip 7), Board game, Trick-taking, Dice game, Everything (the playground as it used to start) and an Empty table. Also the view of the camera |
| Add tab | Cards and pieces to put on the table, and what to do with the one that is picked (turn it, glow, remove) |
| Parts tab | Every part of the table in groups, a switch each with a line of what it is, a Docs link to its page and its own controls when it is on. The search box finds a part by its name or its words (hand, dice, hex, score, flip 7) |
| Play tab | The transitions with Replay, the speed, arc and easing of the motion, the score of each seat and the log |
| Tuning tab | A slider for every number a component reads on every frame, with a search and a link to the page of each component. "Put the settings back" restores them |

- **Undo.** Every change of the table is one entry of a stack of sixty: Ctrl or ⌘ Z takes it back, with Shift it is given again. A slider's drags are one entry. The camera and the pick are not entries, and an undo leaves them as they are.
- **Share.** The address holds the scene and what differs from it: the parts on or off, the number of players, the layout of the hand, the place of the hand and the piles, the shape of the board, the view (`#s=card&pl=6&hl=row`). What lies on the table, the score and the log are not in it: a link is a starting point, not a save. It is `play/url.ts`.
- **Keys.** `?` lists them: D deal, F flip, M move a piece, H play a card, X discard, T pass, N next turn, + a point, E end the round, R roll, C add a card, P add a piece, Delete, Esc, V from above, `/` search and 1 to 6 for the scenes. They do not fire while a field or a dialog has the keys. The list is `play/shortcuts.ts` and the popover prints it.
- **The model is pure.** The scenes, the transitions, the undo stack, the address and the keys are plain functions in `apps/web/src/app/(hub)/docs/_specimens/scene/play/`, with their tests (`pnpm --filter web test`).

## What is on the table

Each part is the component of the package as the page of its own shows it, given a place on the table and a state by the controls. The controls are the platform's own, so everything the pointer does on the table has a keyboard way beside it.

| On the table | What to do with it | Page |
| --- | --- | --- |
| Cards | Add one, press it to pick it, drag it, turn it over, and give the picked one a glow | [Cards](02-components/04-cards.md), [Glows](02-components/04-cards.md#glows), [Dragging](02-components/19-dragging.md) |
| Pieces | Add a disc, a square, a hexagon, a cube, a sphere or a pawn, and drag it | [Pieces](02-components/13-pieces.md) |
| Board | A grid of squares, a field of hexagons or a ring of spaces, in the middle or at the side: drop a card or a piece on a cell and it takes it (the cell turns gold); Move a piece walks a pawn to the next free cell | [Dragging](02-components/19-dragging.md#zones), [Boards](02-components/16-boards.md) |
| Track | Move the marker along the spaces | [Tracks](02-components/15-tracks.md) |
| Counter | Count up and down | [Counters](02-components/14-counters.md) |
| Stepper | Press the arrows, or hold them to repeat; the count is also a slider of the Parts tab | [Bets and choices](02-components/12-bets-and-choices.md#stepper) |
| Slider | Drag the knob along the rail, or press the rail; the bet is also a slider of the Parts tab | [Bets and choices](02-components/12-bets-and-choices.md#slider) |
| Timer | Start a step and watch the sand run, or run it out in four seconds | [Timers](02-components/20-timers.md) |
| Bag | Press it to draw a token, which comes out of its mouth as a piece | [Bags](02-components/18-bags.md) |
| Cup | Press it to lift it, or pick a pose | [Cups](02-components/17-cups.md) |
| Dice tray | Pick the shape and the number of dice, roll them | [Dice](02-components/10-dice.md) |
| Fields | Press one to write a clue, to bet, to pick a face | [Text field](02-components/11-text-field.md), [Bets and choices](02-components/12-bets-and-choices.md) |
| Hand | The cards of a hand, along the near edge of the table or in the bottom left of the screen (the scene reads where the corner of the screen falls on the table from the camera, so the hand follows a resize), laid out as a fan, a row, a pile or a grid; drag a card out onto the table, and a card of the table in | [Where cards are](02-components/07-zones.md#hand), [Layout helpers](02-components/08-layout-helpers.md) |
| Piles | Along the near edge or in the middle: press the draw pile to deal a card to the hand, or to the table when the hand is off, and let a card go on the discard pile | [Decks and piles](02-components/06-decks-and-piles.md#pile) |
| Stack | Press the stack to take a piece off it, and set how many it holds | [Pieces](02-components/13-pieces.md) |
| Paper button | Press the paper: the turn written above it goes up | [Bets and choices](02-components/12-bets-and-choices.md), [Score](02-components/09-score.md#text-on-the-table) |
| Sketch | Switch it on and the camera backs off to show the sheet on the right of the table: draw on it, pick a colour and a brush, undo a stroke or clear it | [Drawing](02-components/21-drawing.md) |
| Map | Switch it on and the camera backs off to show six cities and the roads between them, on the left of the table: press a city to pick it and a road to claim it, and the longest route of the claimed roads is counted | [Maps](02-components/22-maps.md) |
| Sheet | Switch it on and the camera backs off to show a sheet of twenty-four numbered boxes on the left of the table: pick a tick, a cross or a circle, press a box to write it and press it again to take it off | [Sheets](02-components/23-sheets.md) |
| Tiles | Switch it on and the camera backs off to show a small table of tiles at the far right: press the tile in hand to turn it, press a ringed cell to lay it where it fits, or let the button lay it, and the closed roads and cities are counted | [Tiles](02-components/24-tiles.md) |
| Seats | Seat two to eight players round the table (`seats` of the kit), the viewer at the bottom, each plate turned to face its player, the crown on the turn, the cards the others hold face down in front of them; press a plate to pick that player |
| Scoreboard | The players' list at the top right (the look of `TablePlayers`, drawn from the playground's state since `TablePlayers` reads a game), the points under each plate, the round and a ticker of the log | [Score](02-components/09-score.md) |
| Floor buttons | Hit, Stay and Deal beside the draw pile and a zone at each seat that gives it a card; the rim lifts under the pointer or the keyboard | [Floor buttons](02-components/25-floor-buttons.md) | [Seats](02-components/03-seats.md) |
| Camera | Move it back or forward, look from above | [Camera](02-components/02-camera.md) |

## Tuning

The Tuning tab has a slider for every number a component reads on every frame, made from the lists of fields that the debug panel is made from, so a component that gains a setting gains its slider here. They are the same objects the debug panel edits ([Tuning](04-build-a-game/07-tuning.md)); the playground puts back what it found when the page is left.

## Transitions

The Play tab and the keys trigger the motion of the table's blocks: a card dealt from the pile flies to the hand (`from` of a [Card](02-components/04-cards.md), [Poses and motion](02-components/05-poses-and-motion.md)), a card turned over, a pawn that walks to another cell of the board, a card played from the hand or discarded and the cards passed from seat to seat, which glide from one zone to the other by the pose memory. Each is a change of the state; the blocks do the moving. Replay takes the last change back and does it again. Speed, arc height and easing write `CARD_SETTINGS` and `PIECE_SETTINGS`, the same objects as the Tuning tab, and they are put back when the page is left or by Reset. A visitor who asks for less motion gets the cards and pieces at their place at once, as everywhere on the table.

## Left out

- The platform's `TablePlayers` and ticker read a running game (`useGame`), so the scoreboard is a look-alike made from the same tokens and `SeatLabel`.
- The camera does not frame the seats by their turned boxes as Flip 7's board does (`tableBoxes`): the playground picks a distance for each number of players (`ringZoom`).
- Hex and ring boards have no rules of the board ([Rules of the board](02-components/26-rules-of-the-board.md)): the hop walks to the next free neighbour.

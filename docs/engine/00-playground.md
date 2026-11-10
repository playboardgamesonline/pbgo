# Playground

Every component of the table on one table, in an interface of its own: [open the playground](/docs/playground). The table fills the window and the controls are at its side. Add cards and pieces and drag them anywhere: let one go on a cell of the board and it takes the cell, let it go on the bin and it is gone, and a card let go on the hand or the discard pile joins it. Switch the parts of the table on and off, each with the controls of its own. Tune any setting of any component with the sliders, and look at the table from where a player sits or from straight above. Nothing is saved.

## What is on the table

Each part is the component of the package as the page of its own shows it, given a place on the table and a state by the controls. The controls are the platform's own, so everything the pointer does on the table has a keyboard way beside it.

| On the table | What to do with it | Page |
| --- | --- | --- |
| Cards | Add one, press it to pick it, drag it, turn it over, and give the picked one a glow | [Cards](02-components/04-cards.md), [Glows](02-components/04-cards.md#glows), [Dragging](02-components/19-dragging.md) |
| Pieces | Add a disc, a square, a hexagon, a cube, a sphere or a pawn, and drag it | [Pieces](02-components/13-pieces.md) |
| Bin and board cells | Drop a thing on the bin to remove it, on a cell to place it | [Dragging](02-components/19-dragging.md#zones), [Boards](02-components/16-boards.md) |
| Track | Move the marker along the spaces | [Tracks](02-components/15-tracks.md) |
| Counter | Count up and down | [Counters](02-components/14-counters.md) |
| Stepper | Press the arrows, or hold them to repeat; the count is also a slider of the Parts tab | [Bets and choices](02-components/12-bets-and-choices.md#stepper) |
| Slider | Drag the knob along the rail, or press the rail; the bet is also a slider of the Parts tab | [Bets and choices](02-components/12-bets-and-choices.md#slider) |
| Timer | Start a step and watch the sand run, or run it out in four seconds | [Timers](02-components/20-timers.md) |
| Bag | Press it to draw a token, which comes out of its mouth as a piece | [Bags](02-components/18-bags.md) |
| Cup | Press it to lift it, or pick a pose | [Cups](02-components/17-cups.md) |
| Dice tray | Pick the shape and the number of dice, roll them | [Dice](02-components/10-dice.md) |
| Fields | Press one to write a clue, to bet, to pick a face | [Text field](02-components/11-text-field.md), [Bets and choices](02-components/12-bets-and-choices.md) |
| Hand | Switch it on for the cards of a hand along the near edge of the table, pick how they are laid out (fan, row, pile or grid), drag a card out onto the table, and a card of the table in | [Where cards are](02-components/07-zones.md#hand), [Layout helpers](02-components/08-layout-helpers.md) |
| Piles | Press the draw pile to deal a card to the hand, or to the table when the hand is off, and let a card go on the discard pile | [Decks and piles](02-components/06-decks-and-piles.md#pile) |
| Stack | Press the stack to take a piece off it, and set how many it holds | [Pieces](02-components/13-pieces.md) |
| Paper button | Press the paper: the turn written above it goes up | [Bets and choices](02-components/12-bets-and-choices.md), [Score](02-components/09-score.md#text-on-the-table) |
| Sketch | Switch it on and the camera backs off to show the sheet on the right of the table: draw on it, pick a colour and a brush, undo a stroke or clear it | [Drawing](02-components/21-drawing.md) |
| Map | Switch it on and the camera backs off to show six cities and the roads between them, on the left of the table: press a city to pick it and a road to claim it, and the longest route of the claimed roads is counted | [Maps](02-components/22-maps.md) |
| Seats | Seat two to five players around the table, and press a plate to pick that player | [Seats](02-components/03-seats.md) |
| Camera | Move it back or forward, look from above | [Camera](02-components/02-camera.md) |

## Tuning

The Tuning tab has a slider for every number a component reads on every frame, made from the lists of fields that the debug panel is made from, so a component that gains a setting gains its slider here. They are the same objects the debug panel edits ([Tuning](04-build-a-game/07-tuning.md)); the playground puts back what it found when the page is left.

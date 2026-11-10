# Playground

Every component of the table on one table, in an interface of its own: [open the playground](/docs/playground). The table fills the window and the controls are at its side. Add cards and pieces and drag them anywhere: let one go on a cell of the board and it takes the cell, let it go on the bin and it is gone. Switch the parts of the table on and off, each with the controls of its own. Tune any setting of any component with the sliders, and look at the table from where a player sits or from straight above. Nothing is saved.

## What is on the table

Each part is the component of the package as the page of its own shows it, given a place on the table and a state by the controls. The controls are the platform's own, so everything the pointer does on the table has a keyboard way beside it.

| On the table | What to do with it | Page |
| --- | --- | --- |
| Cards | Add one, press it to pick it, drag it, turn it over | [Cards](02-components/04-cards.md), [Dragging](02-components/19-dragging.md) |
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
| Sketch | Switch it on and the camera backs off to show the sheet on the right of the table: draw on it, pick a colour and a brush, undo a stroke or clear it | [Drawing](02-components/21-drawing.md) |
| Seats | Seat two to five players around the table | [Seats](02-components/03-seats.md) |
| Camera | Move it back or forward, look from above | [Camera](02-components/02-camera.md) |

## Tuning

The Tuning tab has a slider for every number a component reads on every frame, made from the lists of fields that the debug panel is made from, so a component that gains a setting gains its slider here. They are the same objects the debug panel edits ([Tuning](04-build-a-game/07-tuning.md)); the playground puts back what it found when the page is left.

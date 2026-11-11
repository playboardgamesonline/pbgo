# Words and names

A board is a tree of components, and some of the words used for its parts are not components of the code. This page shows the tree, then maps each word to what the code has.

## What sits in what

```text
GameHud                          DOM, shared: ticker, announcements, game over
└── Scene                        the board, loaded on demand
    └── Table                    the canvas, with the pose memory
        ├── Surface              the endless table, always
        ├── CameraRig            puts the camera where the settings say, every frame
        ├── Lights               when asked for
        ├── SharePhoto           when a photo camera is given
        └── World                what lies on the table, the game's own
            ├── PlayerSeat       a Seat for each player, with its pieces
            │   ├── Aura         lit softly for the players expected, fully for a winner
            │   ├── TableText    the nickname, with SeatAvatarMesh and TurnCrown
            │   ├── TableText    the points, and a status under them
            │   └── Zone         the cards held there, face down, a child of the Seat
            ├── Zone             the viewer's hand
            └── Zone             the middle of the table
                └── Card …       a front, a back, a glow, a shadow
```

`GameHud` is core's ([In-game UI](../../design/04-in-game/index.md)). `Scene` and `World` are the names the template gives the two halves of its `board/scene.tsx` ([Composing a board](../04-build-a-game/04-composing-a-board.md)).

## Die and dice

English has one word for one and another for several: a die, two dice. The code keeps them apart, so a name says how many it is about. `Die` draws one die and `DieModel` is the shape and the faces of one. `DiceTray` is where several are thrown, `rollDie` rolls one and `rollDice` rolls several. Pages that are about dice in general are called Dice.

## From a word to the code

The code has no component for some of the words used for the parts of a table. This maps them.

| Word | In the code | Shared or per game | Page |
| --- | --- | --- | --- |
| table | `Table`: the canvas, the camera, the lights and the pose memory, with an endless `surface` | Shared | [Table](01-table.md) |
| table surface | The `surface` prop of `Table`: a colour, and a picture that repeats | Shared | [Surface](01-table.md#surface) |
| mat | No component: the table has no edge, so a mat is a plane the game draws on it | Per game | [Surface](01-table.md#surface) |
| card | `Card` | Shared | [Card](04-cards.md#card) |
| deck, draw pile, discard pile | `Pile` for cards the game only counts; a `Zone` over `pile` for cards it names | Shared | [Pile](06-decks-and-piles.md#pile) |
| hand | A `Zone` over a `fan` layout in front of the viewer | Tools shared, layout per game | [Hand](07-zones.md#hand), [Zone](07-zones.md#zone) |
| cards in front of a player, cards on a field, the middle | A `Zone` framed on a seat or on the table, with the game's own layout | Tools shared, layout per game | [Where cards are](07-zones.md) |
| mission card, character card | No component and no kit type: the missions of Courtisans are setup data that the engine deals to each player, keeps in its state and shows to its owner in the view; a character card with a power of its own is not built | Per game | [Game data](../01-the-game/08-game-data.md), [Not built yet](../03-not-built-yet.md) |
| die, dice, tray | `Die` (any shape, any values, rolled by physics) and `DiceTray`; `rollDie`, `rollDice` and `rerollDice` of the kit | Shared | [Dice](10-dice.md) |
| text field, notepad, writing zone | `TextField`, `askText` of core and `cleanText` of the kit | Shared | [Text field](11-text-field.md) |
| bet, bid, number field | `NumberField` (a number on the table that opens a window to choose it), `askNumber` and `ask` of core, `cleanNumber` of the kit | Shared | [Bets and choices](12-bets-and-choices.md) |
| choice field | `ChoiceField`, `askChoice` and `askChoices` of core, `cleanChoice` and `cleanChoices` of the kit | Shared | [Bets and choices](12-bets-and-choices.md) |
| bid card, sealed bid, secret answer, vote | A `Card` laid at the seat of the player, face down until the view gives the answers: a `Submissions` in the engine, `submittedFlags` in the view, `revealSubmissions` when the step is resolved | Shared pieces, the cards per game | [A bid made with cards](12-bets-and-choices.md#a-bid-made-with-cards) |
| stepper, plus and minus, arrows | `Stepper`: a number between two arrows that repeat when held; `cleanNumber` of the kit | Shared | [Stepper](12-bets-and-choices.md#stepper) |
| slider, dial, knob, rail | `Slider`: a knob dragged along a rail marked with the numbers; `cleanNumber` of the kit | Shared | [Slider](12-bets-and-choices.md#slider) |
| paper, button on the table | `Paper`: a piece of paper with a few words that can be pressed | Shared | [Bets and choices](12-bets-and-choices.md#fields-that-open-a-window) |
| token, coin, tile, cube, pawn, meeple, stack of tokens | `Piece` (any shape, any silhouette, a picture on each face), `Stack` | Shared | [Pieces](13-pieces.md) |
| counter, score, life, coins as a number | `Counter` (a number that counts up or down, with the change floating beside it); `changeCounter` of the kit | Shared | [Counters](14-counters.md) |
| track, score track, path, squares, marker on a track | `Track` (the spaces), `TrackMarker` (a piece that walks along them), `lineSpaces`, `loopSpaces`, `arcSpaces`, `snakeSpaces`, `pathSpaces`; `moveAlong` of the kit | Shared | [Tracks](15-tracks.md) |
| cup, shaker, hidden roll | `Cup` (covers dice, shakes, tilts, lifts, tips over); the roll is `rollDice` of the kit, hidden by the view | Shared | [Cups](17-cups.md) |
| bag, pouch, draw a token | `Bag` (draws come out of its mouth, `bagMouth`); `drawFromBag` and `bagSize` of the kit | Shared | [Bags](18-bags.md) |
| timer, clock, time limit, deadline, hourglass | `Timer` (an hourglass that shows the time left to a step); a `Timer` in the state, `begin`, `nextDeadline` and a system action in the engine, `startTimer` and `systemAction` of the kit | Shared | [Timers](20-timers.md) |
| drawing, sketch, stroke, sheet, pen, brush | `Sketch` (a sheet of paper that the pointer draws on); a `Stroke` and a `Drawing` in the state, `addStrokes` and `cleanStroke` of the kit | Shared | [Drawing](21-drawing.md) |
| map, graph, place, road, route, city, intersection, corner, settlement | `RoadMap` (the places and the roads drawn); a `graph` of places and roads, `cornerGraph` for the corners and sides of a board, and `longestTrail` for the longest road, in the kit; a settlement is a `Piece` on a place | Shared | [Maps](22-maps.md) |
| score sheet, scorecard, score pad, box to tick, tick, cross, circle | `Sheet` (paper with boxes laid on the table, the boxes being `SheetCell`s that `gridCells` lays out); the boxes are an array in the state, and a box a player names goes through `cleanChoice` | Shared | [Sheets](23-sheets.md) |
| drag, drop, drop zone, pick up | `draggable`, `dropOn` and `onDrop` of a `Card` or a `Piece`, `DropZone`, and `drops` of a `Board`; the engine checks the drop like a click | Shared | [Dragging](19-dragging.md) |
| game board, grid, square, hexagon, cell | `Board` (the cells, which can be pressed), `squareCells`, `hexCells`, a `Piece` or a `TrackMarker` on a cell; `squareBoard`, `hexBoard`, `reachable`, `shortestPath`, `regionOf`, `lineBetween`, `rayFrom` of the kit | Shared | [Boards](16-boards.md) |
| territory, area, the art of a map | Nothing: the places and the roads are a `RoadMap`, and the picture under them and the areas are the game's own | Not built | [Not built yet](../03-not-built-yet.md) |
| score | A number of the view, written by the game as the `line` of a `Seat`, a `TableText` under the nickname | The line is shared, the number is the game's | [Score](09-score.md) |
| player zone | No component: a `Spot` from `seats`, used as the `frame` of a `Zone` and as the `spot` of a `Seat` whose children are what the player holds | Shared | [Seats](03-seats.md) |
| seat | A `Spot` from `seats`, and the `Seat` that draws the player who sits there | Shared | [Seats](03-seats.md) |
| name plate | The name and the avatar of a `Seat`: `TableText` with `SeatAvatarMesh` | Shared | [Text on the table](09-score.md#text-on-the-table), [Seats](03-seats.md#the-avatar) |
| aura | `Aura` | Shared | [Aura](../01-the-game/03-turns.md#aura) |
| crown, turn marker | `TurnCrown` | Shared | [Crown and the turn marker](../01-the-game/03-turns.md#crown-and-the-turn-marker) |
| away, out, expected, winner | The states of a `Seat` (`away`, `out`, `waiting`, `winner`, and `active` for the turn): `PlayerSeat` reads them from the table with `seatStateOf`, except `out`, which the game says | Shared | [The plate](03-seats.md#the-plate) |
| turn transition | No component: the crown moves, the hand becomes playable, the `turn` announcement plays | The scene is per game, the announcement is shared | [Turn change](../01-the-game/03-turns.md#turn-change) |
| opening, ending | No component: only the camera's entrance is shared | Per game | [Opening and ending](../01-the-game/06-victory.md#opening-and-ending) |

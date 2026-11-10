# Components

A game is made of components, and the same few are put together over and over. A die is some faces, a shape and a value on each face, and it rolls with physics; a card is a 3D element with a face and a back, a value and maybe a power; a pile is cards that are drawn from or counted; a text field opens a window to write in. Perudo is dice, a bet and a cup; Skull King is cards, a bet and tricks; King of Tokyo is dice, cards and counters. No game is of a kind: each is its components put together, so a component is built once, whatever the games that use it, and a game that comes after starts from what is there.

Each component has two sides, what the engine keeps of it in the state and what the board draws, and a page says both.

To see every component at once, open the [playground](/docs/playground): one table with all of them on it.

The board of a game is a 3D scene drawn with react-three-fiber on one canvas, and none of it is DOM. `@pbgo/table` gives every game the same table: a canvas with its camera, an endless table, cards that glide, fly and bend, the helpers that say where cards go and the zones that place them. The plate of a player, with its name, its avatar, its crown and its aura, is the shared `Seat`. What depends on a game's look (its pictures, its layouts, its camera) is written per game in the `board/` folder of its binding, and `template/src/components/board/` is the reference.

The tools are in `packages/table/src` and `pnpm --filter @pbgo/table test` runs their tests. The exports of `packages/table/src/index.ts` are the whole API of the package; a file can hold more than it exports, and a page says so when a piece is internal.

Hover a card of the hand to lift it, press it to play it to the middle, and change the number of players under the table.

```specimen
scene-board
```

## The building blocks

What each component is, what the engine holds of it, what the board draws, and where it stands. The ones marked "to build" are what no tool provides yet: each is a small component of its own, built one at a time and used by every game that needs it.

| Component | What it is | In the engine | On the table | Standing |
| --- | --- | --- | --- | --- |
| Card | A 3D element with a face and a back. A game gives each card a value, a power, a picture: they are its data, in its engine and its Sanity project | An opaque id in the state, the deck helpers, a view that hides what a viewer may not see | `Card`, with its glows | Built: [Cards](04-cards.md) |
| Pile and deck | Cards that are drawn from, counted or named | `deck`, `draw`, `deal`, `reshuffleDiscard` | `Pile`, or a `Zone` over a pile layout | Built: [Decks and piles](06-decks-and-piles.md) |
| Zone and hand | A place where cards lie, in a layout | A list in the state | `Zone`, and the layouts `fan`, `row`, `pile` and `grid` | Built: [Where cards are](07-zones.md), [Layout helpers](08-layout-helpers.md) |
| Die | Some faces, a shape and a value on each face, rolled with physics | `rollDie`, `rollDice`, `rerollDice` | `Die`, `DiceTray`, `DieModel` | Built: [Dice](10-dice.md) |
| Text field | A field on the table that opens a window to write in | `cleanText`, `INVALID_TEXT` | `TextField`, `askText` | Built: [Text field](11-text-field.md) |
| Number field and choice field | A bet, a quantity, a face, an option: a field on the table that opens a window to choose, alone or with others (a bid) | `cleanNumber`, `cleanChoice`, `cleanChoices` | `NumberField`, `ChoiceField`, `ask`, `askNumber`, `askChoice` | Built: [Bets and choices](12-bets-and-choices.md) |
| Stepper | A number changed by two arrows, which repeat when held: a count, a bet, in the game's look and without a window | `cleanNumber`, the same rules | `Stepper` | Built: [Bets and choices](12-bets-and-choices.md#stepper) |
| Slider | A number in a wide range chosen by dragging a knob along a rail, or pressing the rail | `cleanNumber`, the same rules | `Slider` | Built: [Bets and choices](12-bets-and-choices.md#slider) |
| Sealed answer | A bid or a vote that is given and not yet known: a card face down at a seat, turned over together with the others | `Submissions`, `submittedFlags`, `revealSubmissions` | A `Card` at the seat of the player, face down until the view gives the answers | Built: [Bets and choices](12-bets-and-choices.md#a-bid-made-with-cards) |
| Paper | A piece of paper on the table with a few words that can be pressed: what the fields are drawn as, and a button on the table | | `Paper` | Built: [Bets and choices](12-bets-and-choices.md#fields-that-open-a-window) |
| Seat | A player's place and plate | The players, `waitingFor` | `Seat`, `PlayerSeat` | Built: [Seats](03-seats.md) |
| Text on the table | Words and numbers written flat | A number or a word in the view | `TableText` | Built: [Score](09-score.md) |
| Table and camera | The surface everything lies on, and the way it is seen | | `Table` | Built: [Table](01-table.md), [Camera](02-camera.md) |
| Piece and stack | A token, coin, tile, cube, pawn or meeple: a shape, a colour, pictures and a place that changes; pieces of one kind in a pile | A place in the state, a count | `Piece`, `Stack`, `PieceModel` | Built: [Pieces](13-pieces.md) |
| Counter | A number that goes up and down: life, coins, points. It counts to each new value and shows what changed | A number in the state, `changeCounter` | `Counter`, alone, written on a piece or beside a `Stack` | Built: [Counters](14-counters.md) |
| Track | A row of spaces that a marker walks along: a score track, a board that runs round, the steps of a climb | A position in the state for each marker, `moveAlong` | `Track`, `TrackMarker`, and the helpers that lay the spaces out | Built: [Tracks](15-tracks.md) |
| Board | A grid of squares or hexagons whose cells can be pressed, with the pieces on them | `squareBoard`, `hexBoard`, and the searches `reachable`, `shortestPath`, `regionOf`, `lineBetween`, `rayFrom` | `Board`, `squareCells`, `hexCells`, and a `Piece` or a `TrackMarker` on a cell | Built: [Boards](16-boards.md) |
| Cup | A cover that hides dice, is shaken and slammed down, tilted to be looked under, lifted away, or tipped to pour them out | A hidden roll: the roll kept in the state, a view that hides it | `Cup`, and the `Die`s under it or thrown from it | Built: [Cups](17-cups.md) |
| Bag | Tokens of several kinds that are drawn at random without being seen | A count for each kind, `drawFromBag`, `bagSize` | `Bag`, and the `Piece`s that come out of its mouth | Built: [Bags](18-bags.md) |
| Timer | A clock that ends a step: the time left is shown, and at the deadline the game plays for whom it waits for | A `Timer` in the state, `begin`, `nextDeadline` and a system action | `Timer`, an hourglass | Built: [Timers](20-timers.md) |
| Drawing | Strokes a player draws and the others see | Strokes kept as bounded data | A drawing zone | To build |
| Drag | Picking a card or a piece up and dropping it on a zone or a cell | Nothing new: a drop is an action, checked like a click | `draggable`, `dropOn` and `onDrop` of `Card` and `Piece`, `DropZone`, `useDrag`, and `drops` of a `Board` | Built: [Dragging](19-dragging.md) |

## The pages

- [Words and names](00-words-and-names.md): what sits in what on a board, and the word each part goes by.
- [Table](01-table.md): the canvas, the lights, the endless surface, the share photo and the coordinates.
- [Camera](02-camera.md): the settings, the entrance, the rig.
- [Seats](03-seats.md): the ring of seats around the table, the plate of the player who sits at one (name, avatar, crown, aura, score) and the picture beside a nickname.
- [Cards](04-cards.md): a card in the state and on the table, its faces, its kinds and its glows.
- [Poses and motion](05-poses-and-motion.md): where a card lies, how it gets from one pose to another and where it starts from.
- [Decks and piles](06-decks-and-piles.md): drawing, dealing and reshuffling in the engine, and the pile on the table.
- [Where cards are](07-zones.md): the places of a card, the hand and the zones that lay cards out.
- [Layout helpers](08-layout-helpers.md): `fan`, `row`, `pile`, `grid` and `inFrame`.
- [Score](09-score.md): the points during a game, and the text that shows them.
- [Dice](10-dice.md): a roll of the seeded stream in the engine, and a die of any shape and values that rolls with physics onto the number on the table.
- [Text field](11-text-field.md): the text a player writes, cleaned and bounded in the engine, a field on the table that opens a window to write in.
- [Bets and choices](12-bets-and-choices.md): a number or an option a player names, checked in the engine, fields on the table that open a window to choose and the windows themselves, and the game's own pieces to ask in its look: bid cards sealed until everybody has bid, a stepper, a slider.
- [Pieces](13-pieces.md): tokens, tiles, cubes, pawns and silhouettes that stand where the state says, glide, fly and turn over, and the stacks they make.
- [Counters](14-counters.md): a number that goes up and down, kept between two ends in the engine, and counted up or down on the table with what changed floating beside it.
- [Tracks](15-tracks.md): a marker's position along a row of spaces in the engine, and the spaces, the plates and the markers that walk along them on the table.
- [Boards](16-boards.md): the cells of a grid of squares or hexagons in the engine, with who is next to them, how far they are and the way across, and the cells and the pieces on them on the table.
- [Cups](17-cups.md): a roll that is hidden in the engine by the view, and a cup on the table that covers dice, is shaken, tilted, lifted and tipped over to pour them.
- [Bags](18-bags.md): tokens drawn at random from counts kept in the state, and the bag the tokens come out of.
- [Dragging](19-dragging.md): a card or a piece picked up with the pointer and let go on a zone or a cell, and what the engine does with the drop.
- [Timers](20-timers.md): the clock of a step in the engine, a deadline the server plays, and the hourglass that shows the time that is left.
- [Rules of the board](21-rules-of-the-board.md): what holds for every board, whatever the game.

What no tool draws or holds yet is on [Not built yet](../03-not-built-yet.md), with what holds instead. The players and the turn are in [The game](../01-the-game/index.md).

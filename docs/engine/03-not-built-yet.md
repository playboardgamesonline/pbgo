# Not built yet

What the framework does not provide, and what holds instead. The first table is what the games of the catalog ask for, the second what the contract leaves out, the third what the board tools leave out. The other pages describe what exists, and [Components](02-components/index.md) lists the building blocks, the built ones and the ones still to build.

## What games ask for

| What | Examples of games that need it | What holds instead |
| --- | --- | --- |
| Phases: a helper that stores the phase, pushes steps and plays them until a player is needed | Flip 7, Exploding Kittens, Courtisans, each with a machine of its own | Each engine keeps its phase in its state ([Phases in the state](01-the-game/04-phases.md)) |
| Roles, characters and teams: a secret role, or a character card with a power, for each player, shown later | Bang, Love Letter, Time Bomb, One Night Ultimate Werewolf, The Werewolves of Millers Hollow | Nothing deals or hides a role: a game keeps it in its state and hides it in its view ([Hidden information](01-the-game/10-views.md#hidden-information)) |
| Votes between players | The two Werewolves games | A [simultaneous step](01-the-game/03-turns.md#simultaneous-steps), whose answers are revealed together |
| One result for the whole table | Hanabi, Sky Team, The Game, The Mind | `coop` of the [results](01-the-game/06-victory.md#results) says that the table won or lost together, and the game over tells a defeat in its own words ([Outcomes](01-the-game/06-victory.md#outcomes)). The end screen has no hero for the table: it crowns each player of a table that won and ranks the players of a table that lost, each with the score of the table |
| Play without turns: any player acts at any moment | The Mind | Nothing: `waitingFor` names who is awaited |
| The art of a map and territories drawn as areas | Risk, Pandemic | The places and the roads are a `graph` and a `RoadMap` ([Maps](02-components/22-maps.md)); the picture under them and the areas are planes and polygons the game draws |
| Boxes that take a typed text or a dropped die, a strike across a row, a bracket that joins boxes | Qwixx, Welcome To, Cartographers | A `Sheet` takes a press on a box. A text goes in a `TextField` that the game puts at the box, a drop on a `DropZone` over it, and the rest is drawn in `printed` ([Sheets](02-components/23-sheets.md#not-built)) |
| Tiles that cover several cells and turn and flip: dominoes and shapes that fill a grid | Ark Nova, Patchwork, Cartographers | A tile covers one cell ([Tiles](02-components/24-tiles.md#not-built)); a shape of several cells is tiles that the game keeps together, and the rule that it fits is the game's |
| Drawing that the others watch as it is drawn, an eraser, a fill, shapes, the pressure of a pen, a picture to trace | Telestrations, Pictionary | A `Sketch` shows the strokes the engine kept, which arrive when the pen is lifted; a stroke is a colour and a width, and `undoStroke` is the only eraser ([Drawing](02-components/21-drawing.md#not-built)) |
| A filter of what players write or draw, and a way to report it | Codenames, Just One, Pictionary, any game with free text | Nothing: `cleanText` bounds a text and takes out what cannot be shown, `cleanStroke` bounds a stroke, and neither judges what it keeps ([Text field](02-components/11-text-field.md), [Drawing](02-components/21-drawing.md)) |
| Free negotiation between players | Hellapagos | Nothing |

## What the contract leaves out

| What | Ticket | What holds instead |
| --- | --- | --- |
| A clock for each player, as in chess: the time of a player runs down while they are waited for | | A game keeps the time of each player in its state and makes `nextDeadline` the soonest of them ([Timers](02-components/20-timers.md#not-built)); the kit has no arithmetic for it |
| A visit to the tables whose deadline has passed: a table that nobody looks at does not move on | | The first request that looks at a table plays the deadline that is due; a player waiting for another who closed the page waits until someone looks ([Timers](02-components/20-timers.md#on-the-platform)) |
| The speed of the lobby reaching the engine, so that a clock follows it | PLT-13 | The length of a clock is the game's own option, as the template's `turnSeconds` ([Parameters](01-the-game/07-parameters.md#speed)) |
| Asynchronous games over several days | PLT-30 | The delay to play for an absent player stays within `TURN_TIMEOUT_BOUNDS`, presence is the window `PRESENCE_WINDOW_MS`, and a vote has to come from a member who is at the table |
| Expansions | PLT-27 | An optional module is an option of the group `extension`, a boolean the engine implements itself ([Options](01-the-game/07-parameters.md#options)); it reaches a table only through an expansion or a helper of the same id ([Expansions and helpers](01-the-game/07-parameters.md#expansions-and-helpers)) |
| A clock that runs on a table's speed | PLT-21 | The speed, the number of players and who may join are kept with the table (`games.settings`, PLT-21) and read by the platform; the speed sets no clock yet, and the engine gets `players`, `options`, `seed` and `data` only ([Parameters](01-the-game/07-parameters.md)) |
| Giving up a game that runs, with a button in the game | PLT-21 | Nothing: `leave` works for a table that waits or starts only, and a player who walks away is an absent player whom the others can vote to play for ([Leaving a table](01-the-game/02-players.md#leaving-a-table)). The engine needs nothing for the button: PLT-21 proposes to play the seat with `autoPlayFor` and the platform writes `abandoned` ([Outcomes](01-the-game/06-victory.md#outcomes)) |
| The team of a player in the history (`game_participants.team`) | PLT-13 | A team that wins puts all its members in `winners` with a shared rank, and `outcomesOf` reads them as winners; the results say nothing of the team itself, so `game_participants` has no `team` column ([Outcomes](01-the-game/06-victory.md#outcomes)) |
| A replay from the action log | PLT-29 | The `games` table stores the current state, not the actions that led to it, and its `replay` column holds the votes for a rematch; the same seed and the same actions give the same game. `game_log` keeps what the moves said (the events), not the moves, and goes with the table ([Events and the log](01-the-game/12-events-and-the-log.md)) |
| A version of the state | | Nothing in the contract or in `supabase/migrations` says which version of an engine wrote a stored `State` |
| Action parameters declared with their types and bounds | | An engine validates the fields of an action by hand, and the conformance test sends it junk of its own making; BGA's platform checks `IntParam`, `StringParam`… before the game code runs |
| The legal actions of a seat, declared by the engine in one form | | Each game puts what its board needs in its view (Flip 7: `phase.targets`); nothing tests that what a view offers is accepted by `apply` |
| Declared statistics (ids, types, "not started" apart from zero) | PLT-13 | Flip 7 counts busts and Flip 7s in its state; the results carry none, so the history and the achievements cannot read them |
| Undo of a move | | Nothing: the engine could give it cheaply (the previous state and the stream are one JSON), but it tells what other players saw, a product decision |
| A bar of progress in the HUD | | `GAME.progress` reaches the browser as `PublicGame.progress`; nothing draws it yet |

## What the board tools leave out

| What | Ticket | What holds instead |
| --- | --- | --- |
| A die made from a 3D file, and a d4 | | A `DieModel` is made from the corners of a solid in code, and nothing reads them from a model an artist made; a d4 is read at a corner, not on a face ([Dice](02-components/10-dice.md)) |
| A track that forks, or whose spaces differ in shape or size | | A `Track` is one list of spaces drawn as plates of one size and a `TrackMarker` walks one list: a board with a fork is two tracks, or a board ([Tracks](02-components/15-tracks.md)) |
| Digits that roll like an odometer's wheels, a dial with a needle, a bar that fills | | A `Counter` writes the number and counts up or down to it; a needle or a bar is a [track](02-components/15-tracks.md) with a marker ([Counters](02-components/14-counters.md)); a clock is an hourglass ([Timers](02-components/20-timers.md)), and a ring or a bar for it is drawn by the game from `shareLeft` |
| A window in the game's own look: the windows that ask for a bet, a text or a choice are the platform's, in its look, and a game cannot dress them | | The game asks on the table with its own pieces, a row of bid cards, a `Stepper`, a `Slider`, tokens, and draws the answer with its own cards, pieces and counters, with the window beside them for the keyboard ([Bets and choices](02-components/12-bets-and-choices.md#with-the-games-own-pieces)). A text has no such way: it is written in the platform's window |
| A board for an engine that has none | GAM-24, GAM-8 | Exploding Kittens has an engine and no board; GAM-8 covers the wiring and the messages of Exploding Kittens too |
| A skill for building a board, `engine-board` | PLT-70 | These pages and `template/docs/GAME_GUIDE.md` |
| The template as a showcase of every feature | PLT-79 | Its board draws no `Pile`, no `grid`, no overlay in a card's `children`, no `standIn` and no `lights`; the tests of the package and these pages cover them |
| A flat picture that lies on the table: a sticker, an emblem, a backdrop under a counter | | The game draws a plane with the picture (`mesh`, `planeGeometry`, `meshBasicMaterial`, a `renderOrder` over the mat and no `raycast`): Flip 7's stickers, the ending of Courtisans. The test of the boards lists them (`OWN_DRAWING` of `packages/games/src/boards.test.ts`) |
| A press on the empty table, and something held in front of the camera that is not a hand | | Courtisans puts a plane under everything to take the press, and holds its missions in a `ScreenHand`, whose camera frame is not exported alone; the opening follows the pointer with `useFrame` |
| What a move holds back until it has played out: the announcements and the words under a seat | | Flip 7, Skyjo and Love Letter each keep a clock of their own (`busyUntil` and a timer, or `useReveal`); `useSequence` serves an opening and an ending |
| The area that chooses a player or a cell, grown from its cards and its plate until it meets its neighbours | | A `Hotspot` takes the area the game works out: Flip 7 keeps its own `zones()`, the specimen a fixed padding |
| How far the word over an object reaches | | Flip 7 reserves a width of its own beyond a pile (`PILE_WORD`) so that no plate lies under the word |
| A plate that fits a long name, and a plate size for each number of players | | `SEAT_SETTINGS` is one object for every table: a name that is too long sticks out, and a table of eight pays in the size of its ring |
| The platform's message box among the boxes a camera keeps clear of | | `hudBoxes` leaves out the box of the chat: Skyjo adds it to its own `avoid` |
| A font for a `Counter`, the order of an ordered choice that `cleanChoices` keeps, a block for a card read large under the pointer (Love Letter's lens) | | A `Counter` writes in the table's lettering; the game keeps the order of a choice itself; the lens is Love Letter's own, in the layer of the HUD |
| The words of a board filled with their `{placeholders}` where a game's content project can read them | | `fill` of `@pbgo/core/lib/skin` reaches files typed for the browser, and the content projects run on Node alone: Flip 7, Skyjo and Love Letter keep a copy of the one line in `words.ts`. A module of core with no import, re-exported by `skin.ts`, needs a way for Node to resolve it that `@pbgo/core` has no map of exports for |

Also not in the package, with no ticket of its own:

- A mat with a behaviour of its own, such as a shader that unrolls it: the table's surface is a colour and a repeating picture, nothing more, and a mat is a plane the game draws on it.
- A table lit like a room, with shadows and a source of light: the surface is flat and unlit. A pool of light added to it gives the vignette ([A pool of light](02-components/01-table.md#a-pool-of-light)), and nothing else.
- A click on empty space: `Table` does not pass on the `onPointerMissed` of its canvas ([Clicks and hover](01-the-game/05-actions.md#clicks-and-hover)).

# Not built yet

What the framework does not provide, and what holds instead. The first table is what the games of the catalog ask for, the second what the contract leaves out, the third what the board tools leave out. The other pages describe what exists.

## What games ask for

| What | Examples of games that need it | What holds instead |
| --- | --- | --- |
| Phases: a helper that stores the phase, pushes steps and plays them until a player is needed | Flip 7, Exploding Kittens, Courtisans, each with a machine of its own | Each engine keeps its phase in its state ([Phases in the state](01-the-game/04-phases.md)) |
| Roles, characters and teams: a secret role, or a character card with a power, for each player, shown later | Bang, Love Letter, Time Bomb, One Night Ultimate Werewolf, The Werewolves of Millers Hollow | Nothing deals or hides a role: a game keeps it in its state and hides it in its view ([Hidden information](01-the-game/10-views.md#hidden-information)) |
| Votes between players | The two Werewolves games | A [simultaneous step](01-the-game/03-turns.md#simultaneous-steps), whose answers are revealed together |
| One result for the whole table | Hanabi, Sky Team, The Game, The Mind | `coop` of the [results](01-the-game/06-victory.md#results) says that the table won or lost together, and the game over tells a defeat in its own words ([Outcomes](01-the-game/06-victory.md#outcomes)). The end screen has no hero for the table: it crowns each player of a table that won and ranks the players of a table that lost, each with the score of the table |
| Play without turns: any player acts at any moment | The Mind | Nothing: `waitingFor` names who is awaited, and an engine has no clock (below) |
| Tricks: the lead, the trump, the collect | Cry Baby, Omens, Skull King | Each engine writes them; the kit has no helper |
| Drafting: passing hands, picking from a row | 7 Wonders, 7 Wonders Duel | Each engine writes it; the kit has no helper |
| Tokens and counters | Hanabi, Love Letter, 7 Wonders | A number in the state, drawn as text on the table ([Text on the table](02-components/09-score.md#text-on-the-table)) |
| Dice | Sky Team | `Rng` gives a number of the seeded stream and a roll is the game's to compute ([Random numbers](01-the-game/09-state.md#random-numbers)); no tool draws a die |
| Boards, tracks and score sheets | Sky Team, 7 Wonders, Welcome To | No tool draws one; a plane the game draws on the table has an edge to place and to hide ([Surface](02-components/01-table.md#surface)) |
| A hand hidden from its owner | Hanabi | A `view` can hide anything from anybody, an owner included; no layout or example is made for it |
| Free negotiation between players | Hellapagos | Nothing |

## What the contract leaves out

| What | Ticket | What holds instead |
| --- | --- | --- |
| Server time and deadlines: an engine cannot ask to be played at a given time, nothing closes a `waitingFor` on a clock, and the state has no time to read | PLT-43 | The one delay is `turnTimeout`, which core measures for the takeover vote |
| System actions: once a game has started, every change of its state comes from a player's action, a takeover or a debug command | PLT-43 | Nothing |
| Asynchronous games over several days | PLT-30 | The delay to play for an absent player stays within `TURN_TIMEOUT_BOUNDS`, presence is the window `PRESENCE_WINDOW_MS`, and a vote has to come from a member who is at the table |
| Expansions | PLT-27 | An optional module is an option of the group `extension`, a boolean the engine implements itself ([Options](01-the-game/07-parameters.md#options)); it reaches a table only through an expansion or a helper of the same id ([Expansions and helpers](01-the-game/07-parameters.md#expansions-and-helpers)) |
| Table settings the lobby draws and nothing receives: the speed, the number of players, who may join | PLT-13 | They stay in the page; the engine gets `players`, `options`, `seed` and `data` only ([Parameters](01-the-game/07-parameters.md)) |
| Giving up a game that runs, with a button in the game | PLT-21 | Nothing: `leave` works for a table that waits or starts only, and a player who walks away is an absent player whom the others can vote to play for ([Leaving a table](01-the-game/02-players.md#leaving-a-table)). The engine needs nothing for the button: PLT-21 proposes to play the seat with `autoPlayFor` and the platform writes `abandoned` ([Outcomes](01-the-game/06-victory.md#outcomes)) |
| Nothing records a finished game: the history of each player, with the outcome `outcomesOf` gives | PLT-13 | The results are in the view and stay there; no table of the database holds them |
| The team of a player in the history (`game_participants.team`) | PLT-13 | A team that wins puts all its members in `winners` with a shared rank, and `outcomesOf` reads them as winners; the results say nothing of the team itself |
| A replay from the action log | PLT-29 | The `games` table stores the current state, not the actions that led to it, and its `replay` column holds the votes for a rematch; the same seed and the same actions give the same game |
| A version of the state | | Nothing in the contract or in `supabase/migrations` says which version of an engine wrote a stored `State` |

## What the board tools leave out

| What | Ticket | What holds instead |
| --- | --- | --- |
| A debug panel of the table: knobs for `CARD_SETTINGS`, `SEAT_SETTINGS`, the camera and the glows | PLT-68 | A game binds the objects to folders of its own ([Tuning](04-build-a-game/07-tuning.md)) |
| Dragging a card onto a zone | PLT-69 | `draggable`, `onDrop` and `CardDrop` are reserved and do nothing ([Card](02-components/04-cards.md#card)) |
| An existing board on the shared tools | GAM-25 | The board of Courtisans keeps its own copies of the tools; only the template imports `@pbgo/table` |
| A board for an engine that has none | GAM-24, GAM-8 | Flip 7 and Exploding Kittens have an engine and no board; GAM-8 covers the wiring and the messages of Exploding Kittens too |
| A skill for building a board, `engine-board` | PLT-70 | These pages and `template/docs/GAME_GUIDE.md` |
| The template as a showcase of every feature | PLT-79 | Its board draws no `Pile`, no `grid`, no overlay in a card's `children`, no `standIn`, no glow but the frame and no `lights`; the tests of the package and these pages cover them |

Also not in the package, with no ticket of its own:

- A zone anchored to the camera, such as a hand that stays on the screen: a `Zone` lays cards on the table.
- A mat with a behaviour of its own, such as a shader that unrolls it: the table's surface is a colour and a repeating picture, nothing more, and a mat is a plane the game draws on it.
- A table lit like a room, such as Courtisans' vignette: the surface is flat and unlit, so the game draws its own gradient, and that plane has an edge to hide.
- A click on empty space: `Table` does not pass on the `onPointerMissed` of its canvas ([Clicks and hover](01-the-game/05-actions.md#clicks-and-hover)).

# Victory and results

A game ends when its `isOver` is true, and core then stores the status `over`. How that is decided is the game's own rule: a score target over several rounds, a condition on the state, or the last player still in ([Players who are out](02-players.md#players-who-are-out)). `Results` and `PlayerResult` are in `packages/engine-kit/src/contract.ts`, the scores over rounds in `packages/engine-kit/src/rounds.ts`.

## Results

- The definition has no member for results: the view holds `results: Results | null`, set once the game is over (`isOver`), the same for every viewer, the public view (`view(state, null)`) included.
- `Results` is `{ players: PlayerResult[]; winners: string[]; coop?: "won" | "lost" }`; `winners` are player ids, several on a tie.
- A `PlayerResult` is `{ playerId, total, rank, detail }`: `total` is the score shown, `rank` starts at 1 and a tie shares a rank (`ranks()` of the kit), `detail` is a list of `{ key, values?, points }` drawn as chips: the words of a line are the game's, written in its Sanity under `score.<key>`, and `values` fills their variables ([The words of options and scores](07-parameters.md#the-words-of-options-and-scores)); a `label` is deprecated and shown as written while a game has not moved it. A game can extend it with fields for its own board.
- `coop` is for a game the whole table plays on one side, against the game itself (Hanabi, Sky Team, The Mind): `"won"` or `"lost"`, for every player at once. Every player then has rank 1 and the table's score as `total`, and `winners` lists every player when the table won and nobody when it lost. A game where the players play against each other leaves it out and names at least one winner.
- Core reads `view.results` when `PublicGame.status` is `over`, for the game-over panel, the announcement of the end and the share image and text. The server reads it too, once, to write the game down (`recordGameResult` in `packages/core/server/results.ts`, PLT-13): the public view of the table, `view(state, null).results`, is the one source, and the platform never asks an engine for anything else.

## Outcomes

The history keeps how a game ended for each player: `win`, `loss`, `draw`, `coop_win`, `coop_loss` or `abandoned` (`Outcome` in `packages/ui/src/results.ts`, `game_participants.outcome`, migration `0006`). The engine does not write it: it states the results, and `outcomesOf(results)` of the kit reads them into an outcome for each player, in the order of `results.players`; the platform writes them in the database when the game ends, and adds the place and the score of each player (`rank` and `total` of the results), the account that held the seat, and whether the game counted for the ratings. A game played together (`coop`) is told as `coop_win` or `coop_loss` with the table's score, and is rated apart from the games played against each other: it has no Elo. A game that the engine ends is `finished`; `abandoned` is the platform's, for the day a player can give up a game that runs (PLT-21).

| Outcome | When |
| --- | --- |
| `coop_win`, `coop_loss` | `coop` is set: the table won or lost together, for every player |
| `win` | The player is among the `winners`, and not every player of the table is |
| `draw` | Every player of a table of two or more is among the `winners` |
| `loss` | The player is not among the `winners` |

- A tie for the first place among some of the players is a win for them: they beat the rest, whatever they did to each other. A team that wins puts all its members in `winners` and is read the same way; the results say nothing of the team itself ([Not built yet](../03-not-built-yet.md#what-the-contract-leaves-out)).
- A player alone at a table has no one to draw with: a win.
- `abandoned` is not the engine's to say, since only the platform knows that a player gave up ([Leaving a table](02-players.md#leaving-a-table)). `PlayerOutcome` leaves it out, and a test of core keeps it inside `Outcome`.

The end screen tells the same distinction. A table that lost together (`coop` is `"lost"`, `endingOf(results)` of core is `"defeat"`) has nobody to crown, so it is told as a defeat and not as a victory with no winner:

- The board announces it with the `defeat` kind of [announcement](../../design/04-in-game/06-announcements.md): `winnerAnnouncement` gives the `kind` along with the sentence, the template announces with it, and nobody is shown with it.
- The panel of the [game over](../../design/04-in-game/07-game-over.md) puts `defeatTitle` where it puts `winnerTitle` for a victory, over the ranking of the whole table.
- The share image names the whole table under no crown, with `shareHeadlineDefeat`, and the share text is `lostWith`.
- Those three words are labels of the platform in `UI_TEXTS`, in English until the language pass (`ENGLISH_ONLY_TEXTS` of `@pbgo/studio-kit`), that a game's Copy overwrites like the others. A game that wants the words of its own universe writes them there.

From `packages/engine-kit/src/outcomes.ts`, the rules above in code:

```ts
function outcomeOf(results: Results, playerId: string): PlayerOutcome {
  if (results.coop !== undefined) return results.coop === "won" ? "coop_win" : "coop_loss"
  if (!results.winners.includes(playerId)) return "loss"
  // Everybody at the top of a table of two or more is a draw; some of them at the top beat the rest and win. A player alone at a table has no one to draw with
  return results.players.length > 1 && results.winners.length === results.players.length ? "draw" : "win"
}
```

## Rounds

Scores over several rounds: the game goes on until somebody reaches a target, then the best total wins, the highest or the lowest. Totals are arrays in seat order: `totals[seat]` is the total of the player in that seat.

| Export | What it does | Errors |
| --- | --- | --- |
| `RoundsRule` | `{ target, wins, tie }`: `wins` is `"high"` or `"low"`; on a tie for the best total, `tie` is `"shared"` (all of them win) or `"playOn"` (one more round) | |
| `addScores(totals, scores)` | The totals after a round, seat by seat | `RangeError` if the scores do not match the seats |
| `sumRounds(rounds, seats)` | The totals of `seats` players from the scores of each round, `rounds[round][seat]` | `RangeError` for a `seats` that is not a non-negative integer and for a round that does not match |
| `leaders(totals, wins)` | The seats that hold the best total, in seat order: all of them when tied, none when there is no seat | |
| `ranks(totals, wins)` | The rank of each seat from 1: a tie shares a rank and the next ones are skipped (1, 2, 2, 4) | |
| `roundsOutcome(totals, rule)` | `{ over: false }`, or `{ over: true, winners }` with the winning seats | |

- Store the scores of each round, `rounds[round][seat]`, and derive the totals with `sumRounds`, never store the totals as well ([Lean state](09-state.md#lean-state)).
- The game is over once some total reaches the target or goes above it, and the winner is the best total, not necessarily that one. A tie for the best total is settled by `tie` (a tie for another place does not matter), and a game with no seat is never over.
- `winners` and `leaders` are seats, not player ids: `Results.winners` are ids, so map them with the game's seats. `ranks` feeds `PlayerResult.rank`.

From `games/flip-7/packages/engine/src/machine.ts`, where the rule comes from an option and the winners become player ids:

```ts
export function rulesOf(s: State): RoundsRule {
  return { target: targetOf(s), wins: "high", tie: "playOn" }
}
// …
export function winnersOf(s: State): string[] {
  const outcome = roundsOutcome(totalsOf(s), rulesOf(s))
  return outcome.over ? outcome.winners.map((seat) => playerAt(s, seat)) : []
}
```

## Objectives

An objective is a goal a player is dealt, written as data and checked against the state of the game. Courtisans' missions are the only objectives in the repo: a `Mission` holds a `Condition`, `evaluateCondition` reads it against the state and `computeResults` turns it into points. The code is `types.ts`, `missions.ts` and `scoring.ts` in `games/courtisans/packages/engine/src` ([Courtisans](../05-examples/02-an-engine-with-setup-data.md)).

From `games/courtisans/packages/engine/src/types.ts`, the tree: five leaves that read the state, and `and`, `or` and `not` that combine them:

```ts
export type Condition =
  | { type: "familyStatus"; family: Family; status: Status }
  | { type: "familiesWithStatus"; status: Status; comparator: Comparator; value: number }
  | { type: "domainCards"; filter: CardFilter; comparator: Comparator; value: number; mode?: CountMode }
  | { type: "tableCards"; filter: CardFilter; level?: Level; comparator: Comparator; value: number; mode?: CountMode }
  | { type: "playerComparison"; filter: CardFilter; comparator: Comparator; opponent: Opponent; mode?: CountMode }
  | { type: "and"; conditions: Condition[] }
  | { type: "or"; conditions: Condition[] }
  | { type: "not"; condition: Condition }
```

- A leaf reads the player's domain, the cards on the table, the other players' domains or the status of the families (`computeStatuses`); a count is of cards, or of their weight with `mode`. `and` holds when every condition does, `or` when one does and `not` inverts one; `evaluateCondition` changes nothing.
- The missions are Sanity documents (`mission`: a colour, a text, a card and a `condition`). `loadMissions` in `games/courtisans/src/server/missions.ts` checks them, skips and logs a mission with an invalid value, and `loadSetupData` hands the rest to `setup` as its `SetupData` ([Game data](08-game-data.md)).
- `setupGame` deals each player a white and a blue mission, drawn with the seeded stream from the missions it is given, and throws `NOT_ENOUGH_MISSIONS` when a colour has fewer missions than players.
- A player sees their own missions in `me.missions`; `missions` of the other players is `null` until the game is over ([Hidden information](10-views.md#hidden-information)).
- Nothing is checked while the game goes: `playerView` computes the results when the phase is `over`, and `computeResults` evaluates every mission against that final state.
- A mission that holds is worth `MISSION_POINTS`, added to the domain points in `total`. `CourtisansPlayerResult.missions` lists each mission with `done` and its `points`, and the generic `detail` has one `missions` line with their sum.

## Opening and ending

The shared tools give an opening one piece, the camera's entrance, and an ending none: the sequences around a game are written per game. The template has neither; it announces the start and the victory and shows the game over. What a sequence can be built on:

- The camera's entrance ([The entrance](../02-components/02-camera.md#the-entrance)) plays when the `Table` mounts, and again when `playIntro` turns true after being false.
- The platform's start screen: the board is drawn behind it and says when it is loaded (`onLoaded` of `Table`), and the entrance waits for the screen to go (`held`). A board holds its own opening while `held` is true and reports what it loads without suspending with `onLoaded`; the screen waits for every board of the table before it goes. The template takes both in `game.tsx`, hands them to `Scene` and on to `Table`, and holds its own start announcement the same way.
- Cards that come in one after the other: `enter` and `stagger` of a [Zone](../02-components/07-zones.md#zone), or a `from` pose with a `delay` on a card.
- The `start` and `victory` announcements and the `GameOver` panel, which the shared UI draws over the board ([Announcements](../../design/04-in-game/06-announcements.md), [Game over](../../design/04-in-game/07-game-over.md)). The template announces the start when a game begins and the victory when `phase` is `over`, then shows `GameOver` once the announcement is done.
- The photo of the finished table for the share image ([Share photo](../02-components/01-table.md#share-photo)).

A sequence of a game's own is a state in the game's component, not something in `@pbgo/table`. Time belongs to the board: an engine has no clock ([Not built yet](../03-not-built-yet.md#what-the-contract-leaves-out)), so a timer lives in a component, and the state it advances is presentation only. The board of Courtisans has two sequences, in `games/courtisans/src/components/game/game.tsx` and `game3d/`:

- The opening is a step, typed `OpeningStep` in `game3d/scene.tsx` (`"unroll"`, `"deal"`, `"missions"` or `null`), that the board moves forward with timers once the scene reports it is mounted (`onReady`). The scene reads it to decide what to draw and where cards come from: the mat unrolls, the cards are dealt, the missions are shown. Its pieces are in the same file: a mat with a shader and a roller that unroll it, a pile that drops card by card (`DrawPile`) and a group that rises out of the table with a height fade (`Appear`, `withFade`).
- The ending is `useEndingSequence` in `game3d/ending.ts`: a list of steps, each a time and a patch of an `EndingState`, played with timers once the game is over. The scene reads that state to draw each step (`game3d/ending3d.tsx`), and a button jumps to the final state.
- Both start from the view, not from a click; a visitor who reloads during one sees it again from its start.
- The announcement queue is held while the opening runs (`paused` of `useAnnouncements`), and the debug panel replays each sequence, the ending step by step ([Tuning](../04-build-a-game/07-tuning.md)).

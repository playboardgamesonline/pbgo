# Events and the log

What happened in a game, apart from its state. The state keeps what the next move needs ([Lean state](09-state.md#lean-state)); the history on the screen, the sentences of the HUD and the motion of a board need what each move did. The engine says it, the platform keeps it, and each player reads their own version of it.

## What an engine says

- `step(state, action)` is `apply` that also says what happened: it returns a `Step`, the new state and the `events` of the move, oldest first. `GAME.apply` stays, as `(state, action) => step(state, action).state`: the state is the same whichever is called, and the engine's own tests check it.
- `autoPlayStep(state, playerId)` is the same for `autoPlayFor`, so that what is played for an absent player is in the log too. A game that has a `step` has an `autoPlayStep`.
- `setupStep(args)` is the same for `setup`, for a setup that plays moves a player would want to read: Flip 7 deals the first round while it sets the game up, and its log opens with that round. Optional.
- An event is plain data, ids and numbers, never display text or a name: the board turns it into a sentence in the viewer's language with the words of the game's Sanity, and the nicknames come from the table ([Where an id comes from](02-players.md#where-an-id-comes-from)).
- An entry is a `LogEntry`: the `event` in full, `to` the players who read it in full (absent: everybody), `masked` what the others read instead ([Per-viewer log](10-views.md#per-viewer-log)). Nothing is hidden in Flip 7; in Exploding Kittens the card a Favor gives is for the two players only.
- The type of the events is the last type parameter of the definition, `GameDefinition<State, Action, View, SetupData, Event>`; a game that says nothing leaves it out, and has no log.
- The platform plays an action through the kit's `stepOf(GAME, state, action)`, a player played for through `playStepFor(GAME, state, playerId)` and a game set up through `setupOf(GAME, args)`, never through the members of the definition: the helpers work for a game that has no log, and give no events.

From `games/flip-7/packages/engine/src/game.ts`, the lines that say it:

```ts
export const GAME: GameDefinition<State, Action, PlayerView, undefined, Flip7Event> = {
  // …
  setupStep: ({ players, options, seed }) => setupStep({ players, options, seed }),
  apply: (state, action) => step(state, action).state,
  step,
  autoPlayFor,
  autoPlayStep,
}
```

## What the platform does

- `updateGame` (`packages/core/server/games.ts`) writes the move and, when the modifier gave entries (`log: { entries }`), adds them to the log of the table, `game_log` (migration `0016`), under the version the move produced, before it tells the others (`notify`). The routes that move a game give them: `action` (`stepOf`), `takeover` (`playStepFor`, one list for all the plays of the request) and a new game (`newGame`: it empties the log of the table, then writes what the setup said).
- The log is not needed to play. A table whose log cannot be written or read goes on and its history is short; a game with no `step` never touches `game_log`.
- A table keeps its log as long as it keeps the table (30 days after its last write) and drops it with its state, a day after the game it played is recorded: an entry can hold what only some players were shown (`drop_finished_states`).
- Every route that answers a player with the table does it with `servedGame`: the public game, and in `PublicGame.log` the last 60 lines of the log as that player reads them (`viewLog`).
- A line is `{ v, event }`: `v` is the version of the table that the move produced. The lines come in the order they happened and a move's lines share their `v`; what a viewer may not read is left out, so the `v`s of their lines can skip some.

## What a board does

- `useGameLog<Event>()` (`@pbgo/core/components/game/context`) gives the lines. The history of the HUD is `groupTurns(lines.map((line) => line.event), …)`, as the template does ([The screen around the table](../../design/04-in-game/01-screens-and-game-flow.md)).
- A board that animates uses `usePlayLog` (`@pbgo/core/components/game/use-play-log`), which keeps the greatest `v` played and plays the lines with a greater one, in order: `play(line, { instant })` may return a promise, and the next line waits for it. The first time a board opens a table it plays nothing: it draws the state and takes the greatest `v` it finds. `instant` is true when motion is off (the visitor's preference, a hidden tab) and for all the lines of a batch of more than twelve, so a player who was away does not watch a minute of animation. `busy` says lines are playing, to hold the buttons back. A handler that throws is reported and the next line plays. The rules are those of `createLogPlayer` (`lib/log-player.ts`, tested).
- The log tells what happened, the view tells what is there. A board draws the view, and uses the log for sentences and motion, never to work out the state.

## Testing

- `conformanceProblems` checks a game that says what happens: `step`, `autoPlayStep` and the optional `setupStep` come together, `autoPlayStep` plays what `autoPlayFor` plays and `setupStep` sets up what `setup` sets up, each says the same every time, and the entries are plain data, addressed to players of the table, with no nickname and nothing that `secretsFor` forbids to a viewer who only reads the `masked` version ([The conformance test](../04-build-a-game/06-testing.md#the-conformance-test)).
- The engine's own tests check `step` against `apply` and the events against the rules, as Flip 7 does in `games/flip-7/packages/engine/src/game.test.ts`.

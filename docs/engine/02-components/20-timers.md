# Timers

A step of a game can have a clock: a turn of thirty seconds, a round of ninety, a window of five seconds in which a card can still be played over another. When the time runs out the game does what its rules say, which is usually to play for the players it was waiting for. The clock is not the board's: the engine decides what happens at the deadline, the server plays it, and the board only shows how much time is left. On the table that is an hourglass, `Timer`.

Start the clock and the sand runs from the top bulb to the bottom one while the seconds go. Start a new step and the hourglass turns over; run it out in four seconds and the sand reddens and the glass trembles. The three small ones have no clock and show a share of the time. The engine does not play the move when the time is out: the platform does, and the specimen only counts how many times the board was told.

```specimen
scene-timer
```

## The parts of a clock

| Part | What it is | Where it comes from |
| --- | --- | --- |
| Length | How long a step lasts, in seconds | The game: an option of the lobby, a rule, a constant |
| Timer | The clock of the step the game is on: when it ends and how long it was set for | The state of the engine, a `Timer` made by `startTimer` |
| Time | What time it is | The server: the `at` of every action. The engine never asks a clock |
| Deadline | When the game needs the clock next, and the system action to play then | `nextDeadline` of the engine |
| Settling | Playing the deadlines that are due | The platform, on the first request that looks at the table |
| Time left | How long until the deadline, as a duration | `PublicGame.deadlineInMs`, counted down by the board as `deadlineAt` |
| Hourglass | What the time left looks like | `Timer` of `@pbgo/table` |

## In the engine

An engine has no clock. It never reads `Date.now()`, so the same seed and the same actions at the same times replay the same game. The server tells it the time instead: every action it plays carries the time it was played at, `PlayerAction.at`, in milliseconds on the server's clock. A value that a client puts there is replaced by the server's.

- Keep the clock of the step in the state, as a `Timer`: `{ endsAt, seconds }`, two numbers, so the state stays plain data. `startTimer(at, seconds)` makes one, `restartTimer` sets it again from a new time, `extendTimer` adds seconds to it, and `timeLeft`, `timerDone` and `timerFraction` read it.
- Start the clock of a step from the `at` of the action that began it. A step that follows another one starts its clock from the time the first one ended, so the game is the same whenever the server got to it.
- Start the first clock in `begin(state, at)`, not in `setup`. A table is set up when the lobby starts it and goes live when every player has loaded the board: `begin` is called then, so the players do not lose time to the ready check.
- Say when the game needs the clock next in `nextDeadline(state)`: the time, `at`, and the system action to play then, built with `systemAction("timeout", at)`. Return null when there is no clock, between two steps that have none, and when the game is over.
- A system action is the clock's, so its `playerId` is `SYSTEM_PLAYER` and its type is no entry of `clientActions`: the route refuses it from a player, and the server puts the player's own id on whatever a player sends. Check `isSystemAction` in `apply` all the same, so that an action of the clock's type that the clock did not send is refused.
- What the system action does is the game's rule. Playing for the players the game was waiting for, as it does for an absent player (`autoPlayFor`), is the usual one; a pass, a lost turn or a random card are others. Whatever it does, the step it ends starts the next one's clock from the action's `at`.
- The view says how long a step lasts, `timer: { seconds }`, and not when it ends: that is the platform's to say, from its own clock, as a duration.

```ts
type State = { /* ... */ timer: Timer | null }

const game: GameDefinition<State, Action, View> = {
  // The table goes live: the clock of the first step starts now
  begin: (state, at) => ({ ...state, timer: startTimer(at, state.options.turnSeconds) }),
  // When the game needs the clock next, and what to play then
  nextDeadline: (state) => (state.timer ? { at: state.timer.endsAt, action: systemAction("timeout", state.timer.endsAt) } : null),
  apply: (state, action) => {
    // The clock ran out: play for whom the game waits for, then start the clock of the step that follows
    if (action.type === "timeout") return timeout(state, action)
    // A move ends the step and starts the next one's clock at the time of the move
    return clocked(state, move(state, action), action.at)
  },
  // The board draws the time that is left from the length, and from the deadline the platform gives it
  view: (state) => ({ /* ... */ timer: state.timer && { seconds: state.timer.seconds } }),
}
```

The demo of the template does this with the option `turnSeconds`: turn it on in the lobby and every turn and every round of bids has a clock.

The conformance test of an engine plays a game that has a clock the way the server does: it goes live with `begin`, tells every play the time, and now and then plays the deadline in place of the players. It checks that `begin` is harmless to call again, that a deadline is plain JSON, a finite time and a system action that no client may send, that it is the same once jsonb has reordered the keys of the state, that the game has none once it is over, that its action is playable, deterministic and changes the state, and that the next deadline is never earlier than the one just played.

## On the platform

Nothing runs on a timer. The first request that looks at a table whose deadline has passed plays it: the read that every board polls, the board's page, a move, a vote of the takeover, the ready check and the `tick` a board sends when its countdown ends. The write carries the version of the game, so of several requests that look at once one plays the deadline and the others find nothing due.

- Each deadline is played with its own time as the action's `at`, not the time the server got to it. A table nobody looked at for a while catches up one deadline after the other, up to `MAX_DEADLINES` in one call, and ends up as it would have if the server had been there.
- The players the clock played for are recorded as played for, as the players the takeover plays for are, so a game that they did not play moves no rating.
- A deadline that the game refuses, which is a bug of the game, is written in the log of the server and left: the table can still be read and its players can still move.
- A table tells its players how long is left, `deadlineInMs`, and not when it ends, so a device whose clock is off does not matter. The board counts it down from the moment it received it and gets `deadlineAt` on the clock of its own page, `performance.now()` (`BoardProps`).
- When the countdown ends the platform waits a few hundred milliseconds, a different time for each board, and asks the server to play the deadline (`POST /api/<slug>/games/<code>/tick`, rate limited). A board that never gets there, a tab in the background, is moved on by the next read.

A game has none of this to write: it gives `begin`, `nextDeadline` and the action, and draws the time that is left.

## On the table

### The hourglass

```tsx
<Timer endsAt={deadlineAt} seconds={view.timer.seconds} at={{ x: 6.6, z: 3.4 }} onEnd={() => play("gong")} />
```

| Prop | Role |
| --- | --- |
| `endsAt` | When the time ends, on the page's clock: the `deadlineAt` of the board. Null when no clock runs: the hourglass then shows `rest` of its time and waits |
| `seconds` | How long the step lasts, the whole of the hourglass. The game's view says it |
| `at` | Where it stands on the table, `x` and `z`, and the way it faces, `yaw` |
| `size` | How tall it is (default `TIMER_SIZE`) |
| `rest` | What is left when no clock runs, from 0 to 1 (default 1) |
| `sand`, `glass`, `wood` | Its colours |
| `digits` | Writes the seconds that are left in front of it, with a `Counter` (default true) |
| `onEnd` | The time is out, called once for each clock: a gong. The game does nothing else with it |
| `onSecond` | A second has gone, with the seconds that are left: a tick |
| `shadow` | Casts a shadow on the table (default true) |
| `onClick`, `onHover` | The hourglass can be pressed |

How it moves:

- The sand runs while the clock does, a thin stream falling through the neck. The top bulb empties slowly at first and quicker toward the end, as a real one does, and the pile in the bottom bulb grows the same way.
- A clock that ends later than the one before, by more than a second, is a new step: the hourglass hops and turns over, the sand has run out of it by half way, and the new sand settles into the bulb. A clock that is moved by a read of the table, by the time the read took, is not a new step. A clock that begins after none turns it over too.
- In the last `warn` seconds the sand goes toward red and the hourglass trembles more and more, and it stands still once the time is out. The sound, the ticks and the gong are the game's: it gives them to `onSecond` and `onEnd`.
- A visitor who asks for less motion sees the sand run, the digits change and the colour go red, with no turning over and no trembling.
- It carries its own light, as a die does, and is lit again as it turns over: the table needs none for it.

### Settings

`TIMER_SETTINGS` is read on every frame by every hourglass: how long it takes to turn over, how high it hops, how many seconds before the end the warning begins, how far the hourglass trembles and its shadow. The debug panel has a Timer folder for it ([Tuning](../04-build-a-game/07-tuning.md)).

### Not built

- A clock for each player, as in chess: a game keeps the time of each player in the state and makes `nextDeadline` the soonest of them. The kit does not do the arithmetic yet, and the table has no clock for a seat.
- A table that nobody looks at does not move on until someone does. A job that visits the tables whose deadline has passed would, so that the other players are not left waiting for a player who closed the page.
- Pausing the clock: when the game waits for a player who is away, or for a window of the platform, the time goes on.
- A look other than the hourglass: a ring round a seat, a bar. `shareLeft(deadlineAt, performance.now(), seconds)` gives a game the share that is left, from 1 to 0, and `secondsLeft` the seconds to write; the game draws them in a frame of its own, until a component does.
- The sounds of the clock: the platform has none. A game puts its own on `onSecond` and `onEnd`, and the sounds live in its Sanity project.

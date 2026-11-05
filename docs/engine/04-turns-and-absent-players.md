# Turns and absent players

The engine tells the server whose move it is and how to play it for a player who left; core does the rest. This page covers the two hooks, the helpers that read them, simultaneous steps, the takeover and the limits of the contract.

## What the game waits for

- `waitingFor(state)` returns the ids of the players the server waits for, in seat order and without duplicates ([Every order comes from an array](03-state-and-determinism.md#every-order-comes-from-an-array)).
- It lists one player on a classic turn and several on a simultaneous step. It is empty when the game is over, or when the engine itself waits for something that is not a player, such as a deadline.
- It is public: `publicGame` sends it to every viewer, so it never reveals anything hidden. When knowing who is still pending would tell something (who passed on an answer, say), keep the player listed until it is public anyway.
- The shared UI draws from it: the ticker's main line, the players strip when several players are waited for ([In-game UI](../design/04-in-game.md#players-strip)) and the takeover pill.
- A player can leave the list without having acted, because somebody played for them: a board follows the view.

From `template/packages/engine/src/demo/game.ts`, a game that waits for everyone who has not bid, then for the player of the turn:

```ts
function waiting(state: State): string[] {
  if (state.phase === "bidding") return pendingSubmissions(state.bids, seats(state))
  if (state.phase === "playing") return [state.players[state.activePlayer]!.id]
  return []
}
```

## Playing for an absent player

- `autoPlayFor(state, playerId)` completes the current step of one waiting player; the server calls it when the others vote to play for a player who left.
- It always produces a legal state.
- It is deterministic: seeded streams only ([Determinism](03-state-and-determinism.md#determinism)).
- It completes that player's current step: afterwards they no longer wait for it, though they may wait for the next, such as their next turn.
- It throws `EngineError("NOT_WAITING")` when `playerId` is not in `waitingFor(state)`.
- It plays one player at a time: a step owed by several players is played for player by player, each by its own vote.
- It is a fallback that keeps the table moving, not an AI: the simplest legal play.

## The kit's helpers

Everything that needs to know whose turn it is goes through these helpers (`packages/engine-kit/src/turns.ts`), never through the hooks of the definition. They take any object with the turn hooks (`TurnHooks<State>`).

| Helper | Behaviour | Errors |
| --- | --- | --- |
| `waitingPlayers(game, state)` | The players waited for: `waitingFor`, else the legacy `activePlayer` as a list of one; in seat order, no duplicates, empty once the game is over | |
| `currentPlayer(game, state)` | Whose turn it is, or `null`: the legacy `activePlayer` when defined, else the first waiting player | |
| `canPlayFor(game)` | Whether the server can play for an absent player: the game knows who waits and has a way to play. Reads the definition, not a state | |
| `playFor(game, state, playerId)` | Plays one waiting player's current step with `autoPlayFor`; the legacy `autoPlay` or `debug.turn` when that player is the only one waiting | `NOT_WAITING`, `AUTOPLAY_UNSUPPORTED` |
| `playOn(game, state, maxSteps)` | Plays for the first waiting player until the game is over, nobody is waiting or `maxSteps` plays were made; for tests and simulations | Those of `playFor` |

## Simultaneous steps

Several players answer in any order and the last answer ends the step (secret bids, everybody reads their missions). Keep the answers in the state as `Submissions<T>`, a `Record<string, T | null>` keyed by player id, `null` until the player answers.

| Helper | Use in an engine |
| --- | --- |
| `openSubmissions(playerIds)` | Opens the step: nobody has answered |
| `submit(submissions, playerId, value)` | In `apply`, records the answer. Answering again replaces it; a game whose answers are final refuses the second one itself. `RangeError` for a player outside the step and for `null` or `undefined` |
| `allSubmitted(submissions)` | In `apply`, once true, resolve the step in the same action: the state never sits between two phases |
| `pendingSubmissions(submissions, seatIds)` | In `waitingFor`: who has not answered, in seat order |
| `submittedFlags(submissions)` | In `view`: who answered, never what, until the step is resolved |
| `revealSubmissions(submissions, seatIds)` | In the resolution: the answers in seat order; `RangeError` if one is missing |

`autoPlayFor` answers for that one player, so several absent players are played for one after the other.

## How a simultaneous step is written

The secret bids of the demo, from `template/packages/engine/src/demo/game.ts` (its `waitingFor` is the `waiting` function [above](#what-the-game-waits-for)):

```ts
function bid(state: State, action: Bid): State {
  if (state.phase !== "bidding") throw new EngineError("INVALID_PHASE")
  // …
  // a bid can be changed until the last player has bid
  const bids = submit(state.bids, player.id, action.amount)
  return allSubmitted(bids) ? { ...state, bids, phase: "playing" } : { ...state, bids }
}
```

## Absent players in core

Nothing of this is written in a game: `waitingFor` and `autoPlayFor` are all core needs. The pure rules are in `packages/core/server/takeover.ts`.

1. **The delay.** No write to the table for `turnTimeout`, less `STALL_GRACE_MS`. The gamemaster sets it per game in Setup › Mechanics, within `TURN_TIMEOUT_BOUNDS`; a vote does not restart it.
2. **The pill.** A board mounts `StalledTurn`. Once the delay has passed and the game waits for somebody else, it offers to play for them and shows how many of the required voters have voted; `labels` re-words it for a phase.
3. **The vote.** `POST .../takeover` with the `playerIds` to play for (by default every player waited for, never the voter), under the `vote` rule of `RATE_LIMITS`.
4. **The checks.** `TAKEOVER_UNSUPPORTED` when `canPlayFor` is false, `UNKNOWN_PLAYER` for a voter outside the table, `GAME_NOT_STARTED`, and `NOT_STALLED` when the table moved within the delay or nobody is waited for any more.
5. **Who must agree.** Every present member other than the target. Present means seen within `PRESENCE_WINDOW_MS`; the voter always counts as present, an absent member never blocks, and a voter who is alone is enough.
6. **Presence.** Reading the table, playing, voting or chatting records the player (`markSeen`, at most once per `SEEN_WRITE_EVERY_MS`) without changing `version` or `updated_at`. A board reads its table on a timer, which keeps its player present.
7. **The stored votes.** `takeover_votes` holds `<fingerprint of the state>:<voter>:<target>`. A move changes the fingerprint, so older votes are ignored; a vote moves `version`, so boards refresh their count, but not `updated_at`.
8. **The play.** For each target whose vote is complete, in the order the game waits for them, the route calls `playFor` if the game still waits for the player, then stores the new state with `takeover_votes` emptied, in one write. A takeover that ends the game stores the status `over`.

## Limits

- The contract has no server time and no deadlines (PLT-43): an engine cannot ask to be played at a given time, nothing closes a `waitingFor` on a clock, and the state has no time to read. The only delay is the one core measures for the vote (`turnTimeout`).
- The contract has no system actions (PLT-43): once a game has started, every change of its state comes from a player's action, a takeover or a debug command.
- The contract has no asynchronous games over several days (PLT-30): the delay to play for an absent player stays within `TURN_TIMEOUT_BOUNDS`, presence is the window `PRESENCE_WINDOW_MS`, and a vote has to come from a member who is at the table.
- The contract has no expansions (PLT-27): an optional module of a game is an option of the group `extension`, a boolean the engine implements itself.
- The contract has no replay from the action log (PLT-29): the `games` table stores the current state, not the actions that led to it, and its `replay` column holds the votes for a rematch. The same seed and the same actions give the same game, which is what such a replay would rely on.

## Testing turns

- `playFor` plays for a waiting player and throws `NOT_WAITING` for anybody else, and for the same player once their step is done.
- `playOn` plays whole games: loop it over seeds and table sizes and check what must hold at the end.
- Assert `waitingFor` at each phase, and in seat order for a state whose keys `jsonb` gave back in another order.
- For the binding, `template/src/takeover.test.ts` plays a whole game in which players never come back, with the real `castVotes`, `presentPlayers` and `isStalled` of core; only its `humanMove` knows the game, so adapt it to the new engine (`pnpm --filter @pbgo-game/<slug> test`).
- For the server, `server/takeover.test.ts` tests the voting rules and `server/game-events.test.ts` the routes against an in-memory table.

From `template/packages/engine/src/demo/game.test.ts`:

```ts
const played = playFor(demo, e, "j1")
expect(() => playFor(demo, played, "j1")).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))
```

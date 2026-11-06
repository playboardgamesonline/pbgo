# Rounds

Scores over several rounds: the game goes on until somebody reaches a target, then the best total wins, the highest or the lowest. The module is `packages/engine-kit/src/rounds.ts`. Totals are arrays in seat order, so `totals[seat]` is the total of the player in that seat and no order comes from the keys of a stored object.

## Exports

| Export | What it does | Errors |
| --- | --- | --- |
| `RoundsRule` | `{ target, wins, tie }`: `wins` is `"high"` or `"low"`; on a tie for the best total, `tie` is `"shared"` (all of them win) or `"playOn"` (one more round) | |
| `addScores(totals, scores)` | The totals after a round, seat by seat | `RangeError` if the scores do not match the seats |
| `sumRounds(rounds, seats)` | The totals of `seats` players from the scores of each round, `rounds[round][seat]` | `RangeError` for a `seats` that is not a non-negative integer and for a round that does not match |
| `leaders(totals, wins)` | The seats that hold the best total, in seat order: all of them when tied, none when there is no seat | |
| `ranks(totals, wins)` | The rank of each seat from 1: a tie shares a rank and the next ones are skipped (1, 2, 2, 4) | |
| `roundsOutcome(totals, rule)` | `{ over: false }`, or `{ over: true, winners }` with the winning seats | |

## Rules

- Store the scores of each round, `rounds[round][seat]`, and derive the totals with `sumRounds`, never store the totals as well ([Lean state](../03-state-and-determinism.md#lean-state)).
- The game is over once some total reaches the target or goes above it, and the winner is the best total, not necessarily that one.
- A tie for the best total is settled by `tie`; a tie for another place does not matter, and a game with no seat is never over.
- `winners` and `leaders` are seats, not player ids: `Results.winners` are ids, so map them with the game's seats; `ranks` feeds `PlayerResult.rank` ([Results](../02-contract.md#results)).

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

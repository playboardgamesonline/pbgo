# A lean engine, file by file

Flip 7 is a press-your-luck card game played in rounds up to a target score. Its engine, `games/flip-7/packages/engine/src`, is the reference for a lean state and for the way a step is written; the rules as coded are in `games/flip-7/CLAUDE.md`. Its binding exports no `GAME` and the game has no board (GAM-24).

## The files

| File | What it holds |
| --- | --- |
| `types.ts` | `State`, `Frame`, `Status`, `Action` and `CLIENT_ACTIONS`, the views (`PlayerView`, `PublicSeat`, `PublicPhase`), the events (`Flip7Event`, `Flip7Step`) and `FLIP7_ERROR_CODES` |
| `catalogue.ts` | The box as data: `CARDS`, `DECK`, `CATALOGUE`, `cardType` |
| `options.ts` | `OPTIONS` and `DEFAULT_TARGET` |
| `scoring.ts` | What a line of cards is worth: `lineScore`, `isFlip7`, `numberValues` |
| `machine.ts` | `open` and `close` of a step, the readers of a state, `waitingFor`, `isOver`, `totalsOf`, `rulesOf` |
| `round.ts` | How a round goes: `run`, `receive`, `giveCard`, `endRound`, `startRound` |
| `actions.ts` | `hit`, `stay`, `chooseTarget`, `dealRound`, `perform` and `step`, the one entry point |
| `setup.ts` | `setupGame`, `MIN_PLAYERS`, `MAX_PLAYERS` |
| `results.ts` | `results`, the ranking of a finished game |
| `view.ts` | `playerView` |
| `autoplay.ts` | `autoPlay` and `autoPlayFor` |
| `debug.ts` | `debugCommands` |
| `game.ts` | `GAME` |
| `index.ts` | The exports, the kit's too |
| `test-utils.ts` | Helpers of the tests, not exported: `layout`, `problems`, `reorderKeys`, `deepFreeze` |
| `*.test.ts` | One file per part of the rules, and `simulation.test.ts` |

## The state

- A card in the state is the opaque id it holds now (`ids[card]`, [Opaque ids](../01-the-game/10-views.md#opaque-ids)); `CATALOGUE`, built from `DECK`, says what it is ([Lean state](../01-the-game/09-state.md#lean-state)).
- The keys of `CARDS` are a contract with the Studio and the art files: append only, never rename (`games/flip-7/content/parity/engine.test.ts`).
- A round is a stack of `Frame`s that `run` plays until a player is needed, so between two moves the stack is empty or ends with a `turn` or a `target`. From `games/flip-7/packages/engine/src/types.ts`, the frames and the `State` that holds them, comments left out:

```ts
export type Frame =
  | { kind: "deal"; given: number }
  | { kind: "turn"; seat: number; acted: boolean }
  | { kind: "flip"; seat: number; remaining: number; held: number[] }
  | { kind: "target"; seat: number; card: number }
// …
export type State = {
  seats: string[]
  ids: number[]
  rng: number
  deck: number[]
  stack: Frame[]
  // …
}
```

## The step and who it waits for

- `step` opens a private copy of the state, checks and plays the action on it ([Two kinds of errors](../01-the-game/05-actions.md#two-kinds-of-errors)) and closes it with the stream saved back; it returns the state and the events of the move (`Flip7Step`); `GAME.apply` keeps the state and `GAME.step` hands the events to the platform ([Events and the log](../01-the-game/12-events-and-the-log.md)). From `games/flip-7/packages/engine/src/actions.ts`:

```ts
export function step(state: State, action: Action): Flip7Step {
  const ctx = open(state)
  perform(ctx, action)
  return close(ctx)
}
```

- `waitingFor` is one player or nobody, read from the top of the stack, in `games/flip-7/packages/engine/src/machine.ts`:

```ts
export function waitingFor(s: State): string[] {
  const top = s.stack.at(-1)
  if (top === undefined) return isOver(s) ? [] : [playerAt(s, s.dealer)]
  if (top.kind === "turn" || top.kind === "target") return [playerAt(s, top.seat)]
  return []
}
```

- `autoPlayFor` plays the simplest legal step, the same for the same state, and throws `NOT_WAITING` for anybody else; the platform calls it through `playFor` ([Turns](../01-the-game/03-turns.md)).

## Options, results and tests

- One option, `targetScore` ([Options](../01-the-game/07-parameters.md#options)); a `RoundsRule` read by `roundsOutcome` ends the game, and `results(s)` gives `Results` ([Rounds](../01-the-game/06-victory.md#rounds)).
- `simulation.test.ts` plays tables of every size to the end and runs `problems` after every move, on states passed through `reorderKeys` and `deepFreeze` ([Testing the engine](../04-build-a-game/06-testing.md)).
- `layout()` of `test-utils.ts` rigs a table from card names, as in `games/flip-7/packages/engine/src/autoplay.test.ts`:

```ts
const state = autoPlayFor(layout({ lines: { ana: ["number-9", "plus-2"] }, deck: ["number-1"] }), "ana")
expect(statusOf(state, "ana")).toBe("stayed")
```

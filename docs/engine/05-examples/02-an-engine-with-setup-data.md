# An engine with setup data and secrets

Courtisans is live, and its engine, `games/courtisans/packages/engine/src`, shows what Flip 7 does not need: data loaded from Sanity, a simultaneous opening, a card whose family stays hidden and results with the game's own detail. Its state predates the lean-state rule (it keeps nicknames and a log), so for the state take [Flip 7](01-a-lean-engine.md). The rules as coded are in `games/courtisans/CLAUDE.md`.

## The files

| File | What it holds |
| --- | --- |
| `types.ts` | `FAMILIES`, `ROLES`, `Courtier`, the `Condition` tree, `Mission`, `Player`, `GameState`, `GameEvent`, `Action`, `Phase` |
| `errors.ts` | `EngineErrorCode` and the engine's own `EngineError` class |
| `deck.ts` | `createCourtiers`, `assignOpaqueIds`, `weight`, and the constants `FAMILY_COMPOSITION`, `SET_ASIDE_CARDS`, `HAND_SIZE`, `MISSION_POINTS` |
| `setup.ts` | `setupGame`: the missions drawn, the deck shuffled, the ids assigned, the hands dealt |
| `actions.ts` | `applyAction` (`readMissions`, `playCard`), `waitingPlayerIds`, `availableZones`, `activePlayerId` |
| `missions.ts` | `evaluateCondition`: a mission's `Condition` against the state |
| `scoring.ts` | `computeStatuses`, `domainPoints`, `computeResults`, `CourtisansPlayerResult` |
| `view.ts` | `playerView`, `visibleCard`, `PlayerView` |
| `debug.ts` | `applyDebug`, `autoMove`, `autoMoveRng`, `autoPlayFor` |
| `game.ts` | `GAME` |
| `index.ts` | The exports of every file above; the kit is not re-exported |
| `test-utils.ts` | Helpers of the tests, not exported: `card`, `player`, `makeState`, `testMissions` |
| `*.test.ts` | `actions`, `determinism`, `game`, `missions`, `scoring`, `setup`, `simulation` and `view` |

## Setup data

- `GAME` is a `GameDefinition<GameState, Action, PlayerView, Mission[]>`: `Mission[]` is its `SetupData`, so the engine never reads Sanity ([What an engine never does](../01-the-game/11-the-contract.md#what-an-engine-never-does)).
- `setupGame` draws a white and a blue mission for each player and throws `NOT_ENOUGH_MISSIONS` when a colour has too few.
- `loadMissions` keeps the valid missions of Sanity and skips the others ([Data for the engine and the board](../04-build-a-game/05-wiring-it-in.md#data-for-the-engine-and-the-board)); `loadSetupData`, from `games/courtisans/src/server.ts`:

```ts
export const loadSetupData = ({ sanity }: LoaderContext) => loadMissions(sanity)
```

## Determinism from the seed

- The deal comes from `createRng(seed)` and the opaque ids from a side stream, so the ids never move the deal ([Random numbers](../01-the-game/09-state.md#random-numbers)); `determinism.test.ts` pins it and checks that nothing calls `Math.random` once a seed is given.
- The seed stays in the state, and `autoMoveRng` derives the stream of each automatic move from it and the position in the game, from `games/courtisans/packages/engine/src/debug.ts`:

```ts
export function autoMoveRng(state: GameState): Rng {
  return createRng(sideSeed(state.seed ?? 0, AUTO_MOVE_STREAM, state.turnNumber, state.log.length, state.playedZones.length))
}
```

## The missions phase and the view

- The opening is a simultaneous step: a `missionsRead` flag for each player, not the kit's `Submissions<T>` ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)), and the last reader starts the banquet in the same action.
- `waitingFor` lists the players who have not read, then the active player; `autoPlayFor` reads for that one player or plays the whole turn ([Playing for an absent player](../01-the-game/03-turns.md#playing-for-an-absent-player)). From `games/courtisans/packages/engine/src/actions.ts`:

```ts
export function waitingPlayerIds(state: GameState): string[] {
  if (state.phase === "missions") return state.players.filter((j) => !j.missionsRead).map((j) => j.id)
  const active = activePlayerId(state)
  return active ? [active] : []
}
```

- `visibleCard` keeps a played spy's family hidden until the end ([Hidden information](../01-the-game/10-views.md#hidden-information), [Opaque ids](../01-the-game/10-views.md#opaque-ids)). From `games/courtisans/packages/engine/src/view.ts`:

```ts
export function visibleCard(card: Courtier, revealed: boolean): VisibleCard {
  if (card.role === "spy" && !revealed) return { id: card.id, family: null, role: "spy" }
  return { id: card.id, family: card.family, role: card.role }
}
```

## Results, errors and debug commands

- `computeResults` gives the shared `Results` with the game's own detail added ([Results](../01-the-game/06-victory.md#victory-and-results)). From `games/courtisans/packages/engine/src/scoring.ts`:

```ts
export type CourtisansPlayerResult = PlayerResult & {
  domainPoints: number
  families: FamilyDetail[]
  missions: { missionId: string; done: boolean; points: number }[]
}
```

- `errors.ts` declares its own `EngineError` class: `instanceof` against the kit's class misses it, so `isEngineError` accepts any error with that `name` and a string `code` ([Errors](../01-the-game/05-actions.md#errors)); its `index.ts` does not re-export the kit.
- `GAME.debug` has `turn` and `over`, and its own `missions` ([Debug commands](../01-the-game/11-the-contract.md#debug-commands)).

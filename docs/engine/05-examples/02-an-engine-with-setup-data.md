# An engine with objectives and secrets

Courtisans is live, and its engine, `games/courtisans/packages/engine/src`, shows what Flip 7 does not need: objectives dealt as data, a simultaneous opening, a card whose family stays hidden and results with the game's own detail. Its state is lean like Flip 7's, so for the state and the step take [Flip 7](01-a-lean-engine.md). The rules as coded are in `games/courtisans/CLAUDE.md`.

## The files

| File | What it holds |
| --- | --- |
| `types.ts` | `State`, `Action` (`CLIENT_ACTIONS`), `COURTISANS_ERROR_CODES`, the `Condition` tree, `Mission`, the events (`CourtisansEvent`), the views (`PlayerView`, `Courtier`, `VisibleCard`) and the results |
| `catalogue.ts` | `FAMILIES`, `ROLES`, `CARDS` (the kinds of card, keyed `noble-hare` and `base-stag`), `CATALOGUE` (the 90 cards of the box), `weight`, and the constants `SET_ASIDE_CARDS`, `HAND_SIZE`, `MISSION_POINTS` |
| `missions.ts` | `MISSIONS`, the twenty missions with their rules, `missionOf`, and `evaluateCondition`: a mission's `Condition` against the state |
| `machine.ts` | `open`, `close` and `emit` of a step, the cards (`typeOf`, `courtierOf`, `visibleCard`), `phaseOf`, `waitingFor`, `isOver`, `progress` |
| `scoring.ts` | `computeStatuses`, `domainPoints` |
| `results.ts` | `results`: the points of each player, the ranks and the winners |
| `actions.ts` | `step`: `readMissions` and `playCard`, with its assassination and the end of the turn |
| `setup.ts` | `setupGame`: the missions drawn, the box shuffled, the ids issued, the cards put aside, the hands dealt |
| `view.ts` | `playerView` |
| `autoplay.ts`, `debug.ts` | `autoPlayFor` and `autoPlayStep` (the whole turn of an absent player, or their missions read) and the debug commands |
| `game.ts`, `index.ts` | `GAME`; the exports, the kit's included |
| `test-utils.ts` | Helpers of the tests, not exported: `layout` (a rigged table from the names of the cards) and `problems` (the invariants of a state) |
| `*.test.ts` | `actions`, `autoplay`, `determinism`, `game`, `golden`, `missions`, `scoring`, `setup`, `simulation` and `view` |

## Missions

- The missions are the engine's own: `MISSIONS` lists the twenty, each with its colour and its `Condition`, so `GAME` takes no `SetupData` and the engine never reads Sanity ([What an engine never does](../01-the-game/11-the-contract.md#what-an-engine-never-does)). Sanity holds the text and the picture of each mission under the same id.
- `setupGame` draws a white and a blue mission for each player from `MISSIONS` with the seeded stream, and the state keeps their ids. From `games/courtisans/packages/engine/src/missions.ts`:

```ts
export const MISSIONS: readonly Mission[] = [
  { id: "mission-dark-1", color: "blue", condition: { type: "familyStatus", family: "carp", status: "disgrace" } },
  // …
]
```

## Determinism from the seed

- The deal comes from `createSaveableRng(seed)` and the opaque ids from a side stream, issued in the order of the catalogue before the box is shuffled, so the ids never move the deal ([Random numbers](../01-the-game/09-state.md#random-numbers)). `determinism.test.ts` pins it and checks that nothing calls `Math.random` once a seed is given, and `golden.test.ts` plays ten whole games with a scripted bot through the public view and holds what each one ends on.
- The state keeps the position of the stream (`rng`), and the automatic moves are the only draws made after the setup: a move a player sends draws nothing. `autoMove`, from `games/courtisans/packages/engine/src/autoplay.ts`, picks a card of the hand, the first free zone and a level or an opponent from `ctx.rng`:

```ts
const card = random(handOf(s, seat))
const zone = availableZones(s)[0]!
const target: Target =
  zone === "table" ? { zone: "table", level: rng() < 0.5 ? "up" : "down" } : { zone: "domain", playerId: zone === "domain" ? me : random(opponents) }
```

## The opening and the view

- The opening is a simultaneous step: a `read` flag for each player, not the kit's `Submissions<T>` ([Simultaneous steps](../01-the-game/03-turns.md#simultaneous-steps)). The phase is read from the state, never stored: the banquet starts when the last flag is set, and the game is over when no hand holds a card (`phaseOf`).
- `waitingFor` lists the players who have not read, then the player of the turn; `autoPlayFor` reads for that one player or plays the whole turn ([Playing for an absent player](../01-the-game/03-turns.md#playing-for-an-absent-player)). From `games/courtisans/packages/engine/src/machine.ts`:

```ts
export function waitingFor(s: State): string[] {
  const phase = phaseOf(s)
  if (phase === "over") return []
  if (phase === "missions") return s.seats.filter((_, seat) => !s.read[seat])
  return [playerAt(s.seats, s.active)]
}
```

- `visibleCard` keeps a played spy's family hidden until the end, from its owner too ([Hidden information](../01-the-game/10-views.md#hidden-information), [Opaque ids](../01-the-game/10-views.md#opaque-ids)). From the same file:

```ts
export function visibleCard(s: Pick<State, "ids">, id: number, revealed: boolean): VisibleCard {
  const { family, role } = typeOf(s, id)
  return { id, family: role === "spy" && !revealed ? null : family, role }
}
```

- What happened is said by `step` as `CourtisansEvent` (a card played, a card eliminated, cards drawn, the end) and kept by the platform, not by the state ([Events and the log](../01-the-game/12-events-and-the-log.md)). Nothing is private, and a spy shows no family in the entries either.

## Results, errors and debug commands

- `results` gives the shared `Results` with the game's own detail added ([Results](../01-the-game/06-victory.md#victory-and-results)), and `null` until the game is over: the score depends on the missions, which are secret, so the view has no `standings`. From `games/courtisans/packages/engine/src/types.ts`:

```ts
export type CourtisansPlayerResult = PlayerResult & {
  domainPoints: number
  families: FamilyDetail[]
  missions: { missionId: string; done: boolean; points: number }[]
}
```

- The refusals are the shared codes, which the platform words, and two of the game's own, `ZONE_ALREADY_PLAYED` and `INVALID_ASSASSINATION` (`COURTISANS_ERROR_CODES`). What a client sends is checked before anything is read from it: a payload that is not an action of the game is `INVALID_ACTION` ([Errors](../01-the-game/05-actions.md#errors)).
- `GAME.debug` has `turn` and `over`, and its own `missions` ([Debug commands](../01-the-game/11-the-contract.md#debug-commands)).

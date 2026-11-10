# Testing the engine

An engine is tested in layers, from one rule to a whole game with absent players. Each layer below names the file to copy. Tests sit next to the code (`*.test.ts`) and run with Vitest: `pnpm --filter @<slug>/engine test` for the engine, `pnpm --filter @pbgo-game/<slug> test` for the binding, and `pnpm test` runs every package.

## The layers

| Layer | What it checks | Model |
| --- | --- | --- |
| A file per part of the rules | Each rule on its own, with the page of the rulebook it comes from | Flip 7: `catalogue.test.ts`, `scoring.test.ts`, `setup.test.ts`, `deal.test.ts`, `turns.test.ts`, `cards.test.ts`, `rounds.test.ts` |
| The definition | The id, the bounds, the options, `clientActions` and the error codes in one list | Flip 7: `game.test.ts` |
| Whole games | Every table size played to the end by `playOn` or by a random player, with `problems` checked after every move | Flip 7: `simulation.test.ts`, `autoplay.test.ts`; the template: `game.test.ts` |
| Determinism | The same seed gives the same game, nothing calls `Math.random` once a seed is given, `autoPlayFor` gives the same state for the same state | Courtisans: `determinism.test.ts`; Flip 7: `setup.test.ts` |
| Views and hidden information | For every viewer, `null` and a stranger included, no hidden id anywhere in the JSON of a view | Flip 7: `view.test.ts`; Courtisans: `view.test.ts`; the template: `game.test.ts` |
| The order of keys | A state given back by `reorderKeys` plays, waits and views the same | Flip 7: `game.test.ts`, `simulation.test.ts`; the template: `game.test.ts` |
| No mutation | A step on a state frozen with `deepFreeze` throws if it writes to it, and a refusal leaves the state as it was | Flip 7: `turns.test.ts`, `simulation.test.ts` |
| Junk actions | Wrong types, missing fields and strangers are refused with a code of the game's list | Flip 7: `simulation.test.ts`, `turns.test.ts` |
| Absent players | `playFor` plays each player the game waits for and refuses anybody else with `NOT_WAITING`; a table of absent players ends | Flip 7: `autoplay.test.ts`, `simulation.test.ts`; Courtisans: `game.test.ts` |
| The commands | Each debug command, and that a command that rigs the draw pile changes nothing outside its moment | Flip 7: `debug.test.ts` |
| The takeover in the binding | A whole game in which players never come back, with the real voting rules of core | The template: `src/takeover.test.ts` |
| The whole contract in the binding | The contract of an engine, played the way the server plays it, with the checks of every step | The template: `src/conformance.test.ts` |
| The error vocabulary in the binding | Every code the engine throws is a shared one or one that `ERROR_CODES` lists, and the list holds the game's own only | The template: `src/error-codes.test.ts` |

## Rules

- Check the invariants of the rules of the game after every move, not only at the end: `problems(state)` of Flip 7's `test-utils.ts` gives one sentence for each thing that does not hold, and `[]` for a sound state. The ones every game shares are in the [conformance test](#the-conformance-test).
- Rig a state by naming the cards, never their ids: a test does not know which id a card holds. `layout()` of `test-utils.ts` builds a table from card names.
- Vary both halves of a seed in a test over seeds: the deal and the card ids use different bits of it (`seedOf` of `test-utils.ts`; [Random numbers](../01-the-game/09-state.md#random-numbers)).
- Write the expected score again in the test, from the names of the faces, and compare it with the engine's, as `simulation.test.ts` does for the booklet's scoring.
- Assert a refusal by its code. A thing that throws without one is a bug of the game, and `refusal()` rethrows it.
- Test absent players in the engine with `playFor`, and in the binding with `src/takeover.test.ts`, adapted to the new engine (`humanMove` is the one part that knows the game).

From `games/flip-7/packages/engine/src/test-utils.ts`:

```ts
export function refusal(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string") return code
    throw error
  }
  throw new Error("The action was accepted")
}
```

## The conformance test

`conformanceProblems(GAME, options)` of `@pbgo/engine-kit/testing` plays an engine the way the server does and returns, as sentences, the rules of [the contract](../01-the-game/11-the-contract.md) that it breaks; an engine that keeps them gets `[]`. It is a test of the binding, run by `src/conformance.test.ts`, which `pnpm new-game` copies into every game:

```ts
it("keeps the contract of an engine", () => {
  const problems = conformanceProblems(GAME, { errorCodes: ERROR_CODES, secretsFor })
  expect(problems).toEqual([])
}, 120_000)
```

| What it plays | What it checks |
| --- | --- |
| The definition | The bounds of a table, the action types, the options (defaults inside their range, constraints naming options that exist), the presets, that the server can play for an absent player, and that no option, preset or line of score carries words |
| `setup` | A table it cannot play (nobody, too few, too many, the same id twice, an empty id) is refused with `INVALID_PLAYERS`; a seed gives the same game |
| Whole games, played with `autoPlayFor` | The smallest and the largest table and a few sizes between, eight seeds each, then each option at the extremes of what it takes at the smallest and the largest table, with ids of different lengths so that the order of the keys of an object is not the seat order |
| Every step of them | The state is plain JSON and holds no nickname; `isOver` and `waitingFor` are sound (seated players, once each, in seat order, nobody once the game is over); every view works for each seat, a spectator and a stranger, is plain JSON, holds no nickname, shows no result before the end and the results at the end; when it carries `standings`, they hold each player once, in seat order, with a finite score, the same for every viewer; the step does not write to the state it was given (every state is frozen), gives the same state twice, plays the same once `jsonb` has reordered the keys, moves the game on, ends, and never calls `Math.random` or `Date.now` |
| The log, for a game that says what happens | `step`, `autoPlayStep` and the optional `setupStep` come together; `autoPlayStep` plays what `autoPlayFor` plays and `setupStep` sets up what `setup` sets up; each says the same every time; the entries are a list of plain data, each with an event, addressed to players of the table, with a `masked` version only when `to` says who reads the whole, holding no nickname ([Events and the log](../01-the-game/12-events-and-the-log.md)) |
| The results | Each player once, a finite total, ranks that follow `ranks()` (1, 2, 2, 4), lines of score with a key, finite points and a place in `scoreLines`; winners who sit at the table, have rank 1 and are all the players of rank 1, or, for a table that plays together (`coop`), every player at rank 1 with the table's score and everybody among the winners when it won, nobody when it lost |
| Junk actions, at the start and a few steps in | An unknown type, a missing type, a missing or foreign `playerId`, and each action type with nothing or with nonsense in its fields are refused with an `EngineError` whose code is shared or in `ERROR_CODES`, or else are a move; never a plain error, never a write to the state |

- `errorCodes` is the binding's `ERROR_CODES`: a refusal with any other code than these and the shared ones is a problem. `data` is the `SetupData` of a game that takes one. `playerCounts`, `seeds`, `variantSeeds` and `maxSteps` size the run.
- `secretsFor(state, viewer)` lists what a viewer must never see (`null` is anybody outside the table): the ids of the cards in the other hands, for instance. A view whose JSON holds one of them as a string is a leak, and so is a log whose lines for that viewer hold one (the entries of the step, as of the state it leaves). Leave out what is already public, such as a card played in an earlier round whose id is dealt again (the template does). Without it, hidden information is not checked: the suite cannot know what is hidden.
- `allowTexts` lets a game that has not yet moved the words of its options and score lines to its Sanity ([The words of options and scores](../01-the-game/07-parameters.md#the-words-of-options-and-scores)) pass in the meantime.
- Each sentence comes once with its count and two places (`3 players, default options, seed 31, step 12`), and the run replays from them: the same seed gives the same game.
- `deepFreeze`, `reorderKeys`, `deepEqual` and `jsonProblems` of the same entry are the helpers it uses, for the tests of a rule.
- The suite does not know the rules of the game, so it does not replace the tests of a rule or the simulation that recomputes a score from the booklet.

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

## Where the patterns are shown

- The seed and the `Math.random` spy: [Determinism](../01-the-game/09-state.md#determinism).
- The order of keys: [Every order comes from an array](../01-the-game/09-state.md#every-order-comes-from-an-array).
- Freezing a state: [Nothing is mutated](../01-the-game/09-state.md#nothing-is-mutated).
- A view that hides a hand: [Hidden information](../01-the-game/10-views.md#hidden-information).
- `playFor`, `playOn` and the takeover test: [Testing turns](#testing-turns) above, and the helpers in [Turns](../01-the-game/03-turns.md).

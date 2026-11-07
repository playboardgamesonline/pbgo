# Examples

Two engines to read beside the pages on [building a game](../04-build-a-game/index.md). Flip 7 is the one to copy: a lean state, a step that opens a copy of the state and closes it, and tests that play whole games. Courtisans is live, and its engine shows what Flip 7 does not need: data loaded from Sanity, a simultaneous opening, a hidden family and results with the game's own detail.

## Pages

- [A lean engine, file by file](01-a-lean-engine.md): the files of Flip 7's engine, then the catalogue and the lean state, the step, `waitingFor`, `autoPlayFor`, the options, the results and the tests.
- [An engine with setup data and secrets](02-an-engine-with-setup-data.md): the files of Courtisans' engine, then `SetupData`, determinism from the seed, the missions phase, the view, the results, its own `EngineError` and its debug commands.

# The engine kit

`@pbgo/engine-kit` (`packages/engine-kit`) is pure TypeScript with no UI and no dependency, consumed as source and imported from the package root. An engine re-exports it with `export * from "@pbgo/engine-kit"`. `GameDefinition` and `EngineError` are in [The engine contract](../02-contract.md); each of the other modules has a page here, and the `RangeError`s they throw are bugs of the game ([Two kinds of errors](../03-state-and-determinism.md#two-kinds-of-errors)).

- [Options](01-options.md): declaring the options of a game and making any table's values valid.
- [Turns](02-turns.md): who the game waits for, and playing for an absent player.
- [Simultaneous steps](03-simultaneous-steps.md): a step every player answers in any order.
- [Random numbers](04-random-numbers.md): seeded streams, shuffling and side streams.
- [Opaque ids](05-opaque-ids.md): the numbers cards are shown under.
- [Decks](06-decks.md): drawing, peeking, inserting, reshuffling the discard and dealing.
- [Per-viewer log](07-per-viewer-log.md): what happened, as each viewer may read it.
- [Rounds](08-rounds.md): scores over rounds, leaders, ranks and the end of the game.

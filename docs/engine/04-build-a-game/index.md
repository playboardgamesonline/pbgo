# Build a game

A game is an engine package (the rules), a binding package (what hands the engine, the look and the board to the app), a board (the 3D scene, inside the binding) and a Studio with its content. The rules code is the engine lane's work; the binding, the board, the Studio and the content are the game lane's, with the skills `game-new` and `game-sanity-create` (`.claude/skills/README.md`). `pnpm add-game` creates the packages from `template/`, with the demo game "La Plus Haute" in place of the rules, and the Sanity project that goes with them.

The pages before these describe the pieces a game is made of; these say in which order to put them together.

## Pages

- [From the rules to a playable game](01-steps.md): the steps in order, each with the page that explains it.
- [The files of a game](02-files-of-a-game.md): the tree of `games/<slug>/`, its packages and what `pnpm new-game` copies.
- [Writing the engine](03-writing-the-engine.md): the files of an engine in the order to write them, and the rule each one keeps.
- [Composing a board](04-composing-a-board.md): the files of a board, what the game supplies, lazy loading.
- [Wiring the engine into the app](05-wiring-it-in.md): the binding, `GAME`, the error codes, the data, the registry, `live` and `indexable`.
- [Testing the engine](06-testing.md): the layers of tests, each with the file to copy.
- [Tuning](07-tuning.md): the settings objects and the debug panel.
- [Before you hand the engine over](08-checklist.md): one line per rule, each linking to its page.
- [Examples](../05-examples/index.md): real engines to read beside these pages.

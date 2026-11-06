# A new game

A game is an engine package (the rules), a binding package (what hands the engine, the look and the board to the app), a board (the 3D scene, inside the binding) and a Studio with its content. The rules code is the engine lane's work; the binding, the board, the Studio and the content are the game lane's, with the skills `game-new` and `game-sanity-create` (`.claude/skills/README.md`). `pnpm add-game` creates the packages from `template/`, with the demo game "La Plus Haute" in place of the rules, and the Sanity project that goes with them.

## Pages

- [From the rules to a playable game](01-steps.md): the steps in order, each with the page that explains it.
- [The files of a game](02-files-of-a-game.md): the tree of `games/<slug>/`, its packages and what `pnpm new-game` copies.
- [Writing the engine](03-writing-the-engine.md): the files of an engine in the order to write them, and the rule each one keeps.
- [Wiring the engine into the app](04-wiring-it-in.md): the binding, the registry, `live` and `indexable`.
- [Testing the engine](05-testing-the-engine.md): the layers of tests, each with the file to copy.
- [Before you hand the engine over](06-checklist.md): one line per rule, each linking to its page.
- [Examples](../08-examples/index.md): real engines to read beside these pages.

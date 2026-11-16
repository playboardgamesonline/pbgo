---
icon: book
description: The rules spec of each game the platform adds, with its component list: the page its engine is written from.
---

# Games

The rules of a game are written down once, before its engine, and the owner validates them. Each game has a folder here with a landing page and its `rules.md`: the component list (what is in the box), the rules the engine will follow, who sees what, and the cases the rulebook leaves open, each with the reading proposed.

The skill `game-rules-spec` writes a spec from the game's rulebook, `pnpm check:rules <slug>` checks its shape, and `pnpm add-game "<name>"` runs the skill as a step with a gate, after the scout and the catalog entry. The engine (`engine-rules`) is written from the spec, and the art is looked for from its component list.

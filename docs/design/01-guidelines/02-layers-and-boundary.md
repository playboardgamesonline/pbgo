# Layers and boundary

Two layers share the same token names (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--radius`, `--font-body`…). The platform layer is what the platform's screens use; the game layer is what a game's pages use, and a game overrides it at runtime through its Sanity skin. Same names, different values: a game changes its look by changing token values, never a component.

| | Platform layer | Game layer |
| --- | --- | --- |
| Used by | Hub, account, legal, the docs, 404, the gamemaster | A game's own pages: the table, its board |
| Components | `@pbgo/ui/platform/*` | `@pbgo/ui/game/*` |
| Token values | `packages/ui/src/styles/platform.css`, scoped to `.platform` | `:root` of `packages/core/styles/game.css` and the game's stylesheet, overridden at runtime by its Sanity skin (`themeStyle()`) |
| Who changes them | The design system: a pull request on `packages/ui` | The game: its setup in the gamemaster (Visual, Copy) |
| Theme | Black and white, dark only | Whatever the game's skin says |
| `platform` class | On `<html>` (through `PlatformDocument`) and on the root of every portal (select, dropdown, dialog, popover, toast), which React renders outside the wrapper | Never |

## Rules of the boundary

- The platform sets its values on `.platform`, never on `:root`. A game sets its values on `:root`, never on `.platform`. The two never mix.
- A component reads tokens and never names a colour, a font or a size of its own: that is what lets a game restyle everything by changing values.
- In `platform.css`, `@theme` only defines new names. A name Tailwind already has (line-heights, tracking, default transitions, font weights) gets its platform value inside `.platform`, or every game would inherit it from `:root`.
- `.platform` carries no background, or a portal would paint it: `<html>` adds `bg-background` itself.

## The same specimen in both layers

Left, the platform. Right, the same components with four tokens overridden, as a game skin would (`--primary`, `--primary-foreground`, `--radius`, `--font-body`): colour, radius and font change, no component does. This is a simulation; a real skin sets the names on `<html>`.

```specimen
layers-skin
```

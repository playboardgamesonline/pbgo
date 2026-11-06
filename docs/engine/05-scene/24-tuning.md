# Tuning

A scene is tuned live. Every visual value is a field of a plain object that a frame reads, and the debug panel edits that object. The shared tools take such objects: `CARD_SETTINGS`, the camera's settings and the glows. Per game: the template's `board/settings.ts` binds an object to a folder of the panel.

## The panel

- It is core's `DebugPanel` (`packages/core/components/game/debug.tsx`). `?debug` in the address opens it, and Shift+D toggles it and remembers the choice ([Debug](../../design/04-in-game/01-screens-and-game-flow.md#debug)).
- It has three tabs (`DEBUG_TABS`): GAME, for the game's own commands (the template's "Phases" folder: START, NEXT TURN and END, which call the debug route, [Debug commands](../02-contract.md#debug-commands)); SCENE, for the board's folders; TRANSITION, for the announcement presets and their "Replay" buttons ([Turn change](21-turn-change.md)).
- "Copy all settings" copies every value of every tab as JSON, and a frame-rate meter with the worst frame shows while the panel is open.
- Every folder that `useSettings` makes has a "Copy values" button that copies the folder as JSON, to paste back as the defaults in code. The panel finds values; the defaults live in the code.

## Binding an object to a folder

`useSettings(folder, object, fields, options)`, from the template's `settings.ts`:

| Argument | Role |
| --- | --- |
| `folder` | The name of the folder in the panel |
| `object` | The settings object, plain and mutable: `CAMERA`, `LAYOUT_SETTINGS`, `CARD_SETTINGS`... |
| `fields` | For each key of the object, a `Field`: a label alone, `[label, min, max, step]` for a number, or `[label, options]` for a choice |
| `options` | `tab` (SCENE unless told), `order` among the folders, and `closed`, whether the folder starts collapsed |

- A change writes the value into the object. Nothing re-renders; the next frame reads it.
- It also calls `notifySettings`, which changes the number `useSettingsVersion` returns. A memo that computes a layout from a settings object lists that number among its dependencies, or the layout stays as it was.
- The template's folders: Layout (`LAYOUT_SETTINGS`), Card (some fields of `CARD_SETTINGS`), Camera and Share Photo (`CAMERA` and `PHOTO`).

From `template/src/components/board/settings.ts`, the kinds of field:

```ts
export type Field = string | [label: string, min: number, max: number, step: number] | [label: string, options: Record<string, unknown>]
```

## Rules

- A setting is a field of an object, not React state: a frame reads it, and the panel writes it.
- `useSettings` belongs to the game. `@pbgo/core` and `@pbgo/table` do not export it, and a game copies `settings.ts`. The table's own panel is not built (PLT-68, [Not in the package yet](25-limits.md)).
- The template's `settings.ts` takes `useControls` from leva. Core also has a leva-free entry with the same API, `debug-controls.ts` of `components/game`, which loads leva only when debugging is requested.
- A value that shapes a layout, such as a radius, reaches the layout functions as an argument: a layout helper reads no setting itself ([Layout helpers](12-layout-helpers.md)).

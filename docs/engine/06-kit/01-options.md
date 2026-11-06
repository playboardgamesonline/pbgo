# Options

Options are the settings of a game, declared as data in its `options`. The kit makes whatever a table holds into valid values and says why an option is out. The module is `packages/engine-kit/src/options.ts`; how a table's choices reach an engine is in [Options and presets](../01-how-a-game-runs.md#options-and-presets).

## Exports

| Export | What it does |
| --- | --- |
| `OptionDefinition` | One option, a `number`, a `choice` or a `boolean`, with the fields below |
| `OptionDefinitions` | The `options` of a game: the `OptionDefinition`s by key |
| `OptionValue`, `OptionValues` | A value (`number`, `string` or `boolean`) and the values of a table by key |
| `OptionContext` | `{ playerCount? }`: what the constraints need to know about the table |
| `OptionStatus` | `{ available, reason?, with? }`: `reason` is `"players"`, `"requires"` or `"conflicts"`, and `with` names the options involved |
| `OptionPreset` | A named combination of values, `{ id, label, help?, values }`, for the `presets` of a definition ([Options and presets](../01-how-a-game-runs.md#options-and-presets)) |
| `defaultOptions(definitions)` | Every option at its `defaultValue`, with no constraint applied |
| `normalizeOptions(definitions, entry, ctx?)` | The values of every declared option, made valid from anything |
| `optionStatus(definitions, values, key, ctx?)` | Whether an option is available with these values and this number of players, and why not |
| `optionGroup(def)` | `"parameter"` or `"extension"`; `"parameter"` when `group` is absent |
| `applyPreset(definitions, preset, ctx?)` | The defaults, the preset's values over them, then `normalizeOptions` |
| `presetMatches(preset, values)` | Whether every value of the preset is already in `values` |

None of them throws.

## An option

| Field | Role |
| --- | --- |
| `type` | `"number"`, `"choice"` or `"boolean"`; it decides the fields that follow |
| `label`, `help` | The words shown for the option; `help` is optional |
| `defaultValue` | The value used when none valid is given |
| `min`, `max`, `step` | `number` only: the range, and the gap between two values counted from `min` (`step` is optional) |
| `choices` | `choice` only: the `{ value, label }` that can be picked |
| `group` | `"parameter"` or `"extension"`: the read-only settings dialog of a game's toolbar (`GameSettingsDialog`) lists parameters as rows and extensions as cards |
| `icon` | A short text, an emoji for instance, drawn beside an extension in that dialog |
| `requires` | Keys of options that must be active for this one to be |
| `conflictsWith` | Keys of options that cannot be active together with this one |
| `players` | `{ min?, max? }`: the table sizes the option exists for |

## Rules

- `normalizeOptions` turns a value of the wrong type, or a choice that is not listed, into the default; it rounds a number to its step, clamps it to its range and drops a key the game does not declare.
- It then resets every active option that is unavailable, in declaration order and until nothing changes, so a reset cascades to the options that required it. A boolean is active when it is `true`, any other option when it differs from its default.
- Of two active options that conflict, the one declared first stays, whichever of the two lists the other in `conflictsWith`.
- Call `normalizeOptions` at the start of `setup` with `{ playerCount }`: without the count, `players` is not checked.
- An `extension` is an optional module, by convention a boolean that is off by default; a rule of the official game that is on by default is a `parameter` (`fiveDifferent` of Exploding Kittens).

From `games/exploding-kittens/packages/engine/src/options.ts`: `fasterGame` exists for small tables only and is declared before `classicDeal`, so it stays when a table asks for both.

```ts
export const OPTIONS: OptionDefinitions = {
  // …
  fasterGame: {
    type: "boolean",
    defaultValue: false,
    // …
    players: { max: 3 },
    conflictsWith: ["classicDeal"],
  },
  classicDeal: {
    type: "boolean",
    defaultValue: false,
    // …
  },
}
```

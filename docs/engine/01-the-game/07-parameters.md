# Parameters

The settings of a table are declared by the engine, the platform or core, narrowed by the gamemaster for the game in Setup › Mechanics and picked by the host in the lobby. Core hands the engine only what survives its checks. The code is `packages/core/lib/settings.ts` and `packages/core/lib/table-options.ts`.

## What a table can be set to

| Parameter | Declared by | Set by | Reaches the engine |
| --- | --- | --- | --- |
| Number of players | `minPlayers` and `maxPlayers` of the definition ([The contract](11-the-contract.md#the-contract)) | The gamemaster, within the engine's bounds (`clampPlayers`) | As `players` in `setup`, in the order they sat down; the routes hold a table to the bounds ([Players](02-players.md)) |
| Engine options | `options` of the definition | The gamemaster sets each default and can hide an option; the host sets the options that an expansion or a helper carries | As `options` in `setup`, normalized for the players seated |
| Expansions and helpers | The platform's Sanity project, not the engine | The host, in the settings of the lobby | Only as the option whose key is their id |
| Speed | The platform's lobby (`PACES`) | The host, in the settings of the lobby | Not at all |
| Delay for an absent player | Core (`TURN_TIMEOUT_BOUNDS`) | The gamemaster, `turnTimeout` of the game | Not at all: core measures it for the takeover vote ([Absent players](03-turns.md#absent-players-in-core)) |

- Everything a table sets reaches the engine as an argument of `setup`: `players`, `options`, `seed` and `data` ([Starting a game](01-how-a-game-runs.md#starting-a-game)). There is no other channel.
- `TableCreator` and `OwnLobby` send option values to the routes and nothing else, so two more settings that the lobby draws stay in the page and no route receives them.
- The number of players: the select above the seats (`LobbyPlayers`) ranges over the game's figures in the platform's Sanity project (`playerRange`), not over the engine's bounds, and the seats fill as people join, up to the maximum.
- Who may join: the button at the top right of the panel (`LobbyAccess`), public or private, with a minimum rank and a language.
- A table read back from `games` has the options and the players its row holds, and it is played with every option that is `true`; its visibility, its pace and its seats are defaults of the page (`tableOfRow` in `apps/web/src/lib/game-activity.ts`).

## Options

Options are the settings of a game, declared as data in its `options`. The kit makes whatever a table holds into valid values and says why an option is out; none of its functions throws. The module is `packages/engine-kit/src/options.ts`.

| Export | What it does |
| --- | --- |
| `OptionDefinition` | One option, a `number`, a `choice` or a `boolean`, with the fields below |
| `OptionDefinitions` | The `options` of a game: the `OptionDefinition`s by key |
| `OptionValue`, `OptionValues` | A value (`number`, `string` or `boolean`) and the values of a table by key |
| `OptionContext` | `{ playerCount? }`: what the constraints need to know about the table |
| `OptionStatus` | `{ available, reason?, with? }`: `reason` is `"players"`, `"requires"` or `"conflicts"`, and `with` names the options involved |
| `OptionPreset` | A named combination of values, `{ id, values }`, for the `presets` of a definition; its words are the game's ([The words of options and scores](#the-words-of-options-and-scores)) |
| `defaultOptions(definitions)` | Every option at its `defaultValue`, with no constraint applied |
| `normalizeOptions(definitions, entry, ctx?)` | The values of every declared option, made valid from anything |
| `optionStatus(definitions, values, key, ctx?)` | Whether an option is available with these values and this number of players, and why not |
| `optionGroup(def)` | `"parameter"` or `"extension"`; `"parameter"` when `group` is absent |
| `applyPreset(definitions, preset, ctx?)` | The defaults, the preset's values over them, then `normalizeOptions` |
| `presetMatches(preset, values)` | Whether every value of the preset is already in `values` |

An option has these fields:

| Field | Role |
| --- | --- |
| `type` | `"number"`, `"choice"` or `"boolean"`; it decides the fields that follow |
| `label`, `help` | Deprecated: the words of an option are the game's, written in its Sanity ([The words of options and scores](#the-words-of-options-and-scores)). What an engine still carries here is shown as written, for a game that has not moved it |
| `defaultValue` | The value used when none valid is given |
| `min`, `max`, `step` | `number` only: the range, and the gap between two values counted from `min` (`step` is optional) |
| `choices` | `choice` only: the `{ value }` that can be picked (a `label` is deprecated like the option's) |
| `group` | `"parameter"` or `"extension"`: the read-only settings dialog of a game's toolbar (`GameSettingsDialog`) lists parameters as rows and extensions as cards |
| `icon` | A short text, an emoji for instance, drawn beside an extension in that dialog |
| `requires` | Keys of options that must be active for this one to be |
| `conflictsWith` | Keys of options that cannot be active together with this one |
| `players` | `{ min?, max? }`: the table sizes the option exists for |

- `normalizeOptions` turns a value of the wrong type, or a choice that is not listed, into the default; it rounds a number to its step, clamps it to its range and drops a key the game does not declare. It then resets every active option that is unavailable, in declaration order and until nothing changes, so a reset cascades to the options that required it. A boolean is active when it is `true`, any other option when it differs from its default.
- Of two active options that conflict, the one declared first stays, whichever of the two lists the other in `conflictsWith`. Exploding Kittens declares `fasterGame`, for small tables only (`players: { max: 3 }`), before `classicDeal`, so it stays when a table asks for both (`games/exploding-kittens/packages/engine/src/options.ts`).
- Call `normalizeOptions` at the start of `setup` with `{ playerCount }`: without the count, `players` is not checked.
- An `extension` is an optional module, by convention a boolean that is off by default; a rule of the official game that is on by default is a `parameter` (`fiveDifferent` of Exploding Kittens).
- `presets` are combinations of options: `applyPreset` normalizes them over the defaults, so a preset cannot bypass a constraint. No screen of the app offers them.

## Expansions and helpers

The platform's page of a game does not draw the engine's options. It offers the game's expansions and helpers in the settings of a table, each with an id, and a choice reaches the engine only when that id is the key of one of its options. The match is `engineOptionsOf` in `packages/core/lib/table-options.ts`.

| | Expansion | Helper |
| --- | --- | --- |
| Declared in | An `expansion` document of the platform's Sanity project, whose base game is the game | The `helpers` of the game's document in the same project |
| Id | Its `slug` | Its `key` |
| Drawn as | A card with a checkbox, a picture, a name and a description | A row with a switch and one line of text |
| Shown to | The host sees all of them; everyone else sees the ones chosen | The host only |

- A change of the settings is a `LobbySettingsValue`: the chosen expansions, the pace, the helpers that are on and the switches of each expansion. `engineOptionsOf` reads the expansions and the helpers and nothing else.
- Before the table exists (`TableCreator`), the choices are kept in the page: the table is created with the defaults, then they are sent. In the host's lobby (`OwnLobby`), each change is sent at once.
- They go to `POST /api/<slug>/games/<code>/options` (`api.options`). Only the host may send them (`HOST_ONLY`), and not once the table is starting or playing (`GAME_IN_PROGRESS`).
- The route merges them over the options of the table and runs `gameOptions`, which normalizes them for the players seated and puts a hidden option back to the gamemaster's default. `newGame` normalizes the options again when the game starts or is replayed, for the players seated then, and gives the result to `setup`.

From `packages/core/lib/table-options.ts`, the match of the page's ids with the engine's keys:

```ts
export function engineOptionsOf(
  chosen: { expansions: readonly string[]; helpers: readonly string[] },
  offered: { expansions: readonly string[]; helpers: readonly string[] },
  keys: readonly string[],
): OptionValues {
  const options: OptionValues = {}
  for (const id of offered.expansions) if (keys.includes(id)) options[id] = chosen.expansions.includes(id)
  for (const id of offered.helpers) if (keys.includes(id)) options[id] = chosen.helpers.includes(id)
  return options
}
```

- An id matches when it is a key of the options the table holds, which are all the options the engine declares. Every matching id is sent, on or off: unticking an expansion sends `false`. An option that no expansion or helper carries cannot be chosen at a table and keeps its default.
- The value is a boolean, so it switches a `boolean` option only: for a `number` or a `choice` option, `normalizeOptions` puts `defaultValue` back.
- An expansion's slug and a helper's key are lowercase letters and digits joined by single dashes, and the hub leaves out any other (`SLUG_PATTERN` in `packages/games/src/slug.ts`, `HELPER_KEY` in `packages/catalog/src/sanity.ts`): an option key with a capital letter, such as `fiveDifferent`, is never carried.
- The gamemaster sets the default of each option in Setup › Mechanics and can switch "In lobby" off for it: a hidden option keeps its default whatever is sent.
- An expansion for adults is checked by the same match (PLT-125, `docs/accounts.md`, "The age check"). An expansion whose Minimum age is 16 or more in the Studio asks that age of everybody seated at a table where the option with its slug is on, and so does a game whose own Minimum age is 16 or more. So **the key of the option that carries an expansion for adults must be the expansion's slug**: an option with another name is neither offered nor checked, and what it switches on would reach a table of people who are not old enough. Switching such an expansion on needs the host and everybody seated to be old enough (`AGE_TABLE_NOT_ALLOWED` otherwise), a guest cannot sit at the table (`AGE_SIGN_IN_REQUIRED`), and the table does not start with somebody seated who is not.
- The words of an option in the toolbar's `GameSettingsDialog` are the game's own. Setup › Mechanics, which only the gamemaster reads, shows the option's key when the engine carries no label.

## The words of options and scores

An engine declares no text. The words of an option (its label, its help, the label of each choice), of a preset and of a line of the score are texts of the game, written in its Sanity like its victory phrases: `texts.engineTexts`, a list of `key` and `text` in every language of the game. The engine and the platform meet on the key.

| Key | The words of |
| --- | --- |
| `option.<key>.label` | An option; required |
| `option.<key>.help` | An option, on a line under its label; optional |
| `option.<key>.choice.<value>` | One choice of a `choice` option; required |
| `preset.<id>.label`, `preset.<id>.help` | A preset; the label is required |
| `score.<key>` | A line of the score, the `key` of a `detail` row; required when the definition lists it in `scoreLines` |

- `optionLabelKey`, `optionHelpKey`, `choiceLabelKey`, `presetLabelKey`, `presetHelpKey` and `scoreLabelKey` of the kit build the keys, and `engineTextKeys(definition)` lists the ones a definition needs, `required` and `optional`.
- A text is read in the language asked, else in English, else it reads `[missing: <key>]` on the table: the code covers for nothing (`docs/sanity-and-languages.md`). While an engine still carries a `label` or a `help`, it stands in for a text Sanity does not hold, so a game can move its words one at a time.
- The gamemaster writes them in Setup › Copy › Options, where the required ones are listed (Launch lists those still missing); the Studio's Copy document, tab "Options and scores", holds the same list.
- A line of score whose words depend on a number gives the number in `values` and the text has the variable: the template's `detail` row is `{ key: "round", values: { n: 2 }, points }` and its text `Round {n}`. A game whose lines come from its data, such as the families of Courtisans, leaves `scoreLines` out and keeps naming its lines itself.

From `template/packages/engine/src/demo/game.ts`, options that name no text:

```ts
export const DEMO_OPTIONS: OptionDefinitions = {
  rounds: { type: "number", defaultValue: 3, min: 1, max: 5 },
  handSize: { type: "number", defaultValue: 5, min: 3, max: 8 },
  inverse: { type: "boolean", defaultValue: false },
  bids: { type: "boolean", defaultValue: true },
}
```

## Speed

The speed of a table is the `pace` of the lobby's settings: how fast the table is played, from no timer to a clock on every turn. It is a setting of the platform's page and nothing else: no route receives it, no column of `games` stores it and no engine hook reads it. The values are `PACES` in `packages/ui/src/tables.ts`; the control is `LobbySettings` in `packages/ui/src/platform/lobby-settings.tsx`.

- The host picks the speed in the settings of the lobby, which draw `SPEEDS` (`PACES` without the pace that leaves days for a turn) as a segmented toggle. Everyone else sees the same toggle, which cannot be pressed, at the pace the table says; a read-only table with the pace that leaves days says it in words.
- The pace is kept in the component only: `TableCreator` starts the settings of a new table at the usual pace, `OwnLobby` passes a change to `engineOptionsOf`, which drops it, and `createApi` has no call that carries it. `tableOfRow` reads a table of `games` at the usual pace, so the usual one is back when the table opens and when the page is reloaded.
- A pace changes nothing in an engine: the length of a clock is the game's own, an option like the template's `turnSeconds` ([Timers](../02-components/20-timers.md#in-the-engine)), and the speed of the lobby is not sent to the engine.
- The only delay core measures on a turn is `turnTimeout`. It is the same at every table of a game, whatever the pace, and it only lets the others vote to play for an absent player ([Absent players](03-turns.md#absent-players-in-core)).

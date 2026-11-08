# Game data

Game data is what an engine or a board needs that is not a rule: the missions an engine deals, the pictures and the words a board draws. The binding loads it on the server with two optional functions, `loadSetupData` and `loadGameData`, which core calls with a `LoaderContext` (`packages/core/lib/binding.ts`). How they are wired is in [Data for the engine and the board](../04-build-a-game/05-wiring-it-in.md#data-for-the-engine-and-the-board).

## Where each kind lives

| Data | Defined in | Loaded by | Reaches |
| --- | --- | --- | --- |
| Rule data: the cards of the box, `CATALOGUE` in Flip 7 | The engine's code, `games/flip-7/packages/engine/src/catalogue.ts` | Nothing: the engine imports it | The rules; the state holds an opaque id for each card, never the data |
| Setup data: what the rules need and Sanity holds, Courtisans' missions | The game's Sanity project | `loadSetupData`, called by core before the write at the start, the rematch, the debug start and the preview | `setup`, as `data` (`SetupData`) |
| Board data: the pictures and the words of the board, Courtisans' catalog | The game's Sanity project | `loadGameData`, called by core when it renders the board's page and the preview | The board, as its `data` prop |
| Texts, pictures, sounds and error messages | The game's Sanity project, never the code | Core, from the `settings`, `interface`, `texts` and `audio` documents | Core's screens, in the game's skin |

## Rules

- A loader is optional. Without `loadSetupData`, `setup` receives `data` as `undefined`; without `loadGameData`, so does the board, whose `data` prop is `unknown` and which casts it to its own type (Courtisans' board takes a `ClientCatalog`).
- The engine reads `data` and never Sanity ([What an engine never does](11-the-contract.md#what-an-engine-never-does)); Courtisans loads its missions that way ([Setup data](../05-examples/02-an-engine-with-setup-data.md#setup-data)).
- Setup data is loaded before the write, with the options of the table and in the default language; board data is loaded in the visitor's language.
- Courtisans keeps the default-language text of each mission in its state as a fallback only; its board draws the text of the player's language from its own data.
- The state keeps what the rules read and the ids of what the board draws ([Lean state](09-state.md#lean-state)): a card's face comes from `CATALOGUE`, its name and picture from Sanity under the same key, and Flip 7's keys are append only, never renamed.
- A game's texts, translations, images and sounds are in its Sanity project and never in code (`docs/sanity-and-languages.md`); a text it lacks reads `[missing: <key>]`. The messages of the codes in `ERROR_CODES` are written in Setup › Copy › Errors.
- The words of an option, of a preset and of a line of score are the game's own texts too: the engine names them by key and the game's Sanity writes them ([The words of options and scores](07-parameters.md#the-words-of-options-and-scores)).

From `packages/core/server/games.ts`, the two calls core makes, each optional:

```ts
export async function loadSetupData(game: PlayableGame, options: OptionValues = {}, locale: Locale = DEFAULT_LOCALE): Promise<unknown> {
  return game.binding.loadSetupData?.({ game, locale, sanity: sanityClient(game), options })
}
// …
export async function loadGameData(game: PlayableGame, locale: Locale = DEFAULT_LOCALE): Promise<unknown> {
  return game.binding.loadGameData?.({ game, locale, sanity: sanityClient(game) })
}
```

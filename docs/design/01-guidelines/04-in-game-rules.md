# In-game rules

A game's screen is drawn in two looks. The table is the game's: its cards, tokens, seat plates, announcements, confetti and the end screen read the game's skin tokens, set by `themeStyle()` and tuned by `UI_THEME` (see [Game themes](../04-in-game/03-game-themes.md)). Everything around the table is the platform's: the corners of the HUD (the state of the game, the social dock with the menu of the game, the players with their scores, the chat) and the windows of that menu take the platform's tokens, Geist and the `.platform` class, from `@pbgo/ui/platform`.

- Around the table, nothing of the game's look: no `@pbgo/ui/game`, no `surface`, `accent-game` or `font-display`. The pieces carry the `.platform` class themselves, since a game's page is not `.platform`; `platform-look.test.ts` keeps the rule.
- On the table, nothing of the platform's: no `@pbgo/ui/platform`, no Geist, no `.platform` class. It reads the game's skin tokens.
- A game never forks or restyles a shared component: for what is on the table it asks for a field in `UiTheme`, and for what is around it gives its view what the corners read (`standings`, the score of each player).
- No copy in shared components: every label is a `UI_TEXTS` key, in the four languages, or in English only until the language pass for a new one (`ENGLISH_ONLY_TEXTS`).
- The start screen, between a table that starts and its board (`StartScreen`, PLT-107), was the first piece around the table in the platform's look, in English until the language pass.
- The end screen (`GameOverCard`) is the table's own: a card centered on the screen, over the board with no veil, in the game's look (`UI_THEME.gameOver`, `UI_THEME.seat`, the skin), in English until the language pass, with its own `short` layout.

## Room for the cookie banner

The table is as tall as the window and the banner floats over it, since a canvas that shrank with the banner would reflow the scene: `GameHud` keeps the HUD and the game's overlays in a layer above the banner's room. The chat of the table is the exception: it stays against the bottom edge like the table, and the banner passes over it until the visitor answers (a chat lifted by the banner would float in the middle of the screen). Any other screen as tall as the viewport subtracts the banner (`h-[calc(100dvh-var(--consent-h,0px))]`) and an element fixed to the bottom offsets by it (`bottom-[var(--consent-h,0px)]`), or the banner covers its buttons. `--consent-h` is the height of the banner's outer box, its margin included. `consent-room.test.ts` fails on a violation.

## Compact layout

The Tailwind variant `short` (in `packages/core/styles/game.css`) is keyed on the viewport height, because a phone held sideways is wide but short. The HUD uses it and a game's overlays should too. The hub does not define it. To check a table on a phone held sideways, hide the `DesktopOnly` wall with injected CSS in the browser, never in the code.

## Motion

`motion/react` goes through `useMotion()` (`reduced`, `calm` or `lively`), and `GameHud` mounts `MotionConfig reducedMotion="user"`. Reduced motion always wins over `UI_THEME.motion`: short fades only, no confetti, springs or looping effects. CSS transitions use `duration-*` and `ease-standard` with `motion-reduce:transition-none`. Announcements stay up the same time and are read out in an `aria-live` region. Card and table motion belongs to `@pbgo/table`, not to the in-game UI.

## Clipping the HUD

`GameHud`'s root clips with `overflow-clip`, not `overflow-hidden`: a hidden box is still a scroll container, so a click or focus inside it could scroll the whole table out of place.

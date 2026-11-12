# In-game rules

A game's screen is drawn in the game's look. The table (its cards, tokens, seat plates, announcements, confetti) and everything around it (the state of the game with its log of the turns, the players with their scores, the chat, the windows of the menu of the game, the end screen) read the game's skin tokens, set by `themeStyle()` on the page and tuned by `UI_THEME` where a field exists (see [Game themes](../04-in-game/03-game-themes.md)). The one island of the platform's look is the social dock with its panel and the menu of its picture: the platform's tokens, Geist, the `.platform` class, from `@pbgo/ui/platform`.

- In the game's look, nothing of the platform's: no `@pbgo/ui/platform`, no Geist, no `.platform` class. A game with no skin takes the defaults of `game.css`, a sober palette, so an interface never reads a token that is not there. `platform-look.test.ts` keeps the rule for the files that have moved and names the ones that have not.
- The social dock and its panel keep the platform's look and carry the `.platform` class themselves, since a game's page is not `.platform`: a game never tunes them, and they never read a game's token.
- Text laid straight on the table, like the log of the turns and the messages of the chat, has no card, veil or border behind it: it takes `table-ink`, a halo in the table's own colour, so that it reads over a felt, a card or a picture.
- A game never forks or restyles a shared component: for what it can tune it asks for a field in `UiTheme`, and for what an interface shows it gives its view what it reads (`standings`, the score of each player).
- No copy in shared components: every label is a `UI_TEXTS` key, in the four languages, or in English only until the language pass for a new one (`ENGLISH_ONLY_TEXTS`).
- The screens of a table that starts, between the platform's page and the board (`StartScreen`, `ReadyScreen`, PLT-107), are the platform's own moment: they stay in its look, in English until the language pass.
- The end screen (`GameOverCard`) is a card centered on the screen, over the board with no veil, in the game's look (`UI_THEME.gameOver`, `UI_THEME.seat`, the skin), in English until the language pass, with its own `short` layout.

## Room for the cookie banner

The table is as tall as the window and the banner floats over it, since a canvas that shrank with the banner would reflow the scene: `GameHud` keeps the HUD and the game's overlays in a layer above the banner's room. The chat of the table is the exception: it stays against the bottom edge like the table, and the banner passes over it until the visitor answers (a chat lifted by the banner would float in the middle of the screen). Any other screen as tall as the viewport subtracts the banner (`h-[calc(100dvh-var(--consent-h,0px))]`) and an element fixed to the bottom offsets by it (`bottom-[var(--consent-h,0px)]`), or the banner covers its buttons. `--consent-h` is the height of the banner's outer box, its margin included. `consent-room.test.ts` fails on a violation.

## Compact layout

The Tailwind variant `short` (in `packages/core/styles/game.css`) is keyed on the viewport height, because a phone held sideways is wide but short. The HUD uses it and a game's overlays should too. The hub does not define it. To check a table on a phone held sideways, hide the `DesktopOnly` wall with injected CSS in the browser, never in the code.

## Motion

`motion/react` goes through `useMotion()` (`reduced`, `calm` or `lively`), and `GameHud` mounts `MotionConfig reducedMotion="user"`. Reduced motion always wins over `UI_THEME.motion`: short fades only, no confetti, springs or looping effects. CSS transitions use `duration-*` and `ease-standard` with `motion-reduce:transition-none`. Announcements stay up the same time and are read out in an `aria-live` region. Card and table motion belongs to `@pbgo/table`, not to the in-game UI.

## Clipping the HUD

`GameHud`'s root clips with `overflow-clip`, not `overflow-hidden`: a hidden box is still a scroll container, so a click or focus inside it could scroll the whole table out of place.

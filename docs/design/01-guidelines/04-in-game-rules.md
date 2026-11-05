# In-game rules

The UI that `@pbgo/core` draws inside a game (screens, HUD, announcements, seat label, players strip, game over, chat) is not part of the platform layer. It is drawn in the game's own look, never the platform's.

- Never `@pbgo/ui/platform`, Geist or the `.platform` class: it reads the game's skin tokens, set by `themeStyle()` and tuned by `UI_THEME` (see [Game themes](../04-in-game.md#game-themes)).
- A game never forks or restyles an in-game component: it asks for a field in `UiTheme`, which every game then gets.
- No copy in shared components: every label is a `UI_TEXTS` key, in the four languages.

## Room for the cookie banner

A screen as tall as the viewport subtracts the banner (`h-[calc(100dvh-var(--consent-h,0px))]`) and an element fixed to the bottom offsets by it (`bottom-[var(--consent-h,0px)]`), or the banner covers its buttons. `--consent-h` is the height of the banner's outer box, its margin included. `consent-room.test.ts` fails on a violation.

## Compact layout

The Tailwind variant `short` (in `packages/core/styles/game.css`) is keyed on the viewport height, because a phone held sideways is wide but short. The HUD uses it and a game's overlays should too. The hub does not define it. To check a table on a phone held sideways, hide the `DesktopOnly` wall with injected CSS in the browser, never in the code.

## Motion

`motion/react` goes through `useMotion()` (`reduced`, `calm` or `lively`), and `GameHud` mounts `MotionConfig reducedMotion="user"`. Reduced motion always wins over `UI_THEME.motion`: short fades only, no confetti, springs or looping effects. CSS transitions use `duration-*` and `ease-standard` with `motion-reduce:transition-none`. Announcements stay up the same time and are read out in an `aria-live` region. Card and table motion belongs to `@pbgo/table`, not to the in-game UI.

## Clipping the HUD

`GameHud`'s root clips with `overflow-clip`, not `overflow-hidden`: a hidden box is still a scroll container, so a click or focus inside it could scroll the whole table out of place.

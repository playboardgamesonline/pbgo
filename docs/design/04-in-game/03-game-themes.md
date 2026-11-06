# Game themes

The in-game UI is not drawn with the platform tokens: each game owns its universe. The components are shared, logic and layout alike; a game only tunes their look through `UI_THEME` in its binding (`motion`, `announcement`, `seat`, `gameOver`), on top of its own colors and fonts. Three parts are tuned by it (`UiTheme` in `lib/binding.ts`; `lib/ui-theme.ts` holds the defaults and `announcementTheme|seatTheme|gameOverTheme`): the announcements, the seat label and the game over.

Every specimen of these pages sits inside its game's tokens, two games side by side, and both sides use the same neutral sample copy, so that only the look differs.

```specimen
game-themes
```

## The theme contract

`UI_THEME?: UiTheme` is in the binding's `.` (isomorphic). Every field is optional and a CSS value only (`var(--accent-game)` works).

- Nothing declared means the defaults of `lib/ui-theme.ts`, the look the games had before they could tune it: white letters with a thin gold outline, gold hairlines and stars, a black veil; round seat discs; the skin's surface with a thin accent line and a cream polaroid. They are drawn with the game's skin tokens.
- Four groups: `motion` (`"calm"` by default: fades and short slides; `"lively"`: also confetti, springs and the emoji burst), `announcement`, `seat` and `gameOver` (their fields are in [Announcements](06-announcements.md), [Seat label](04-seat-label.md) and [Game over](07-game-over.md)).
- Courtisans keeps its banquet in `games/courtisans/src/lib/ui-theme.ts`: gold line and stars on navy, `--font-accent`, round gold-ringed discs, lively.
- The template is "paper & ink" in `template/src/lib/ui-theme.ts`: cream on ink, vermilion rule, square seats, a paper panel, calm.

A game never forks or restyles an in-game component: it asks for a field in `UiTheme`, which every game then gets.

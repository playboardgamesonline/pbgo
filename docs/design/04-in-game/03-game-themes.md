# Game themes

Nothing on a game's screen is drawn with the platform tokens but its social dock: each game owns its universe, the table and the screen around it. The components are shared, logic and layout alike; a game tunes their look through its skin (its colors and fonts) and, where a part has a group, through `UI_THEME` in its binding (`motion`, `announcement`, `seat`, `gameOver`) ([the rules](../01-guidelines/04-in-game-rules.md)). Three parts are tuned by it (`UiTheme` in `lib/binding.ts`; `lib/ui-theme.ts` holds the defaults and `announcementTheme|seatTheme|gameOverTheme`): the announcements, the seat label and the end screen.

Every specimen of these pages sits inside its game's tokens, two games side by side, and both sides use the same neutral sample copy, so that only the look differs.

```specimen
game-themes
```

## The theme contract

`UI_THEME?: UiTheme` is in the binding's `.` (isomorphic). Every field is optional and a CSS value only (`var(--accent-game)` works).

- Nothing declared means the defaults of `lib/ui-theme.ts`, the look the games had before they could tune it: white letters with a thin gold outline, gold hairlines and stars, a black veil; round seat discs; the skin's surface with a thin accent line. They are drawn with the game's skin tokens.
- Four groups: `motion` (`"calm"` by default: fades and short slides; `"lively"`: also confetti, springs and the emoji burst), `announcement`, `seat` and `gameOver` (their fields are in [Announcements](06-announcements.md), [Seat label](04-seat-label.md) and [Game over](07-game-over.md)).
- The log of the turns, the players with their scores, the chat and the windows of the menu have no group: they read the skin tokens alone (`--foreground`, `--background`, `--surface`, `--accent-game`, the fonts), whose defaults in `game.css` are the look of a game with no skin, and lay their text on the table with `table-ink`. A group is added when a game asks for a field that the skin cannot give.
- Courtisans keeps its banquet in `games/courtisans/src/lib/ui-theme.ts`: gold line and stars on navy, `--font-accent`, round gold-ringed discs, lively.
- The template is "paper & ink" in `template/src/lib/ui-theme.ts`: cream on ink, vermilion rule, square seats, a paper card, calm.

A game never forks or restyles an in-game component: it asks for a field in `UiTheme`, which every game then gets.

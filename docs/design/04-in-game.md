# In-game UI

Everything about the UI that `@pbgo/core` draws inside a game, always in the game's own look and never the platform's: first what core provides (screens, HUD, announcements, seat label, game over, skin), then how a game tunes it. What every game shares around its board is drawn on this page in the look of two games side by side, Courtisans and the template: each game owns its universe, and the platform's look stops at the table's edge. The rules of the in-game UI (the room for the cookie banner, the compact layout, motion, copy) are in [the guidelines](01-guidelines.md#in-game-ui), the platform's look in [Foundations](02-foundations.md).

## Screens and game flow

The in-game part of the `@pbgo/core` entry of `docs/packages.md`:

- Standard screens and game flow (from Courtisans): `Screen` (home, invitation, lobby), `GameHud` + `Ticker` + `groupTurns` + `useAnnouncements`, `GameOver` (`renderDetail` for the score detail), sound (`lib/sound.ts`, `SoundButton`, `SoundEngine`), `DesktopOnly`, leva debug panel, all mounted by `AppShell` in the `[game]` layout.
- The in-game UI (ticker, announcements, takeover pill, chat, game over, `PlayersStrip`, seat label) is written once and drawn in the game's own look, never the platform's. The ticker, the takeover pill, the chat and the toolbar have no setting: they take the game's skin as they are.

### Settings menu

A button next to the logo (`components/toolbar.tsx`) opens rules, sound, feedback, language and cookies.

### Chat

`components/game/chat.tsx`, mounted by `GameHud`: Supabase realtime broadcast without storage. A message is sent through `POST /api/<slug>/games/<code>/chat` (author = player cookie, member of the game, 200 characters at most or a known reaction), the server broadcasts it (`lib/chat.ts`) and the clients only listen.

### Turn crown

The crown stands left of the active player's nickname (template: `board/crown.tsx`; Courtisans: `CrownMark`).

### Desktop only

`DesktopOnly` is a full-screen wall under 900 px on game pages only (`/<slug>/game/…`, the gamemaster's game preview included). The home and public pages stay readable on mobile (SEO), with `DesktopNotice` and no table creation from a narrow screen. The wall (`z-[100]`) sits above the cookie banner (`z-50`) like it does above the rest of the game page, so nothing is asked on that screen: the banner shows on the game home and the hub.

### Debug

The leva panel opens with `Shift+D`, `?debug` or in development builds. The in-game UI only has the announcement presets in it (TRANSITION tab: duration, sound, scrim, fade, sizes, banner, confetti); a game adds its own scene knobs.

## Skin

`lib/skin.ts` (`loadSkin`, `useSkin`, `useText`) reads the game's skin from Sanity: `interface` (top and bottom art, character, pattern, host icon, player colors, desktop only) and `texts` (home intro, victory lines, the `UI_TEXTS` labels of `@pbgo/studio-kit/constants`).

A game's `DEFAULT_SKIN` only says how the skin behaves (player colours, desktop only), never a text or an image: a picture that is not in Sanity is not drawn, and a required text that is not there reads `[missing: <key>]` (see `docs/sanity-and-languages.md`).

### Accent font

The accent font (announcements, intro) is the CSS variable `--font-accent`, set by `themeStyle()` from the accent font file uploaded in Gamemaster › Visual (`settings.accentFontFile`, family `Site Accent`, served like the other uploaded fonts). A game with no file reads `var(--font-accent, var(--font-title))`, so the screens fall back to its title font. A game's CSS never declares a font file: fonts are Sanity files.

## Game themes

The in-game UI is not drawn with the platform tokens: each game owns its universe. The components are shared, logic and layout alike; a game only tunes their look through `UI_THEME` in its binding (`motion`, `announcement`, `seat`, `gameOver`), on top of its own colors and fonts. Three parts are tuned by it (`UiTheme` in `lib/binding.ts`; `lib/ui-theme.ts` holds the defaults and `announcementTheme|seatTheme|gameOverTheme`): the announcements, the seat label and the game over.

Every specimen of this page sits inside its game's tokens, two games side by side, and both sides use the same neutral sample copy, so that only the look differs.

```specimen
game-themes
```

### The theme contract

`UI_THEME?: UiTheme` is in the binding's `.` (isomorphic). Every field is optional and a CSS value only (`var(--accent-game)` works).

- Nothing declared means the defaults of `lib/ui-theme.ts`, the look the games had before they could tune it: white letters with a thin gold outline, gold hairlines and stars, a black veil; round seat discs; the skin's surface with a thin accent line and a cream polaroid. They are drawn with the game's skin tokens.
- Four groups: `motion` (`"calm"` by default: fades and short slides; `"lively"`: also confetti, springs and the emoji burst), `announcement`, `seat` and `gameOver` (their fields are in the sections below).
- Courtisans keeps its banquet in `games/courtisans/src/lib/ui-theme.ts`: gold line and stars on navy, `--font-accent`, round gold-ringed discs, lively.
- The template is "paper & ink" in `template/src/lib/ui-theme.ts`: cream on ink, vermilion rule, square seats, a paper panel, calm.

A game never forks or restyles an in-game component: it asks for a field in `UiTheme`, which every game then gets.

## Seat label

One component for a player on a table: an avatar, the nickname and the seat color, used by every board, the players strip, the announcements and the game over. It is `seat-label.tsx`, fed by `player-seat.tsx`, and the one way a player is named in the DOM (lobby, strip, announcements, game over). The tables paint the same avatar (`lib/seat-avatar-canvas.ts`, `SeatAvatarMesh` of each game).

Until accounts exist (PLT-13) the avatar is generated from the nickname and the seat color (the initial on the seat colour); an account picture (`imageUrl`, PLT-13) replaces it and nothing else changes. `UI_THEME.seat` sets its shape, ring, font and whether the name takes the seat color or the ink around it: `shape`, `ring`, `font`, `name` (`"seat"` colour or `"ink"`).

The crown in the specimen is a stand-in for the table's crown icon.

```specimen
seat-label
```

## Players strip

Under the ticker's main line when the game waits for several players at once: one seat label per player, done (✓), waiting or away, and the viewer's own seat marked. Beyond eight seats it collapses to an `n/N ready` button that opens the list.

```specimen
players-strip
```

## Announcements

Start, round, your turn and victory, full screen over the table, in four kinds (`start`, `round`, `turn`, `victory`). Same timeline for every game (the veil, the hairlines drawn from the centre, the title rising into focus, the subtitle). The presets and the timeline are in `lib/announcement-settings.ts`, pure and tested; `announcementSettings(preset, UI_THEME.announcement)` seeds them.

`UI_THEME.announcement` sets the font, the letters, the veil, the hairlines and the confetti (`font`, `color`, `outline`, `shadow`, `veil`, `rule`, `confetti`), and `UI_THEME.motion` the flourish: `calm` fades and short slides, `lively` adds springs and confetti. Reduced motion always wins: everything fades at once, 150 ms at most.

Sizes go through `vh()`, `calc(var(--vh, 1vh) * n)`: a screen reads the viewport, a stage that sets `--vh` (the specimen below, scaled down) sizes like a screen of its own height. The stage of the specimen is a 1280 × 720 reference screen scaled down.

```specimen
announcements
```

## Game over

The end screen: the winner or winners as the hero, the ranking under it, the score detail of each player (score chips from `renderDetail`), the share thumbnail as a polaroid on the corner, in the game's surface. The table is centered, with a "hide / show" link above the centered PLAY AGAIN button.

`UI_THEME.gameOver` sets the surface (any CSS background), border, radius, ink, accent and polaroid frame (`surface`, `border`, `radius`, `ink`, `accent`, `frame`). Replay plays the entrance of a first opening; the screen is otherwise drawn still.

```specimen
game-over
```

## Pure views and connected wrappers

The announcements (`announcement-view.tsx`, which `AnnouncementPresence` wraps in `AnimatePresence`; `announcement.tsx` adds the sound, leva and the game), the game over (`game-over-panel.tsx`; `game-over.tsx` reads the game, shares the result and replays) and the strip (`players-strip-view.tsx`; `players-strip.tsx`) take props only, so these docs draw the very same markup as the games. A change goes into the view; the specimens follow by themselves.

## How the docs draw the in-game UI

This page is the one place where the site shows the in-game UI. Two games (Courtisans and the template) are drawn side by side, each inside a `GameScope` (`apps/web/src/app/(hub)/docs/_specimens/game-scope.tsx`) that resets the platform's values (Geist, weight, line-heights, tracking, radius) and sets the game's tokens and font stacks on its own wrapper, never on `:root`.

- The hub does not load `game.css`: `globals.css` points `@source` at the four pure components (`seat-label`, `players-strip-view`, `announcement-view`, `game-over-panel`) and maps the utilities only games have (`font-display`, `bg-surface`, `bg-surface-dark`, `text-accent-game`) with `@theme inline`, which emits no variable. A new pure component drawn here needs its `@source` there.
- The font files of a game are not loaded on the hub, so its families fall to the next of the stack (Georgia, a serif); the colours, layout and motion are the real ones. The colors, the sizes and the texts are the code defaults of each game, not the values saved in its Sanity project.
- The compact layout of a short screen (the `short` variant, a phone held sideways) is keyed on the viewport and is not drawn here ([Compact layout](01-guidelines.md#compact-layout)).
- Use `data-look`, never `data-game` (analytics counts the hub links that carry it).

# Screens and game flow

The in-game part of the `@pbgo/core` entry of `docs/packages.md`:

- A game has no home page and no lobby screen: a table is opened, joined and started on the platform's page of the game (PLT-106, `docs/routing.md`), and the players then come to the board. Standard screens and game flow (from Courtisans): `Screen` (the screens around the board: a table that has no board for the visitor and a game's 404; the screen of a table that starts is the platform's, see [the rules](../01-guidelines/04-in-game-rules.md)), `GameHud` + `Ticker` + `groupTurns` + `useAnnouncements`, `GameOver` (`renderDetail` for the score detail), sound (`lib/sound.ts`, `SoundButton`, `SoundEngine`), `DesktopOnly`, leva debug panel, all mounted by `AppShell` in the `[game]` layout.
- The in-game UI (ticker, announcements, takeover pill, chat, game over, `PlayersStrip`, seat label) is written once and drawn in the game's own look, never the platform's. The ticker, the takeover pill, the chat and the toolbar have no setting: they take the game's skin as they are.

## Settings menu

A button next to the logo (`components/toolbar.tsx`) opens rules, sound, feedback, language and cookies.

## Chat

`components/game/chat.tsx`, mounted by `GameHud`: Supabase realtime broadcast without storage. A message is sent through `POST /api/<slug>/games/<code>/chat` (author = player cookie, member of the game, 200 characters at most or a known reaction), the server broadcasts it (`lib/chat.ts`) and the clients only listen.

## Turn crown

The crown stands left of the active player's nickname (template: `board/crown.tsx`; Courtisans: `CrownMark`).

## Desktop only

`DesktopOnly` is a full-screen wall under 900 px on game pages only (`/<slug>/game/…`, the gamemaster's game preview included). The hub, with the page of the game where a table is opened, stays readable on mobile (SEO) and offers its tables on a narrow screen too; it is the board that the wall covers. The wall (`z-[100]`) sits above the cookie banner (`z-50`) like it does above the rest of the game page, so nothing is asked on that screen: the banner shows on the hub.

## Debug

The leva panel opens with `Shift+D`, `?debug` or in development builds. The in-game UI only has the announcement presets in it (TRANSITION tab: duration, sound, scrim, fade, sizes, banner, confetti); a game adds its own scene knobs.

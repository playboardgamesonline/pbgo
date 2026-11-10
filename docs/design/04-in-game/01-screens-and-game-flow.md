# Screens and game flow

The in-game part of the `@pbgo/core` entry of `docs/packages.md`:

- A game has no home page and no lobby screen: a table is opened, joined and started on the platform's page of the game (PLT-106, `docs/routing.md`), and the players then come to the board. Standard screens and game flow (from Courtisans): `Screen` (the screens around the board: a table that has no board for the visitor and a game's 404; the screen of a table that starts is the platform's, see [the rules](../01-guidelines/04-in-game-rules.md)), `GameHud` + `Ticker` + `groupTurns` + `useAnnouncements`, `GameOver` (`renderDetail` for the score detail), sound (`lib/sound.ts`, `SoundButton`, `SoundEngine`), `DesktopOnly`, leva debug panel, all mounted by `AppShell` in the `[game]` layout.
- The in-game UI is written once. The announcements, the takeover pill, the seat label and the game over are the table's, drawn in the game's own look and tuned by `UI_THEME`. The corners of the screen (the ticker, the social dock with the menu of the game, the players with their scores, the chat) are around the table, drawn in the platform's look, with no setting ([the rules](../01-guidelines/04-in-game-rules.md)). The history of the ticker is the log of the table (`useGameLog`, then `groupTurns`): [Events and the log](../../engine/01-the-game/12-events-and-the-log.md).

## Menu of the game

The picture at the top right (the visitor's, in the social dock, or the initials of a guest in a bar of its own) opens the menu of the game (`components/game/game-menu.tsx`), one row for each thing. Everyone has the sound, the setup of the game, its rules, the feedback and the way out; a visitor who is not signed in has the language, the cookies and the legal notice too, which a member keeps in their account, and nothing of an account, not even Sign in. A member's menu goes on with the pages of their account, which open in a new tab so that the table is not left. The windows the rows open are the platform's (`game-windows.tsx`). `components/toolbar.tsx` stays on the screens that are still in the game's look.

## Players

The list of the players under the dock (`components/game/table-players.tsx`) is always in view: who sits at the table, whom the game waits for (the row is lit), who is away (the row is dimmed) and what each has so far, from `standings` in the view when the game gives it. The pointer on a row opens the card of the player.

## Chat

`components/game/chat.tsx`, mounted by `GameHud`, in the platform's look and against the bottom edge (the cookie banner passes over it, and it steps aside when the dock opens): Supabase realtime broadcast without storage. A message is sent through `POST /api/<slug>/games/<code>/chat` (author = player cookie, member of the game, 200 characters at most or a known reaction), the server broadcasts it (`lib/chat.ts`) and the clients only listen.

## Turn crown

The crown stands on the corner of the active player's avatar (`TurnCrown` of `@pbgo/table`, the way the seat label wears the host's crown in the DOM). Courtisans keeps its own, left of the nickname (`CrownMark`), until its board moves to the shared tools.

## Desktop only

`DesktopOnly` is a full-screen wall under 900 px on game pages only (`/<slug>/game/…`, the gamemaster's game preview included). The hub, with the page of the game where a table is opened, stays readable on mobile (SEO) and offers its tables on a narrow screen too; it is the board that the wall covers. The wall (`z-[100]`) sits above the cookie banner (`z-50`) like it does above the rest of the game page, so nothing is asked on that screen: the banner shows on the hub.

## Debug

The leva panel opens with `Shift+D` or `?debug`; a development build fetches it at once. It never opens on the production deployment (`NEXT_PUBLIC_APP_ENV`): there the address, the storage and the keyboard are not even read, and nothing is fetched. The in-game UI only has the announcement presets in it (TRANSITION tab: duration, sound, scrim, fade, sizes, banner, confetti); the shared `Table` adds the folders of the table (camera, cards, seats, lights, floor, glows, helpers, inspector, slow motion), and a game adds its own with `useSettings` or `useDebugFolder` (`docs/engine/04-build-a-game/07-tuning.md`).

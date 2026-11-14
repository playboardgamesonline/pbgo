# Seat label

One component for a player on a table: an avatar, the nickname and the seat color, used by every board, the players strip, the announcements and the game over. It is `seat-label.tsx`, fed by `player-seat.tsx`, and the one way a player is named in the DOM (strip, announcements, game over). The tables paint the same avatar (`lib/seat-avatar-canvas.ts`, `SeatAvatarMesh` of `@pbgo/table`, which its `Seat` and `PlayerSeat` use).

The avatar is generated from the nickname and the seat colour; a player who sat down as an account has its picture (`avatarUrl`, taken on the server, PLT-106) and nothing else changes. `UI_THEME.seat` sets its shape, ring, font and whether the name takes the seat color or the ink around it: `shape`, `ring`, `font`, `name` (`"seat"` colour or `"ink"`).

A nickname is written as typed, never in capitals, in Geist at the platform's weight 600 (the label's name is `font-semibold` unless a caller says otherwise; the game over's medallions keep their own capitals and Black, which is a different piece), the avatar always to its left, and it is drawn at most `NAME_LIMIT` (12) characters long: a longer one ends in an ellipsis (`shortName` of `@pbgo/core/lib/short-name`, counted in characters as the eye counts them, so an emoji or an accent is never cut in half), and the label's `title` keeps the full name. The same function cuts the name on the plate of the table, in the list of the players and in the ticker ([Long names](../../engine/02-components/03-seats.md#long-names)).

The crown in the specimen is a stand-in for the table's crown icon.

```specimen
seat-label
```


On the table the same rules hold for the plate of a seat (`Seat` of `@pbgo/table`: avatar at the left, then the name, then an info line with the score and the status as plain text, and a slot to the right for tokens; [The layout of a plate](../../engine/02-components/03-seats.md#the-layout-of-a-plate)). A player who is out is never struck out, in the DOM or on the table: the table greys their cards (`Card` `out`), and the status word says why.

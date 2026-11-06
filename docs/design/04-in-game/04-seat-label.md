# Seat label

One component for a player on a table: an avatar, the nickname and the seat color, used by every board, the players strip, the announcements and the game over. It is `seat-label.tsx`, fed by `player-seat.tsx`, and the one way a player is named in the DOM (strip, announcements, game over). The tables paint the same avatar (`lib/seat-avatar-canvas.ts`, `SeatAvatarMesh` of each game).

The avatar is generated from the nickname and the seat colour; a player who sat down as an account has its picture (`avatarUrl`, taken on the server, PLT-106) and nothing else changes. `UI_THEME.seat` sets its shape, ring, font and whether the name takes the seat color or the ink around it: `shape`, `ring`, `font`, `name` (`"seat"` colour or `"ink"`).

The crown in the specimen is a stand-in for the table's crown icon.

```specimen
seat-label
```

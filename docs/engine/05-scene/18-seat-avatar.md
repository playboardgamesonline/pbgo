# Seat avatar

The seat avatar is the picture that stands for a player next to their nickname. The same picture is drawn in the DOM by `SeatLabel` and on the table by `SeatAvatarMesh` ([Seat label](../../design/04-in-game.md#seat-label)). Per game: the template's `board/seat-avatar-mesh.tsx` is the reference.

Core specifies the avatar (`seatAvatar`) and paints it on a 2D canvas (`useSeatAvatarCanvas`), and stays free of three.js. The game wraps that canvas in a texture and lays it on a plane.

## Props

| Prop | Role |
| --- | --- |
| `nickname`, `color` | What the avatar is made of until a picture exists: the initial on the seat colour |
| `imageUrl` | The player's picture; when it is null the avatar is generated |
| `theme` | The game's `SeatTheme`, `UI_THEME.seat`, read with `useSeatTheme()` |
| `position` | Where it lies, in the frame it is placed in |
| `size` | The diameter of the avatar, in world units |
| `layer` | The render order, to draw it over or under other flat things |

## Rules

- It draws nothing until the canvas is ready (a font or a picture may still be loading), then lies flat on the table.
- The plane is larger than the avatar by `AVATAR_FILL` of core, the share of the canvas the avatar fills, so the ring and the shadow fit. `size` is the avatar's own diameter.
- The texture is disposed when it changes or when the component goes.
- It takes no pointer events ([Clicks and hover](20-clicks-and-hover.md)).
- Place it with the nickname: in the template it is a child of the `TableText` (left of the first letter) or its `trailing` (right of the last) ([Text on the table](19-text-on-the-table.md)).

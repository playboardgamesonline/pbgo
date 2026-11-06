# Share photo

At the game over, the share dialog makes an image of the finished table. With a `photo` camera, `Table` registers a capture function (`setPhotoCapture` of core) that renders the scene once from that camera, at the size the dialog asks for. Shared: `packages/table/src/table/share-photo.tsx`. The component `SharePhoto` is internal; a game only passes `photo` to [Table](01-table.md).

## What it takes

- `photo` is a `CameraSettings` ([Camera](02-camera.md)), usually farther away than the live camera so the whole table is in the picture. The template keeps it in `PHOTO` of `board/camera.ts`.
- It is read when the photo is taken, so a game can change it live. The capture registers again when the object itself is replaced.

## Rules

- The photo has a camera of its own, placed by `placeCamera` with no entrance and no backing off: it does not depend on where the live camera stands or on the shape of the screen. It sees as near and as far as the live camera.
- An object with `userData.hiddenInPhoto` set is left out of the picture: use it for what is not part of the table itself, such as a veil laid over the screen. Only objects visible at that moment are hidden, and they come back right after.
- The render goes through the live renderer, sized for the photo and not for the screen. The renderer's size, pixel ratio and live view are restored afterwards, even if the render throws.
- Without `photo` the share image is the pixels of the live canvas, which core finds by `TABLE_CANVAS_ID`: leave the `id` of the `Table` at its default. `preserveDrawingBuffer` is what makes the read possible.
- The capture is unregistered when the table unmounts.
- The template's "Share Photo" folder of the debug panel has a "Download test photo" button that calls `captureGamePhoto` ([Tuning](24-tuning.md)).
- The share panel itself is the shared UI's ([Game over](../../design/04-in-game/07-game-over.md)).

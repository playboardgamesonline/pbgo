"use client"

import { Picture, Stamp } from "@pbgo/table"
import type { StickerPlace } from "./layout"
import type { StickerPicture } from "./textures"

/** How long a sticker takes to land, in seconds */
const LAND = 0.45

/** Where a sticker lies, above the cards of a line (the highest is a card lifted by a hover) */
const LIES = 0.2

/** How high it drops from, in world units */
const DROP = 0.9

/**
 * A picture of the game's Sanity project lying on the table, with its own proportions (a stamp, a badge): it drops onto the table and settles with a thump when it appears, unless the visitor asks for less motion, and never reacts to the pointer. `yaw` turns it to read
 * upright from the seat it lies by (see `stickerPlaces` of the layout), `tilt` leans it a few degrees, `width` is its width in world units.
 */
export function Sticker({ picture, x, z, width, yaw, tilt = 0 }: { picture: StickerPicture } & StickerPlace) {
  return (
    <group position={[x, LIES, z]} rotation-y={yaw + tilt}>
      <Stamp duration={LAND} drop={DROP}>
        <Picture texture={picture.texture} aspect={picture.aspect} width={width} />
      </Stamp>
    </group>
  )
}

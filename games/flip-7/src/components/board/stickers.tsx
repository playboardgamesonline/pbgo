"use client"

import { useMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import type { Group } from "three"
import type { StickerPlace } from "./layout"
import type { StickerPicture } from "./textures"

/** How long a sticker takes to land, in seconds */
const LAND = 0.45

/** Where a sticker lies, above the cards of a line (the highest is a card lifted by a hover) */
const LIES = 0.2

/** How high it drops from, in world units */
const DROP = 0.9

/** A sticker's size over time: from nothing to a little too big and back to its size, as a stamp thumped down is */
const thump = (t: number) => {
  const c1 = 1.9
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

/**
 * A picture of the game's Sanity project lying on the table, with its own proportions (a stamp, a badge): it drops onto the table and settles when it appears, unless the visitor asks for less motion, and never reacts to the pointer. `yaw` turns it to read
 * upright from the seat it lies by (see `stickerPlaces` of the layout), `tilt` leans it a few degrees, `width` is its width in world units.
 */
export function Sticker({ picture, x, z, width, yaw, tilt = 0 }: { picture: StickerPicture } & StickerPlace) {
  const group = useRef<Group>(null)
  const born = useRef<number | null>(null)
  const reduced = useMotion() === "reduced"
  useFrame(({ clock }) => {
    const node = group.current
    if (!node) return
    born.current ??= clock.elapsedTime
    const t = reduced ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - born.current) / LAND))
    node.scale.setScalar(Math.max(0.001, thump(t)))
    node.position.y = LIES + (1 - t) ** 2 * DROP
  })
  return (
    <group ref={group} position={[x, LIES, z]} rotation-y={yaw + tilt} scale={reduced ? 1 : 0.001}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={4} raycast={() => null}>
        <planeGeometry args={[width, width / picture.aspect]} />
        <meshBasicMaterial map={picture.texture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

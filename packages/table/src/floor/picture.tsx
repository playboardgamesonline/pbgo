"use client"

import type { Texture } from "three"
import { PICTURE, pictureAspect } from "./picture-look"

export type PictureProps = {
  /** The picture: a texture whose transparent parts are cut out, such as a sticker, a sign, an arrow or a soft disc */
  texture: Texture
  /** How wide it lies, in world units; its height follows its proportions */
  width: number
  /** Its proportions, width over height: those of the image the texture holds when not given (a square when it holds none). A picture that must be stretched to a shape gives it */
  aspect?: number
  /** Where it lies on the table, in the frame it is put in (default: the origin of that frame) */
  at?: { x?: number; z?: number }
  /** How high it lies above that plane (default 0) */
  lift?: number
  /** Its turn about the vertical axis, in radians (default 0) */
  yaw?: number
  /** What it is drawn after (`renderOrder`: default `PICTURE.order`, over the mat and what lies flat on it) */
  order?: number
  /** How much of it shows, 0 to 1 (default 1) */
  opacity?: number
  /** A colour the picture is multiplied by: a white picture takes it whole, as a tinted disc does (default none: the picture as it is) */
  color?: string
}

/**
 * A picture that lies flat on the table: a sticker, a stamp, an arrow, a sign, a soft disc under a number. It is a plane with the texture, unlit and not tone mapped like everything on the table, and it takes no press and no pointer, so that what
 * lies under it keeps them. Put it in an `Appear` to fade it in and in a `Stamp` to thump it down; a game gives it nothing else to draw.
 */
export function Picture({ texture, width, aspect, at, lift = 0, yaw = 0, order = PICTURE.order, opacity = 1, color }: PictureProps) {
  const ratio = aspect ?? pictureAspect(texture)
  return (
    <group position={[at?.x ?? 0, lift, at?.z ?? 0]} rotation-y={yaw}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={order} raycast={() => null}>
        <planeGeometry args={[width, width / ratio]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} opacity={opacity} {...(color === undefined ? {} : { color })} />
      </mesh>
    </group>
  )
}

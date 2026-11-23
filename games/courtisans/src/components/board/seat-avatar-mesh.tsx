"use client"

import { useEffect, useMemo } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"
import { seatAvatar } from "@pbgo/core/lib/seat-avatar"
import { AVATAR_FILL } from "@pbgo/core/lib/seat-avatar-canvas"
import type { SeatTheme } from "@pbgo/core/lib/ui-theme"
import { useSeatAvatarCanvas } from "@pbgo/core/lib/use-seat-avatar-canvas"

/**
 * A player's avatar lying on the table next to their nickname: the picture of the shared seat label (`SeatLabel` of @pbgo/core), painted
 * by core on a canvas and laid on a plane the way `TableText` lays the nickname. `size` is the avatar's diameter in world units.
 */
export function SeatAvatarMesh({
  nickname,
  color,
  imageUrl,
  theme,
  position,
  size,
  order = 0,
}: {
  nickname: string
  color: string
  /** The account's picture (PLT-13); absent: the avatar is generated */
  imageUrl?: string | null
  theme: SeatTheme
  position: [number, number, number]
  size: number
  order?: number
}) {
  const avatar = useMemo(() => seatAvatar({ nickname, color, imageUrl }), [nickname, color, imageUrl])
  const canvas = useSeatAvatarCanvas(avatar, theme)
  const texture = useMemo(() => {
    if (!canvas) return null
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    return map
  }, [canvas])
  useEffect(() => () => texture?.dispose(), [texture])
  if (!texture) return null
  const side = size / AVATAR_FILL
  return (
    <mesh position={position} rotation-x={-Math.PI / 2} renderOrder={order} raycast={() => null}>
      <planeGeometry args={[side, side]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

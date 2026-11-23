"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef } from "react"
import { type Mesh, type MeshBasicMaterial, Vector3 } from "three"
import { VEIL, veilTarget } from "./veil-look"

export type VeilProps = {
  /** Whether the table is dark: it comes on when this turns true and goes when it turns false */
  active: boolean
  /** How dark, 0 to 1 (`VEIL.opacity`) */
  opacity?: number
  /** The seconds it takes to come on (`VEIL.fade`) and to go (`VEIL.away`) */
  fade?: number
  away?: number
  /** Its colour (default black): a very dark colour of the game's own is a quieter dark than black */
  color?: string
}

const AT = new Vector3()

/**
 * The dark the table is put in so that one thing stands out: the missions a player reads, the winner at the end of a game. It is a plane in front of the camera, which follows it, that is drawn after what is on the table and dims all of it; what must stay lit is drawn after
 * it (a `renderOrder` above `VEIL.order`, in the transparent pass, or a card that is `above`). It is hidden from the eye when it is nothing and takes no click.
 *
 * It comes on in `fade` seconds and goes in `away`; a visitor who asks for less motion gets it at once.
 */
export function Veil({ active, opacity, fade, away, color = "#000000" }: VeilProps) {
  const reduced = usePrefersReducedMotion()
  const mesh = useRef<Mesh>(null)
  useFrame(({ camera }, dt) => {
    const m = mesh.current
    if (!m) return
    m.position.copy(camera.localToWorld(AT.set(0, 0, -VEIL.distance)))
    m.quaternion.copy(camera.quaternion)
    const material = m.material as MeshBasicMaterial
    const { to, time } = veilTarget(active, { opacity, fade, away })
    if (reduced) material.opacity = to
    else easing.damp(material, "opacity", to, time, dt)
    m.visible = material.opacity > 0.01
  })
  return (
    <mesh ref={mesh} renderOrder={VEIL.order} raycast={() => null} visible={false}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

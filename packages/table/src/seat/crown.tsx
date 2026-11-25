"use client"

import { Billboard } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef } from "react"
import { CanvasTexture, Color, DoubleSide, type Group, type MeshBasicMaterial, SRGBColorSpace, type Texture, TextureLoader, Vector3 } from "three"

const GOLD = new Color("#f2c14e")
/** Scratch vectors of the frame loop, so that it allocates nothing */
const CENTRE = new Vector3()
const AWAY = new Vector3()

/** Crown drawn by default (no image needed): replaced by the game's icon (the skin's `hostIcon`, set in the admin) when there is one. */
function drawnCrown() {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.moveTo(28, 190)
  ctx.lineTo(18, 70)
  ctx.lineTo(84, 120)
  ctx.lineTo(128, 40)
  ctx.lineTo(172, 120)
  ctx.lineTo(238, 70)
  ctx.lineTo(228, 190)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(28, 204, 200, 26)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/**
 * Crown of the player whose turn it is, over their avatar (it does not travel around the table).
 * `position`: the centre of the avatar. `reach`: how far from that centre, along the table, its foot stands, on the side away from the camera: with the avatar's radius, the foot is on the edge of the avatar that the screen shows at its top, so the crown stands centred
 * above the round of the avatar at every seat and for any turn of the camera. `icon`: URL of the game's icon (the skin's `hostIcon`); without one, a drawn crown. `yaw`: how far the frame it stands in is turned about the vertical (the frame of a seat): the crown takes it
 * back, so that it faces the camera whichever way the seat is turned. A billboard that locks two axes only turns about its own vertical, and a parent that is turned would leave it slanted (a thin line at a seat on a side).
 */
export function TurnCrown({
  show,
  position,
  icon,
  size = 0.9,
  reach = 0,
  yaw = 0,
}: {
  show: boolean
  position: [number, number, number]
  icon?: string | null
  size?: number
  reach?: number
  yaw?: number
}) {
  const anchor = useRef<Group>(null)
  const ref = useRef<Group>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const texture = useMemo<Texture>(() => (icon ? new TextureLoader().load(icon) : drawnCrown()), [icon])
  useFrame(({ clock, camera }, dt) => {
    const g = ref.current
    if (!g) return
    // the foot goes `reach` from the avatar's centre, straight away from the camera along the table: the top of the avatar on the screen
    const a = anchor.current
    if (a) {
      a.getWorldPosition(CENTRE)
      AWAY.set(CENTRE.x - camera.position.x, 0, CENTRE.z - camera.position.z)
      if (AWAY.lengthSq() < 1e-9) AWAY.set(0, 0, -1)
      AWAY.normalize().multiplyScalar(reach).add(CENTRE)
      a.worldToLocal(AWAY)
      g.position.x = AWAY.x
      g.position.z = AWAY.z
    }
    easing.damp(g.scale, "x", show ? size : 0.0001, 0.25, dt)
    g.scale.y = g.scale.z = g.scale.x
    g.position.y = 0.5 * g.scale.x + 0.08 + (show ? Math.sin(clock.elapsedTime * 2) * 0.05 : 0)
    if (material.current) material.current.color.copy(GOLD).multiplyScalar(1 + 0.3 * Math.pow(0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.4), 6))
    g.visible = g.scale.x > 0.02
  })
  return (
    <group ref={anchor} position={position} rotation-y={-yaw}>
      <group ref={ref} scale={0.0001} visible={false}>
        <Billboard lockX lockZ>
          <mesh raycast={() => null}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial ref={material} map={texture} color="#f2c14e" transparent alphaTest={0.05} side={DoubleSide} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>
    </group>
  )
}

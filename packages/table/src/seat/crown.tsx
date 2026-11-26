"use client"

import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef } from "react"
import { CanvasTexture, type Group, MeshMatcapMaterial, SRGBColorSpace, Vector3 } from "three"
import { CROWN_SHAPE, crownGeometry } from "./crown-geometry"

/** The beat the crown takes now and then: how much brighter it grows at its top */
const GLOW_BEAT = 0.22
/** How fast the crown turns about its own vertical, in radians a second */
const SPIN = 0.7
/** Scratch vectors of the frame loop, so that it allocates nothing */
const CENTRE = new Vector3()
const AWAY = new Vector3()

/**
 * The light the crown is drawn in, a matcap: a soft studio light from the top left, a little shade toward the bottom right, painted on a canvas. A matcap needs no light in the scene, so the crown looks the same on every board, lit or not, and its colours (the gold going to
 * orange of `crownGeometry`) are multiplied by it.
 */
function studioMatcap() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(96, 78, 6, 128, 128, 132)
  g.addColorStop(0, "#ffffff")
  g.addColorStop(0.25, "#fbf8f2")
  g.addColorStop(0.6, "#ebe6dd")
  g.addColorStop(0.85, "#cbc4b8")
  g.addColorStop(1, "#9c9488")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const texture = new CanvasTexture(c)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** The mesh and its material, one of each for every crown of the page: the beat follows the clock, so it is the same for all. Built on first use, in the browser */
let shared: { geometry: ReturnType<typeof crownGeometry>; material: MeshMatcapMaterial } | null = null
function crownMesh() {
  shared ??= { geometry: crownGeometry(), material: new MeshMatcapMaterial({ matcap: studioMatcap(), vertexColors: true }) }
  return shared
}

const noRaycast = () => null

/**
 * Crown of the player whose turn it is: a soft, rounded crown in 3D (`crownGeometry`: a thick band rising into five points, gold going to orange downward, in the soft light of a matcap), built in code with no file to load, that turns slowly over their avatar and bobs. It does not travel around the
 * table. `position`: the centre of the avatar. `reach`: how far from that centre, along the table, the near side of the crown stands, on the side away from the camera: with the avatar's radius, the crown stands just behind the edge of the avatar that the screen shows at
 * its top, so it is centred above the round of the avatar at every seat and for any turn of the camera. `size`: its height. `yaw`: how far the frame it stands in is turned about the vertical (the frame of a seat): the crown takes it back, so that the world is its frame.
 */
export function TurnCrown({ show, position, size = 0.9, reach = 0, yaw = 0 }: { show: boolean; position: [number, number, number]; size?: number; reach?: number; yaw?: number }) {
  const anchor = useRef<Group>(null)
  const ref = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const { geometry, material } = crownMesh()
  useFrame(({ clock, camera }, dt) => {
    const g = ref.current
    const a = anchor.current
    if (!g || !a) return
    easing.damp(g.scale, "x", show ? size : 0.0001, 0.25, dt)
    g.scale.y = g.scale.z = g.scale.x
    // the crown's middle goes `reach` and half its own radius from the avatar's centre, straight away from the camera along the table: just behind the top of the avatar on the screen
    a.getWorldPosition(CENTRE)
    AWAY.set(CENTRE.x - camera.position.x, 0, CENTRE.z - camera.position.z)
    if (AWAY.lengthSq() < 1e-9) AWAY.set(0, 0, -1)
    AWAY.normalize()
      .multiplyScalar(reach + CROWN_SHAPE.radius * 0.5 * g.scale.x)
      .add(CENTRE)
    a.worldToLocal(AWAY)
    g.position.set(AWAY.x, 0.05 + (show ? (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2)) * 0.06 : 0), AWAY.z)
    spin.current?.rotateY(dt * SPIN)
    crownMesh().material.color.setScalar(1 + GLOW_BEAT * Math.pow(0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.4), 6))
    g.visible = g.scale.x > 0.02
  })
  return (
    <group ref={anchor} position={position} rotation-y={-yaw}>
      <group ref={ref} scale={0.0001} visible={false}>
        <group ref={spin}>
          <mesh geometry={geometry} material={material} raycast={noRaycast} />
        </group>
      </group>
    </group>
  )
}

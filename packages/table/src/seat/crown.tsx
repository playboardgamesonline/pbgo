"use client"

import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef } from "react"
import { Color, CylinderGeometry, DoubleSide, type Group, MeshStandardMaterial, Vector3 } from "three"

const GOLD = new Color("#f2c14e")
/** The glow the gold keeps in the dark of the table, and the beat it takes now and then */
const GLOW = 0.38
const GLOW_BEAT = 0.35
/** How fast the crown turns about its own vertical, in radians a second */
const SPIN = 0.9
/** Scratch vectors of the frame loop, so that it allocates nothing */
const CENTRE = new Vector3()
const AWAY = new Vector3()

/** The model is one unit tall with its foot at y = 0: a band of this radius and height, then five points that lean a little outward from its top rim */
export const CROWN_RADIUS = 0.42
const BAND_HEIGHT = 0.36
const POINTS = 5
const POINT_HEIGHT = 0.5
const POINT_RADIUS = 0.13
const LEAN = 0.18
const GEMS = ["#d1344b", "#3a7bd5"]

type Part = { key: string; position: [number, number, number]; rotation: [number, number, number] }

/** Where the points stand on the top rim (each leaning outward about the rim's tangent), the pearl on the tip of each and the gem on the band under each */
function crownParts() {
  const points: Part[] = []
  const pearls: Part[] = []
  const gems: Part[] = []
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2
    const x = Math.sin(angle)
    const z = Math.cos(angle)
    const r = CROWN_RADIUS - POINT_RADIUS * 0.35
    const out = Math.sin(LEAN) * (POINT_HEIGHT / 2)
    points.push({ key: `p${i}`, position: [x * (r + out), BAND_HEIGHT + POINT_HEIGHT / 2 - 0.04, z * (r + out)], rotation: [LEAN * z, 0, -LEAN * x] })
    const tip = Math.sin(LEAN) * POINT_HEIGHT
    pearls.push({ key: `o${i}`, position: [x * (r + tip), BAND_HEIGHT + POINT_HEIGHT - 0.06, z * (r + tip)], rotation: [0, 0, 0] })
    gems.push({ key: `g${i}`, position: [x * (CROWN_RADIUS + 0.005), BAND_HEIGHT / 2, z * (CROWN_RADIUS + 0.005)], rotation: [0, angle, 0] })
  }
  return { points, pearls, gems }
}

const noRaycast = () => null

/** The gold and the band, one of each for every crown of the page: they are small, and the gold's beat is the same for all, as it follows the clock */
const GOLD_MATERIAL = new MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: GLOW, metalness: 0.15, roughness: 0.4, side: DoubleSide })
const BAND = new CylinderGeometry(CROWN_RADIUS, CROWN_RADIUS * 0.94, BAND_HEIGHT, 40, 1, true)

/**
 * Crown of the player whose turn it is: a small model in 3D, gold with a pearl on each point and gems on its band, built from the primitives of three (no file to load), that turns slowly over their avatar and bobs. It does not travel around the table.
 * `position`: the centre of the avatar. `reach`: how far from that centre, along the table, the near side of the crown stands, on the side away from the camera: with the avatar's radius, the crown stands just behind the edge of the avatar that the screen shows at its
 * top, so it is centred above the round of the avatar at every seat and for any turn of the camera. `size`: its height. `yaw`: how far the frame it stands in is turned about the vertical (the frame of a seat): the crown takes it back, so that the world is its frame.
 */
export function TurnCrown({ show, position, size = 0.9, reach = 0, yaw = 0 }: { show: boolean; position: [number, number, number]; size?: number; reach?: number; yaw?: number }) {
  const anchor = useRef<Group>(null)
  const ref = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const parts = useMemo(() => crownParts(), [])
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
      .multiplyScalar(reach + CROWN_RADIUS * 0.5 * g.scale.x)
      .add(CENTRE)
    a.worldToLocal(AWAY)
    g.position.set(AWAY.x, 0.06 + (show ? (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2)) * 0.06 : 0), AWAY.z)
    spin.current?.rotateY(dt * SPIN)
    GOLD_MATERIAL.emissiveIntensity = GLOW + GLOW_BEAT * Math.pow(0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.4), 6)
    g.visible = g.scale.x > 0.02
  })
  return (
    <group ref={anchor} position={position} rotation-y={-yaw}>
      <group ref={ref} scale={0.0001} visible={false}>
        <group ref={spin}>
          <mesh geometry={BAND} material={GOLD_MATERIAL} position={[0, BAND_HEIGHT / 2, 0]} raycast={noRaycast} />
          <mesh material={GOLD_MATERIAL} position={[0, 0.02, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
            <torusGeometry args={[CROWN_RADIUS * 0.95, 0.035, 8, 40]} />
          </mesh>
          <mesh material={GOLD_MATERIAL} position={[0, BAND_HEIGHT, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
            <torusGeometry args={[CROWN_RADIUS, 0.03, 8, 40]} />
          </mesh>
          {parts.points.map((p) => (
            <mesh key={p.key} material={GOLD_MATERIAL} position={p.position} rotation={p.rotation} raycast={noRaycast}>
              <coneGeometry args={[POINT_RADIUS, POINT_HEIGHT, 4]} />
            </mesh>
          ))}
          {parts.pearls.map((p) => (
            <mesh key={p.key} position={p.position} raycast={noRaycast}>
              <sphereGeometry args={[0.065, 16, 12]} />
              <meshStandardMaterial color="#fff6e0" emissive="#fff6e0" emissiveIntensity={0.35} roughness={0.25} />
            </mesh>
          ))}
          {parts.gems.map((p, i) => (
            <mesh key={p.key} position={p.position} rotation={p.rotation} raycast={noRaycast}>
              <octahedronGeometry args={[0.07, 0]} />
              <meshStandardMaterial color={GEMS[i % 2]} emissive={GEMS[i % 2]} emissiveIntensity={0.45} roughness={0.2} flatShading />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { type Group, type Mesh, MeshBasicMaterial, Quaternion, RingGeometry, Vector3 } from "three"
import { shadowTexture } from "../card/textures"
import { shadeLathe } from "../cup/geometry"
import { bagGeometry, clampFill, SLUMP } from "./geometry"
import { BAG_SETTINGS, BAG_SIZE } from "./settings"

export type BagProps = {
  /** Where the bag stands on the table and which way it faces (`yaw`, radians about the vertical axis, counterclockwise from above) */
  at: { x: number; z: number; yaw?: number }
  /** The width of the bag across its belly, in world units (default `BAG_SIZE`). Its height follows */
  size?: number
  /** How full the bag is, from 0 (empty) to 1 (full, the default): a bag that is nearly empty slumps, and swells as it fills. The game works it out from the tokens that are left */
  fill?: number
  /** The colour of the cloth: the dark of its mouth and the cord of its neck are darker */
  color?: string
  /** Names the last time a hand rummaged in the bag, a number or a word the game changes at each draw: when it changes after the bag appeared, the bag rocks. Use something every player sees alike, such as the count of draws */
  shake?: number | string
  /** A ring on the table round the bag, in this colour, that pulses: the bag can be pressed. None when null */
  halo?: string | null
  /** Casts a drop shadow (default true) */
  shadow?: boolean
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
}

const UP = new Vector3(0, 1, 0)
// How long ago the last rocking was, when there has been none: long enough for it to be over
const NEVER = 1e6
const SHADOW_HEIGHT = 0.012
const RING_HEIGHT = 0.014
const SHADOW_PUSH = { x: 0.25, z: -0.35 }

/**
 * A bag, turned on a lathe, standing on the table with its neck tied and its mouth open: the pieces a game draws from it come out of its mouth (`bagMouth`). It slumps as it empties, rocks when a hand rummages in it, and can be pressed. It is only
 * the bag: what is in it is the game's, a count for each kind of token that the engine keeps (`drawFromBag`), and which token comes out is the engine's too, so a client never knows what is in it. The bag carries its own light, so it needs none from the
 * table. A visitor who asks for less motion sees it in its new shape at once, and it does not rock.
 */
export function Bag({ at, size = BAG_SIZE, fill = 1, color = "#9a7448", shake, halo = null, shadow = true, onClick, onHover }: BagProps) {
  const reduced = usePrefersReducedMotion()
  const yaw = at.yaw ?? 0
  const bag = useRef<Group>(null)
  const shadowMesh = useRef<Mesh>(null)
  const ring = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && !!onClick)
  const [shadowTex] = useState(shadowTexture)

  const geometry = useMemo(() => bagGeometry(size), [size])
  useEffect(() => () => geometry.dispose(), [geometry])
  const material = useMemo(() => new MeshBasicMaterial({ color, vertexColors: true, toneMapped: false }), [color])
  useEffect(() => () => material.dispose(), [material])
  // The bag is lit for the way it faces: it is round, so it only changes with the yaw of its place
  useLayoutEffect(() => {
    shadeLathe(geometry, new Quaternion().setFromAxisAngle(UP, yaw))
  }, [geometry, yaw])
  // The ring is only made for a bag that has one
  const ringed = !!halo
  const circle = useMemo(() => (ringed ? new RingGeometry(size * 0.56, size * 0.68, 48) : null), [ringed, size])
  useEffect(() => () => circle?.dispose(), [circle])

  // What a frame animates: how full the bag looks, and the rocking of the last shake
  const run = useRef({ fill: clampFill(fill), key: shake, t: NEVER })
  // What a frame reads: the newest props, not the ones of the render that made the frame's closure
  const latest = useRef({ fill, shake, size, reduced, at: { x: at.x, z: at.z }, shadow, halo })
  useEffect(() => {
    latest.current = { fill, shake, size, reduced, at: { x: at.x, z: at.z }, shadow, halo }
  })

  useFrame(({ clock }, dt) => {
    const g = bag.current
    if (!g) return
    const r = run.current
    const now = latest.current
    const S = BAG_SETTINGS
    if (now.reduced) r.fill = clampFill(now.fill)
    else easing.damp(r, "fill", clampFill(now.fill), S.slump, dt)
    if (now.shake !== r.key) {
      r.key = now.shake
      r.t = 0
    }
    r.t = Math.min(NEVER, r.t + dt)
    // The rocking dies away: a few swings in the time it is given
    const decay = !now.reduced && r.t < S.wiggleSeconds * 2 ? Math.exp((-r.t * 3) / Math.max(0.05, S.wiggleSeconds)) : 0
    // Nothing swings while there is nothing to swing: a sine of a time that is long past is no number to multiply by nothing
    const [swing, rock] = decay > 0 ? [Math.sin(r.t * 22), Math.sin(r.t * 22 + 1.1)] : [0, 0]
    const squash = SLUMP + (1 - SLUMP) * r.fill
    g.scale.set(1 + 0.1 * (1 - r.fill) - 0.04 * decay * swing, squash * (1 - 0.06 * decay * (0.5 + 0.5 * swing)), 1 + 0.1 * (1 - r.fill) + 0.04 * decay * swing)
    g.rotation.set(S.wiggle * 0.6 * decay * rock, 0, S.wiggle * decay * swing)

    const [wx, wz] = [now.at.x, now.at.z]
    const s = shadowMesh.current
    if (s) {
      s.visible = now.shadow
      s.position.set(wx + SHADOW_PUSH.x * squash * now.size, SHADOW_HEIGHT, wz + SHADOW_PUSH.z * squash * now.size)
      s.scale.setScalar(now.size * 2.1)
      ;(s.material as MeshBasicMaterial).opacity = S.shadow
    }
    const ringMesh = ring.current
    if (ringMesh) {
      ringMesh.visible = !!now.halo
      ringMesh.position.set(wx, RING_HEIGHT, wz)
      ;(ringMesh.material as MeshBasicMaterial).opacity = 0.55 + 0.3 * Math.sin(clock.elapsedTime * 3.2)
    }
  })

  return (
    <>
      <mesh ref={shadowMesh} rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {circle && (
        <mesh ref={ring} geometry={circle} rotation-x={-Math.PI / 2} raycast={() => null}>
          <meshBasicMaterial color={halo ?? "#ffffff"} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <group position={[at.x, 0, at.z]} rotation-y={yaw}>
        <group
          ref={bag}
          onClick={onClick}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            onHover?.(true)
          }}
          onPointerOut={() => {
            setHovered(false)
            onHover?.(false)
          }}
        >
          <mesh geometry={geometry} material={material} />
        </group>
      </group>
    </>
  )
}

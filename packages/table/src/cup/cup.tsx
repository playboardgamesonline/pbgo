"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { type Group, type Mesh, MeshBasicMaterial, Quaternion, RingGeometry, Vector3 } from "three"
import { shadowTexture } from "../card/textures"
import { cupGeometry, shadeLathe } from "./geometry"
import { cupClearance, type CupPose, cupTarget, rattle } from "./poses"
import { CUP_SETTINGS, CUP_SIZE, CUP_SPEED } from "./settings"

export type CupProps = {
  /** Where the cup stands on the table and which way it faces (`yaw`, radians about the vertical axis, counterclockwise from above): the front of its place, toward its owner, is +z of the frame the poses are made in */
  at: { x: number; z: number; yaw?: number }
  /** What the cup is doing (default `covering`): standing over what it hides, tilted to be looked under, lifted away, shaken, mouth up on the table, or tipped over to pour. When it changes the cup goes to the new pose, turning and rising as it must */
  pose?: CupPose
  /** The width of the cup across its mouth, in world units (default `CUP_SIZE`). Its height follows */
  size?: number
  /** The colour of its outside: its hollow is darker */
  color?: string
  /** A ring on the table round the cup, in this colour, that pulses: the cup can be pressed. None when null */
  halo?: string | null
  /** Casts a drop shadow (default true) */
  shadow?: boolean
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
  /** Called once the cup has reached the pose it was sent to, with it: the slam onto the table, the moment to pour dice out. Not called for the pose the cup appeared in */
  onReach?: (pose: CupPose) => void
}

const UP = new Vector3(0, 1, 0)
const SHADOW_HEIGHT = 0.012
const RING_HEIGHT = 0.014
const SHADOW_PUSH = { x: 0.25, z: -0.35 }
const turned = new Quaternion()

/**
 * A cup, turned on a lathe and hollow, that stands on the table over what it hides, tilts to be looked under, lifts away to show what was under it, is shaken with the dice in it and tips over to pour them out. The game says what it is doing (`pose`)
 * and the cup gets there as a cup does: it rises and flips as it is lifted, rattles while it is shaken, comes down in a slam, and never goes through the table on the way. It is only a cover: what is under it is the game's (`Die`s, pieces), and what a
 * player may not see is kept out of their view by the engine, not by the cup. The cup carries its own light, so it needs none from the table. A visitor who asks for less motion sees it in its new pose at once.
 */
export function Cup({ at, pose = "covering", size = CUP_SIZE, color = "#8a5a34", halo = null, shadow = true, onClick, onHover, onReach }: CupProps) {
  const reduced = usePrefersReducedMotion()
  const yaw = at.yaw ?? 0
  const cup = useRef<Group>(null)
  const shadowMesh = useRef<Mesh>(null)
  const ring = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && !!onClick)
  const [shadowTex] = useState(shadowTexture)

  const geometry = useMemo(() => cupGeometry(size), [size])
  useEffect(() => () => geometry.dispose(), [geometry])
  const material = useMemo(() => new MeshBasicMaterial({ color, vertexColors: true, toneMapped: false }), [color])
  useEffect(() => () => material.dispose(), [material])
  // The ring is only made for a cup that has one
  const ringed = !!halo
  const circle = useMemo(() => (ringed ? new RingGeometry(size * 0.62, size * 0.74, 48) : null), [ringed, size])
  useEffect(() => () => circle?.dispose(), [circle])

  // What a frame animates: where the mouth is and how the cup is turned, how much it rattles, and whether it has got where it was sent
  const run = useRef({ ...cupTarget(pose, size), rattle: pose === "shaking" ? 1 : 0, goal: pose, arrived: true, shaded: new Quaternion(2, 2, 2, 2) })
  // What a frame reads: the newest props, not the ones of the render that made the frame's closure
  const latest = useRef({ pose, size, reduced, yaw, at: { x: at.x, z: at.z }, shadow, halo, onReach })
  useEffect(() => {
    latest.current = { pose, size, reduced, yaw, at: { x: at.x, z: at.z }, shadow, halo, onReach }
  })

  // A cup of another size is lit again
  useLayoutEffect(() => {
    run.current.shaded.set(2, 2, 2, 2)
  }, [geometry])
  // The first frame: the cup is in its pose
  useLayoutEffect(() => {
    const g = cup.current
    if (!g) return
    const start = run.current
    g.position.set(start.x, Math.max(start.y, cupClearance(start.rx, start.rz, size)), start.z)
    g.rotation.set(start.rx, 0, start.rz)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(({ clock }, dt) => {
    const g = cup.current
    if (!g) return
    const r = run.current
    const now = latest.current
    const S = CUP_SETTINGS
    const target = cupTarget(now.pose, now.size)
    if (r.goal !== now.pose) {
      r.goal = now.pose
      r.arrived = false
    }
    if (now.reduced) {
      Object.assign(r, target, { rattle: 0 })
    } else {
      const time = S[CUP_SPEED[now.pose]]
      easing.damp(r, "x", target.x, time, dt)
      easing.damp(r, "y", target.y, time, dt)
      easing.damp(r, "z", target.z, time, dt)
      easing.damp(r, "rx", target.rx, time, dt)
      easing.damp(r, "rz", target.rz, time, dt)
      easing.damp(r, "rattle", now.pose === "shaking" ? 1 : 0, 0.15, dt)
    }

    // A cup that is shaken rattles about where it is held
    const wobble = r.rattle > 0.001 ? rattle(clock.elapsedTime, now.size, S.rattle, S.rattleHz) : null
    const [x, z] = [r.x + (wobble ? wobble.x * r.rattle : 0), r.z + (wobble ? wobble.z * r.rattle : 0)]
    const rz = r.rz + (wobble ? wobble.rz * r.rattle : 0)
    // It never sinks into the table: it is lifted as far as its turn asks
    const floor = cupClearance(r.rx, rz, now.size)
    const y = Math.max(r.y + (wobble ? wobble.y * r.rattle : 0), floor)
    g.position.set(x, y, z)
    g.rotation.set(r.rx, 0, rz)

    // The cup is lit as it turns, in the world's frame, the way it lies with its place's yaw
    turned.setFromAxisAngle(UP, now.yaw).multiply(g.quaternion)
    if (!r.shaded.equals(turned)) {
      r.shaded.copy(turned)
      shadeLathe(geometry, turned)
    }

    // Where the middle of its mouth is on the table
    const [sin, cos] = [Math.sin(now.yaw), Math.cos(now.yaw)]
    const [wx, wz] = [now.at.x + x * cos + z * sin, now.at.z - x * sin + z * cos]
    const s = shadowMesh.current
    if (s) {
      const rise = Math.max(0, y - floor)
      s.visible = now.shadow
      s.position.set(wx + SHADOW_PUSH.x * (rise + 0.3) * now.size, SHADOW_HEIGHT, wz + SHADOW_PUSH.z * (rise + 0.3) * now.size)
      s.scale.setScalar(now.size * (1.9 + 0.35 * rise))
      ;(s.material as MeshBasicMaterial).opacity = S.shadow / (1 + rise * 0.5)
    }
    const ringMesh = ring.current
    if (ringMesh) {
      ringMesh.visible = !!now.halo
      ringMesh.position.set(wx, RING_HEIGHT, wz)
      ;(ringMesh.material as MeshBasicMaterial).opacity = 0.55 + 0.3 * Math.sin(clock.elapsedTime * 3.2)
    }

    // Once it has got where it was sent, whoever sent it is told, once
    if (!r.arrived) {
      const near = 0.02 * now.size
      if (Math.abs(r.x - target.x) < near && Math.abs(r.y - target.y) < near && Math.abs(r.z - target.z) < near && Math.abs(r.rx - target.rx) < 0.03 && Math.abs(r.rz - target.rz) < 0.03) {
        r.arrived = true
        now.onReach?.(now.pose)
      }
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
          ref={cup}
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

"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { Color, DoubleSide, type Group, type Mesh, MeshBasicMaterial } from "three"
import { shadowTexture } from "../card/textures"
import { Counter } from "../counter/counter"
import { coneGeometry, FRAME, funnelGeometry, glassGeometry, plateGeometry, POSTS, relight, ringGeometry, rodGeometry } from "./geometry"
import { dangerAt, FLOOR, shareLeft, NECK, sandAt, secondsLeft } from "./sand"
import { TIMER_SETTINGS, TIMER_SIZE } from "./settings"

export type TimerProps = {
  /** When the time runs out, on the page's own clock (`performance.now()`), in milliseconds: the `deadlineAt` that the platform gives a board. Null when no clock runs: the hourglass then shows `rest` of its time and waits */
  endsAt: number | null
  /** How long the step lasts, in seconds: the whole of the hourglass, so that its sand says how much of the time is left. A game takes it from its view */
  seconds: number
  /** Where the hourglass stands on the table and the way it faces (`yaw`, radians about the vertical axis, counterclockwise from above) */
  at: { x: number; z: number; yaw?: number }
  /** How tall it is, in world units (default `TIMER_SIZE`) */
  size?: number
  /** What is left of the time when no clock runs, from 0 to 1 (default 1: all of it) */
  rest?: number
  /** The colour of the sand, of the glass and of the wooden frame */
  sand?: string
  glass?: string
  wood?: string
  /** Writes the seconds that are left in front of the hourglass (default true) */
  digits?: boolean
  /** Called once when the time runs out: a gong, a sound. The game does nothing else with it: the platform asks the server to play the deadline */
  onEnd?: () => void
  /** Called each time a second goes by while the clock runs, with the seconds that are left: a tick of sound */
  onSecond?: (left: number) => void
  /** Casts a drop shadow (default true) */
  shadow?: boolean
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
}

const SAND = "#e0b25a"
const GLASS = "#cfe7f3"
const WOOD = "#8c5a32"
const WARNING = "#ff5a3c"
const STREAM = 0.012
const SHADOW_HEIGHT = 0.012
const SHADOW_PUSH = { x: 0.25, z: -0.3 }
/** How far in front of the hourglass its digits lie, in its heights, and how high they are */
const DIGITS = { in: 0.62, height: 0.34 }
/** A clock that ends this much later than the one before is a new step. The platform counts a clock again from every read of the table, which moves it by the time a read took: that is never a step */
const NEW_STEP_MS = 1000
/** How long the sand takes to settle into a glass that was turned over, in seconds */
const SETTLE = 0.35
/** The share of the turn the sand goes in: it has run out of the glass by then, and the new sand comes into it after the turn */
const SAND_GOES = 0.5
const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * An hourglass on the table that shows the time left to a step: its sand runs from the top bulb to the bottom one as the time goes, a thin stream of it falling between, and it turns over when a new step starts its clock. In the last seconds the sand
 * goes toward red and the hourglass trembles. It is only a clock to look at: the time is the platform's (`PublicGame.deadlineInMs`, counted by the board as `deadlineAt`), the length of the step is the game's, and what happens when the time is out is
 * the engine's, played by the server. It carries its own light, so it needs none from the table. A visitor who asks for less motion sees the hourglass keep its place and the sand move, and no turning over and no trembling.
 */
export function Timer({ endsAt, seconds, at, size = TIMER_SIZE, rest = 1, sand = SAND, glass = GLASS, wood = WOOD, digits = true, onEnd, onSecond, shadow = true, onClick, onHover }: TimerProps) {
  const reduced = usePrefersReducedMotion()
  const yaw = at.yaw ?? 0
  const turn = useRef<Group>(null)
  const topSand = useRef<Mesh>(null)
  const bottomSand = useRef<Mesh>(null)
  const stream = useRef<Mesh>(null)
  const shadowMesh = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && !!onClick)
  const [shadowTex] = useState(shadowTexture)
  // The seconds that are written in front of it
  const [written, setWritten] = useState(() => Math.ceil(rest * seconds))

  const glassShape = useMemo(() => glassGeometry(), [])
  const heap = useMemo(() => coneGeometry(), [])
  const funnel = useMemo(() => funnelGeometry(), [])
  const rod = useMemo(() => rodGeometry(STREAM), [])
  const post = useMemo(() => rodGeometry(FRAME.post), [])
  const plate = useMemo(() => plateGeometry(FRAME.plate, FRAME.thickness), [])
  const ring = useMemo(() => ringGeometry(FRAME.plate, FRAME.hole, FRAME.thickness), [])
  // What carries its light with it, and so is lit again while the glass turns
  const solids = useMemo(() => [heap, funnel, rod, post, plate, ring], [heap, funnel, rod, post, plate, ring])
  useEffect(() => () => [glassShape, ...solids].forEach((geometry) => geometry.dispose()), [glassShape, solids])
  const glassMaterial = useMemo(() => new MeshBasicMaterial({ color: glass, transparent: true, opacity: 0.26, side: DoubleSide, depthWrite: false, toneMapped: false }), [glass])
  const woodMaterial = useMemo(() => new MeshBasicMaterial({ color: wood, vertexColors: true, toneMapped: false }), [wood])
  const sandMaterial = useMemo(() => new MeshBasicMaterial({ color: sand, vertexColors: true, toneMapped: false }), [sand])
  useEffect(() => () => [glassMaterial, woodMaterial, sandMaterial].forEach((material) => material.dispose()), [glassMaterial, woodMaterial, sandMaterial])
  const colors = useMemo(() => ({ sand: new Color(sand), warning: new Color(WARNING) }), [sand])

  // What a frame animates: the clock it last saw (a later one is a new step, and the hourglass turns over), how far the turn is and how far the sand is into settling after it, what was left when the turn began, the angle the solids are lit for,
  // the second written and told, and whether the end was told
  const run = useRef({ ends: endsAt, flip: null as number | null, settle: 1, held: 1, fraction: null as number | null, lit: 0, second: -1, ended: false })
  // What a frame reads: the newest props, not the ones of the render that made the frame's closure
  const latest = useRef({ endsAt, seconds, rest, reduced, size, at: { x: at.x, z: at.z }, shadow, onEnd, onSecond })
  useEffect(() => {
    latest.current = { endsAt, seconds, rest, reduced, size, at: { x: at.x, z: at.z }, shadow, onEnd, onSecond }
  })

  useFrame(({ clock }, dt) => {
    const now = latest.current
    const r = run.current
    const S = TIMER_SETTINGS
    // A clock that ends later than the one before is a new step: the hourglass turns over (a clock that begins is one too)
    if (now.endsAt !== r.ends) {
      if (now.endsAt !== null && (r.ends === null || now.endsAt > r.ends + NEW_STEP_MS) && !now.reduced && r.fraction !== null) {
        r.flip = 0
        r.held = r.fraction
      }
      r.ends = now.endsAt
      r.ended = false
    }
    let fraction = shareLeft(now.endsAt, performance.now(), now.seconds, now.rest)
    let angle = 0
    let hop = 0
    let grain = 1
    if (r.flip !== null) {
      // The sand turns with the glass for the first part of the turn and has run out of it by half way; then the new run settles into it
      r.flip = Math.min(1, r.flip + dt / Math.max(0.05, S.flip))
      fraction = r.held
      angle = Math.PI * smooth(r.flip)
      hop = Math.sin(Math.PI * r.flip)
      grain = 1 - smooth(Math.min(1, r.flip / SAND_GOES))
      if (r.flip >= 1) {
        // Turned all the way, the glass looks as it did before it turned: it stands up again with no sand in it, and the new run settles in
        r.flip = null
        r.settle = 0
        angle = 0
      }
    } else if (r.settle < 1) {
      r.settle = Math.min(1, r.settle + dt / SETTLE)
      grain = smooth(r.settle)
    }
    const running = now.endsAt !== null && r.flip === null
    const danger = running ? dangerAt(fraction, now.seconds, S.warn) : 0

    if (angle !== r.lit) {
      solids.forEach((geometry) => relight(geometry, angle))
      r.lit = angle
    }
    const g = turn.current
    if (g) {
      // It trembles while there is time left to be afraid of, and stands still once the time is out
      g.rotation.set(0, 0, angle + (now.reduced || fraction === 0 ? 0 : danger * S.tremble * Math.sin(clock.elapsedTime * 38)))
      g.position.y = now.size * 0.5 + hop * S.hop * now.size
    }

    const sands = sandAt(fraction, running)
    const top = topSand.current
    if (top) {
      const height = sands.top.height * grain
      top.visible = height > 0.002
      top.scale.set(sands.top.radius * grain, height, sands.top.radius * grain)
      top.position.y = NECK + height / 2
    }
    const bottom = bottomSand.current
    if (bottom) {
      const height = sands.bottom.height * grain
      bottom.visible = height > 0.002
      bottom.scale.set(sands.bottom.radius * grain, height, sands.bottom.radius * grain)
      bottom.position.y = FLOOR + height / 2
    }
    const fall = stream.current
    if (fall) {
      const length = NECK - (FLOOR + sands.bottom.height)
      fall.visible = sands.falling && grain === 1 && length > 0
      fall.scale.set(1, Math.max(0, length), 1)
      fall.position.y = FLOOR + sands.bottom.height + length / 2
    }
    sandMaterial.color.copy(colors.sand).lerp(colors.warning, danger)

    // The seconds written and told, and the end told once
    const whole = secondsLeft(fraction, now.seconds)
    if (whole !== r.second) {
      r.second = whole
      setWritten(whole)
      if (running) now.onSecond?.(whole)
    }
    if (running && fraction === 0 && !r.ended) {
      r.ended = true
      now.onEnd?.()
    }
    r.fraction = fraction

    const s = shadowMesh.current
    if (s) {
      s.visible = now.shadow
      s.position.set(now.at.x + SHADOW_PUSH.x * now.size * 0.5, SHADOW_HEIGHT, now.at.z + SHADOW_PUSH.z * now.size * 0.5)
      s.scale.setScalar(now.size * 0.95)
      ;(s.material as MeshBasicMaterial).opacity = S.shadow
    }
  })

  return (
    <>
      <mesh ref={shadowMesh} rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group position={[at.x, 0, at.z]} rotation-y={yaw}>
        <group
          ref={turn}
          position-y={size * 0.5}
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
          <group position-y={-size * 0.5} scale={size}>
            <mesh geometry={plate} material={woodMaterial} position-y={FRAME.bottom} />
            <mesh geometry={ring} material={woodMaterial} position-y={FRAME.top} />
            {POSTS.map(([x, z], i) => (
              <mesh key={i} geometry={post} material={woodMaterial} position={[x, (FRAME.bottom + FRAME.top) / 2, z]} scale={[1, FRAME.top - FRAME.bottom, 1]} />
            ))}
            <mesh ref={bottomSand} geometry={heap} material={sandMaterial} />
            <mesh ref={topSand} geometry={funnel} material={sandMaterial} />
            <mesh ref={stream} geometry={rod} material={sandMaterial} />
            <mesh geometry={glassShape} material={glassMaterial} renderOrder={2} />
          </group>
        </group>
      </group>
      {digits && <Counter value={written} at={{ x: at.x + Math.sin(yaw) * size * DIGITS.in, z: at.z + Math.cos(yaw) * size * DIGITS.in, yaw }} height={size * DIGITS.height} change={false} seconds={0.2} />}
    </>
  )
}

"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AdditiveBlending, type Color, type Group, type Mesh, type MeshBasicMaterial, NormalBlending, type Texture, Vector3 } from "three"
import type { Pose } from "../pose"
import { type Flight, startFlight, stepFlight } from "./flight"
import { applyFold, foldable } from "./fold"
import { type CardSize, cardGeometry, cornerRadius, edgeGeometry, frameGeometry } from "./geometry"
import type { Glow } from "./glows"
import { CARD_SETTINGS } from "./settings"
import { glossTexture, haloTexture, shadowTexture, sparkleTexture } from "./textures"

/** Where a dragged card was let go, on the table plane. Reserved with `draggable`: nothing reports it yet */
export type CardDrop = { position: Vector3 }

export type CardProps = {
  /** Where the card lies and how. When it changes the card glides there; when it jumps far, the card flies */
  target: Pose
  /** Where the card comes from: it flies from there to `target` when it appears. Without it, it appears at `target` */
  from?: Pose | null
  /** The picture on the front */
  front: Texture
  /** The picture on the back */
  back: Texture
  /** Width, height and corner radius, in world units. The same for every card of a game: cards of one size share their geometry */
  size: CardSize
  /** The glow around the card, one of the game's `defineGlows`. None when null */
  glow?: Glow | null
  /** The shine that follows the pointer over the front: `true` for the usual strength, a number (0 to 1) for a given one */
  gloss?: boolean | number
  /** Casts a drop shadow (default true) */
  shadow?: boolean
  /** Drawn over everything else, glows of other cards included */
  above?: boolean
  /** Seconds the card takes to settle on a new `target`, about: the smaller, the snappier (default 0.16) */
  speed?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
  /** Called when a flight ends */
  onArrive?: () => void
  /** Reserved: the player will drag the card with the pointer. Does nothing yet */
  draggable?: boolean
  /** Reserved: called with where a dragged card was let go. Never called yet */
  onDrop?: (drop: CardDrop) => void
  /**
   * What the game draws on the front (value, suit, name...), as three.js elements.
   * Their origin is the middle of the face, x to the right and y up, in the card's own units.
   * They move, flip and hover with the card, and ride above the face while it arches in flight.
   */
  children?: ReactNode
}

const targetTmp = new Vector3()
const scaleTmp = new Vector3()
const normalTmp = new Vector3()

// A target that moves farther than this in one go sends the card flying instead of gliding
const JUMP = 4

// How far each coplanar layer sits outside the card's surface (`thickness / 2` from its middle), on the side its name says.
// At least 0.001 apart: the depth buffer is only about 0.0004 precise at the usual camera distance, so closer layers would flicker into one another
const FRONT = { face: 0.001, overlay: 0.002, frame: 0.002, gloss: 0.003, sparkle: 0.004 }
const BACK = { face: 0.001, outline: 0.003, halo: 0.006, shadow: 0.012 }

// A glow's colours are read every frame so they can be tuned live; a colour is parsed only when it differs from the last one set
const tints = new WeakMap<Color, string>()
function tint(color: Color, value: string) {
  if (tints.get(color) === value) return
  tints.set(color, value)
  color.set(value)
}

// What bends a material along its height: the card's fold, half its height and the way it arches (the front and the rim towards the viewer, the back away)
const arch = (fold: { value: number }, height: number, dir: 1 | -1) => ({ uFold: fold, uHalfH: { value: height / 2 }, uDir: { value: dir } })

/**
 * A playing card: a plane with a front and a back, a thickness, and the same behaviour in every game.
 * It glides to its `target`, flies there along a curve when it comes `from` somewhere or jumps far, flips, hovers, glows and casts a shadow.
 * What differs from game to game is passed in: the pictures, the `size`, the `glow`s and what is drawn on the face (`children`).
 */
export function Card({
  target,
  from,
  front,
  back,
  size,
  glow,
  gloss,
  shadow = true,
  above = false,
  speed = 0.16,
  onClick,
  onHover,
  onArrive,
  children,
}: CardProps) {
  const { width, height } = size
  const radius = cornerRadius(size)
  const ref = useRef<Group>(null)
  const thickness = width * CARD_SETTINGS.thickness
  const stride = Math.min(width, height) / 5
  const geo = useMemo(() => foldable(cardGeometry(width, height, radius), stride), [width, height, radius, stride])
  const edge = useMemo(() => foldable(edgeGeometry(width, height, thickness, radius), stride), [width, height, thickness, radius, stride])
  const fold = useRef({ value: 0 })

  // The parts of the glow. A part the glow lacks is not built at all
  const { halo, outline, frame, sparkle }: Glow = glow ?? {}
  const fit = Math.max(target.scale, 0.3)
  const haloMargin = halo ? Math.min(width, height) * halo.spread : 0
  const haloTex = halo ? haloTexture(width, height, haloMargin, radius) : null
  const frameGeo = frame ? frameGeometry(width, height, 0.07 / fit, 0.03 / fit, radius) : null
  const outlineMargin = 0.05 / fit
  const outlineRadius = size.radius === undefined ? undefined : size.radius + outlineMargin / 2
  const outlineGeo = outline ? cardGeometry(width + outlineMargin, height + outlineMargin, outlineRadius) : null
  const hasSparkle = !!sparkle
  const sparkleTex = useMemo(() => (hasSparkle ? sparkleTexture() : null), [hasSparkle])
  useEffect(() => () => sparkleTex?.dispose(), [sparkleTex])
  const haloRef = useRef<MeshBasicMaterial>(null)
  const frameRef = useRef<Mesh>(null)
  const outlineRef = useRef<Mesh>(null)
  const sparkleRef = useRef<Mesh>(null)

  const [hovered, setHovered] = useState(false)
  const [glossTex] = useState(glossTexture)
  const [shadowTex] = useState(shadowTexture)
  const shadowRef = useRef<Mesh>(null)
  const glossRef = useRef<Mesh>(null)
  const overlayRef = useRef<Group>(null)
  const flight = useRef<Flight | null>(null)
  const lastOne = useRef(new Vector3())
  useCursor(hovered && !!onClick)

  const start = (g: Group, delay = 0) => {
    flight.current = startFlight(g, target, delay, CARD_SETTINGS)
  }

  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    const p = from ?? target
    g.position.copy(p.position)
    g.quaternion.copy(p.quaternion)
    g.scale.setScalar(p.scale)
    lastOne.current.copy(target.position)
    if (from) start(g, from.delay ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(({ pointer, clock }, dt) => {
    const S = CARD_SETTINGS
    const t = clock.elapsedTime
    if (halo && haloRef.current) {
      haloRef.current.opacity = halo.opacity + Math.sin(t * halo.speed) * halo.pulse
      tint(haloRef.current.color, halo.color)
    }
    if (outline && outlineRef.current) {
      outlineRef.current.visible = outline.visible
      tint((outlineRef.current.material as MeshBasicMaterial).color, outline.color)
    }
    if (shadowRef.current) (shadowRef.current.material as MeshBasicMaterial).opacity = S.shadow
    if (frame && frameRef.current) {
      frameRef.current.scale.setScalar(1 + Math.sin(t * frame.speed) * frame.breath)
      const m = frameRef.current.material as MeshBasicMaterial
      m.opacity = frame.opacity + Math.sin(t * frame.speed) * frame.pulse
      tint(m.color, frame.color)
    }
    if (sparkle && sparkleRef.current) {
      const m = sparkleRef.current.material as MeshBasicMaterial
      if (m.map) m.map.offset.x = ((t * sparkle.speed) % 1.6) - 0.8
      m.opacity = sparkle.opacity
    }
    const shine = gloss === true ? S.gloss : gloss || 0
    if (glossRef.current) {
      const m = glossRef.current.material as MeshBasicMaterial
      easing.damp(m, "opacity", shine, 0.3, dt)
      glossRef.current.visible = m.opacity > 0.01
      if (shine > 0) {
        easing.damp(glossTex.offset, "x", -pointer.x * S.glossMotion, 0.15, dt)
        easing.damp(glossTex.offset, "y", -pointer.y * S.glossMotion, 0.15, dt)
      }
    }
    const g = ref.current
    if (!g) return
    if (!flight.current && target.position.distanceTo(lastOne.current) > JUMP && g.position.distanceTo(target.position) > JUMP) start(g)
    lastOne.current.copy(target.position)

    if (flight.current) {
      if (stepFlight(flight.current, dt, g, target, S, fold.current)) {
        flight.current = null
        onArrive?.()
      }
    } else {
      fold.current.value *= Math.max(0, 1 - dt * 8)
      targetTmp.copy(target.position)
      easing.damp3(g.position, targetTmp, speed, dt)
      easing.dampQ(g.quaternion, target.quaternion, speed, dt)
      easing.damp3(g.scale, scaleTmp.setScalar(target.scale), speed, dt)
    }
    // The face arches by up to `fold * height / 2` towards the viewer: lift what is drawn on it by as much, or the arch would hide it
    if (overlayRef.current) overlayRef.current.position.z = thickness / 2 + FRONT.overlay + Math.max(0, fold.current.value) * (height / 2)
    if (shadowRef.current) {
      const top = normalTmp.set(0, 0, 1).applyQuaternion(g.quaternion).y >= 0
      shadowRef.current.position.z = top ? -thickness / 2 - BACK.shadow : thickness / 2 + BACK.shadow
    }
  })

  return (
    <group
      ref={ref}
      renderOrder={above ? 20 : 0}
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
      <mesh ref={shadowRef} position={[0.04, -0.07, -0.03]} raycast={() => null} visible={shadow}>
        <planeGeometry args={[width * 1.18, height * 1.1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={geo} position-z={thickness / 2 + FRONT.face}>
        <meshBasicMaterial ref={(m) => applyFold(m, arch(fold.current, height, 1))} map={front} transparent={above} toneMapped={false} />
      </mesh>
      {children && (
        <group ref={overlayRef} position-z={thickness / 2 + FRONT.overlay}>
          {children}
        </group>
      )}
      <mesh geometry={edge} position-z={-thickness / 2}>
        <meshBasicMaterial attach="material-0" visible={false} />
        <meshBasicMaterial attach="material-1" ref={(m) => applyFold(m, arch(fold.current, height, 1))} color="#d9cba6" transparent={above} toneMapped={false} />
      </mesh>
      <mesh ref={glossRef} geometry={geo} position-z={thickness / 2 + FRONT.gloss} raycast={() => null} visible={false}>
        <meshBasicMaterial map={glossTex} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={geo} rotation-y={Math.PI} position-z={-thickness / 2 - BACK.face}>
        <meshBasicMaterial ref={(m) => applyFold(m, arch(fold.current, height, -1))} map={back} transparent={above} toneMapped={false} />
      </mesh>
      {halo && haloTex && (
        <mesh position-z={-thickness / 2 - BACK.halo} raycast={() => null}>
          <planeGeometry args={[width + 2 * haloMargin, height + 2 * haloMargin]} />
          <meshBasicMaterial
            ref={haloRef}
            map={haloTex}
            color={halo.color}
            transparent
            depthWrite={false}
            blending={halo.blend === "add" ? AdditiveBlending : NormalBlending}
            toneMapped={false}
          />
        </mesh>
      )}
      {sparkle && sparkleTex && (
        <mesh ref={sparkleRef} geometry={geo} position-z={thickness / 2 + FRONT.sparkle} raycast={() => null}>
          <meshBasicMaterial map={sparkleTex} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {frame && frameGeo && (
        <mesh ref={frameRef} geometry={frameGeo} position-z={thickness / 2 + FRONT.frame} raycast={() => null}>
          <meshBasicMaterial color={frame.color} transparent toneMapped={false} />
        </mesh>
      )}
      {outline && outlineGeo && (
        <mesh ref={outlineRef} geometry={outlineGeo} position-z={-thickness / 2 - BACK.outline} raycast={() => null}>
          <meshBasicMaterial color={outline.color} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

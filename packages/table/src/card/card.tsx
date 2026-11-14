"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AdditiveBlending, type Color, type Group, type Mesh, type MeshBasicMaterial, NormalBlending, Quaternion, type Texture, Vector3 } from "three"
import { type CardReading, inspector } from "../debug/inspector"
import { DEBUG_VIEW } from "../debug/view"
import { dragGoal } from "../drag/reach"
import { DRAG_SETTINGS, followSeconds } from "../drag/settings"
import type { ZoneId } from "../drag/store"
import { type Drop, useDrag } from "../drag/use-drag"
import type { Pose } from "../pose"
import type { CardId } from "../table/memory"
import { usePoseMemory } from "../table/memory-context"
import { type Flight, startFlight, stepFlight } from "./flight"
import { applyFold, foldable } from "./fold"
import { type CardSize, cardGeometry, cornerRadius, edgeGeometry, frameGeometry } from "./geometry"
import { type Glow, glowNameOf } from "./glows"
import { CARD_SETTINGS } from "./settings"
import { glossTexture, haloTexture, shadowTexture, sparkleTexture } from "./textures"

/** Where a dragged card was let go: the zone it was let go on, or null for none, and where it lay on the table (`useDrag`) */
export type CardDrop = Drop

export type CardProps = {
  /** Names the card: the game's own id for it. When a card with this id leaves the table and one with the same id appears within a second, in another zone, the new one starts from where the old one was. A given `from` wins. Needs a `Table` around it */
  id?: CardId
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
  /** The card can no longer play (its player is out of the round): a grey filter over its picture and its edge, darker and with no colour. It lifts when `out` turns false */
  out?: boolean
  /** Seconds the card takes to settle on a new `target`, about: the smaller, the snappier (default 0.16) */
  speed?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
  /** Called when a flight ends */
  onArrive?: () => void
  /** The player can pick the card up with the pointer and let it go on the table (default false). A press that stays within a few pixels is still a click. While it is held the card follows the pointer, lifted, and goes back to its `target` when it is let go */
  draggable?: boolean
  /** The zones the card may be let go on, by the `id` of each `DropZone` (or the number of a cell of a `Board` that has `drops`). Those zones show themselves while the card is held. Default: any zone */
  dropOn?: readonly ZoneId[]
  /** The card is picked up */
  onDragStart?: () => void
  /** The card was let go, on a zone or on none: which, and where it lay. The card goes back to its `target`; the game changes the target in the same step when the drop does something */
  onDrop?: (drop: CardDrop) => void
  /** The drag was given up (Escape, the pointer left the page) and nothing was dropped */
  onDragCancel?: () => void
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
const arch = (fold: { value: number }, height: number, dir: 1 | -1, grey: number) => ({ uFold: fold, uHalfH: { value: height / 2 }, uDir: { value: dir }, uGrey: { value: grey } })

/**
 * A playing card: a plane with a front and a back, a thickness, and the same behaviour in every game.
 * It glides to its `target`, flies there along a curve when it comes `from` somewhere or jumps far, flips, hovers, glows and casts a shadow.
 * What differs from game to game is passed in: the pictures, the `size`, the `glow`s and what is drawn on the face (`children`).
 */
export function Card({
  id,
  target,
  from,
  front,
  back,
  size,
  glow,
  gloss,
  shadow = true,
  above = false,
  out = false,
  speed = 0.16,
  onClick,
  onHover,
  onArrive,
  draggable = false,
  dropOn,
  onDragStart,
  onDrop,
  onDragCancel,
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
  useCursor(hovered && (!!onClick || draggable), draggable ? "grab" : "pointer")
  const memory = usePoseMemory()
  // Where the card is drawn while it is held, so a frame allocates nothing
  const [goal] = useState<Pose>(() => ({ position: new Vector3(), quaternion: new Quaternion(), scale: 1 }))
  const drag = useDrag({
    enabled: draggable,
    level: target.position.y,
    position: () => ref.current?.position ?? null,
    dropOn,
    onClick,
    onDragStart: () => {
      // A card that was still flying is picked out of the air
      flight.current = null
      onDragStart?.()
    },
    onDrop,
    onDragCancel,
  })

  // The debug panel's inspector reads the card under the pointer: what it reads is the card as it is then, not as it was when the pointer came
  const [inspectKey] = useState(() => Symbol("card"))
  const latest = useRef({ id, target, glow })
  useEffect(() => {
    latest.current = { id, target, glow }
  })
  useEffect(() => () => inspector.leave(inspectKey), [inspectKey])
  const reading = (): CardReading => {
    const { id: named, target: to, glow: lit } = latest.current
    const g = ref.current
    const f = flight.current
    return {
      id: named === undefined ? "(no id)" : String(named),
      position: g ? [g.position.x, g.position.y, g.position.z] : [0, 0, 0],
      target: [to.position.x, to.position.y, to.position.z],
      scale: g ? g.scale.x : 1,
      targetScale: to.scale,
      flight: f ? { time: f.t, duration: f.duration } : null,
      glow: glowNameOf(lit),
    }
  }

  const start = (g: Group, delay = 0) => {
    flight.current = startFlight(g, target, delay, CARD_SETTINGS)
  }

  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    // The card that left the table under this id a moment ago. It is taken out of the memory even when `from` wins, so no old sighting is left to mislead a later card
    const left = memory && id !== undefined ? memory.recall(id, g, target) : null
    const p = from ?? left ?? target
    g.position.copy(p.position)
    g.quaternion.copy(p.quaternion)
    g.scale.setScalar(p.scale)
    lastOne.current.copy(target.position)
    if (from) start(g, from.delay ?? 0)
    // From a pose that is not given, the card flies when it is far from its target and glides when it is near, like a target that moves
    else if (left && g.position.distanceTo(target.position) > JUMP) start(g)
    // On its way out the card writes down where it was, for the card with the same id that appears next
    return () => {
      if (memory && id !== undefined) memory.remember(id, g)
    }
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
    // While the card is held it goes where the pointer has it, lifted; the rest of the time it goes to the place the game gives it
    const held = drag.held.current
    const aim = held ? dragGoal(goal, target, held.x, held.z, DRAG_SETTINGS.lift, DRAG_SETTINGS.grow) : target
    if (!held && !flight.current && target.position.distanceTo(lastOne.current) > JUMP && g.position.distanceTo(target.position) > JUMP) start(g)
    lastOne.current.copy(aim.position)

    if (flight.current) {
      if (stepFlight(flight.current, dt, g, target, S, fold.current)) {
        flight.current = null
        onArrive?.()
      }
    } else {
      fold.current.value *= Math.max(0, 1 - dt * 8)
      const smooth = held ? followSeconds(drag.reduced) : speed
      targetTmp.copy(aim.position)
      easing.damp3(g.position, targetTmp, smooth, dt)
      easing.dampQ(g.quaternion, aim.quaternion, smooth, dt)
      easing.damp3(g.scale, scaleTmp.setScalar(aim.scale), smooth, dt)
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
      onPointerDown={drag.bind.onPointerDown}
      onClick={drag.bind.onClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover?.(true)
        if (DEBUG_VIEW.inspector) inspector.enter(inspectKey, reading)
      }}
      onPointerOut={() => {
        setHovered(false)
        onHover?.(false)
        inspector.leave(inspectKey)
      }}
    >
      <mesh ref={shadowRef} position={[0.04, -0.07, -0.03]} raycast={() => null} visible={shadow}>
        <planeGeometry args={[width * 1.18, height * 1.1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={geo} position-z={thickness / 2 + FRONT.face}>
        <meshBasicMaterial ref={(m) => applyFold(m, arch(fold.current, height, 1, out ? 1 : 0))} map={front} transparent={above} toneMapped={false} />
      </mesh>
      {children && (
        <group ref={overlayRef} position-z={thickness / 2 + FRONT.overlay}>
          {children}
        </group>
      )}
      <mesh geometry={edge} position-z={-thickness / 2}>
        <meshBasicMaterial attach="material-0" visible={false} />
        <meshBasicMaterial attach="material-1" ref={(m) => applyFold(m, arch(fold.current, height, 1, out ? 1 : 0))} color="#d9cba6" transparent={above} toneMapped={false} />
      </mesh>
      <mesh ref={glossRef} geometry={geo} position-z={thickness / 2 + FRONT.gloss} raycast={() => null} visible={false}>
        <meshBasicMaterial map={glossTex} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={geo} rotation-y={Math.PI} position-z={-thickness / 2 - BACK.face}>
        <meshBasicMaterial ref={(m) => applyFold(m, arch(fold.current, height, -1, out ? 1 : 0))} map={back} transparent={above} toneMapped={false} />
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

"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { type BufferAttribute, type Group, type Mesh, type MeshBasicMaterial as BasicMaterial, MeshBasicMaterial, Quaternion, RingGeometry, type Texture, Vector3 } from "three"
import { type Flight, startFlight, stepFlight } from "../card/flight"
import { CARD_SETTINGS } from "../card/settings"
import { shadowTexture } from "../card/textures"
import { shadeVertices } from "../die/shade"
import { dragGoal } from "../drag/reach"
import { DRAG_SETTINGS, followSeconds } from "../drag/settings"
import type { ZoneId } from "../drag/store"
import { type Drop, useDrag } from "../drag/use-drag"
import type { Pose } from "../pose"
import type { CardId } from "../table/memory"
import { usePoseMemory } from "../table/memory-context"
import { type PieceModel, pieceModel, type PieceShape } from "./models"
import { PIECE_SETTINGS, PIECE_SIZE } from "./settings"

export type PieceProps = {
  /** Names the piece: the game's own id for it. When a piece with this id leaves the table and one with the same id appears within a second, in another place, the new one starts from where the old one was. A given `from` wins. Needs a `Table` around it */
  id?: CardId
  /** The shape: `disc` by default, another piece of the package, or a `PieceModel` of the game's own (a silhouette made with `makeFlatPiece`, a solid with `makePiece`) */
  model?: PieceShape | PieceModel
  /** Where the piece stands on the table and which way it faces (`yaw`, radians about the vertical axis, counterclockwise from above). When it changes the piece glides there; when it jumps far, it flies */
  at: { x: number; z: number; yaw?: number }
  /** How high the base of the piece is above the table: the height of what it stands on, so a piece on another is `y = height of the one below` (default 0, on the table) */
  y?: number
  /** The width of the piece in world units, the diameter of a disc (default `PIECE_SIZE`). Its height follows its model */
  size?: number
  /** The colour of the piece: its edge, and the faces that wear no picture */
  color?: string
  /** The picture of the top and of the bottom of a flat piece (a coin, a tile, a token): textures in sRGB, painted by the game or made from its pictures */
  faces?: { top?: Texture; bottom?: Texture }
  /** Which flat face is up: `top` by default. When it changes the piece hops and turns over */
  face?: "top" | "bottom"
  /** Raised above its place by this much: a piece the player holds, or has picked */
  lift?: number
  /** A ring on the table round the piece, in this colour, that pulses: the piece can be chosen. None when null */
  halo?: string | null
  /** Casts a drop shadow (default true) */
  shadow?: boolean
  /** How solid the piece is, from 0 to 1 (default 1): a piece that shows where another would go. One that is not solid casts no shadow */
  opacity?: number
  /** Where the piece comes from when it appears: it flies from there to its place. Without it, and when no piece of the same `id` just left, it appears at its place */
  from?: { x: number; z: number; y?: number } | null
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
  /** Called when a flight ends */
  onArrive?: () => void
  /** The player can pick the piece up with the pointer and let it go on the table (default false). A press that stays within a few pixels is still a click. While it is held the piece follows the pointer, lifted, and goes back to its `at` when it is let go */
  draggable?: boolean
  /** The zones the piece may be let go on: the `id` of each `DropZone`, or the number of a cell of a `Board` that has `drops`. Those zones show themselves while the piece is held. Default: any zone */
  dropOn?: readonly ZoneId[]
  /** The piece is picked up */
  onDragStart?: () => void
  /** The piece was let go, on a zone or on none: which, and where it lay. The piece goes back to its `at`; the game changes it in the same step when the drop does something */
  onDrop?: (drop: Drop) => void
  /** The drag was given up (Escape, the pointer left the page) and nothing was dropped */
  onDragCancel?: () => void
  /** What the game draws on the top of the piece (a number, an icon), as three.js elements. Their origin is the middle of the top, x to the right and y away from the viewer when the piece lies top up. They turn over with the piece */
  children?: ReactNode
}

const UP = new Vector3(0, 1, 0)
const OVER = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
// A target that moves farther than this in one go sends the piece flying instead of gliding
const JUMP = 2.5
const SHADOW_HEIGHT = 0.012
const RING_HEIGHT = 0.014
const SHADOW_PUSH = { x: 0.2, z: -0.3 }
const tmp = new Vector3()

/**
 * A piece on the table: a token, a tile, a cube, a pawn, a silhouette. It stands where `at` says, glides when `at` changes, flies along a curve when it jumps far (the way a card does), hops and turns over when `face` changes, and may be raised,
 * ringed to say it can be chosen, and pressed. What differs from game to game is passed in: its shape, its colour, the pictures of its faces, its size and what is drawn on it (`children`). The piece carries its own light, so it needs none from the table.
 */
export function Piece({
  id,
  model: shape = "disc",
  at,
  y = 0,
  size = PIECE_SIZE,
  color = "#c9b79c",
  faces,
  face = "top",
  lift = 0,
  halo = null,
  shadow = true,
  opacity = 1,
  from,
  onClick,
  onHover,
  onArrive,
  draggable = false,
  dropOn,
  onDragStart,
  onDrop,
  onDragCancel,
  children,
}: PieceProps) {
  const model = useMemo(() => (typeof shape === "string" ? pieceModel(shape) : shape), [shape])
  const memory = usePoseMemory()
  const yaw = at.yaw ?? 0
  const height = model.height * size
  const group = useRef<Group>(null)
  const shadowMesh = useRef<Mesh>(null)
  const ring = useRef<Mesh>(null)
  const flight = useRef<Flight | null>(null)
  const fold = useRef({ value: 0 })
  const hop = useRef<{ t: number } | null>(null)
  const last = useRef(new Vector3())
  const shaded = useRef(new Quaternion(2, 2, 2, 2))
  const faceNow = useRef(face)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && (!!onClick || draggable), draggable ? "grab" : "pointer")
  const [shadowTex] = useState(shadowTexture)
  // Where the piece is drawn while it is held, so a frame allocates nothing
  const [goal] = useState<Pose>(() => ({ position: new Vector3(), quaternion: new Quaternion(), scale: 1 }))

  // Where the piece goes: its place, turned by its yaw and, with its bottom up, over (which takes its base to the top, so it is raised by its height to still stand on the table)
  const target = useMemo<Pose>(() => {
    const quaternion = new Quaternion().setFromAxisAngle(UP, yaw)
    const over = face === "bottom"
    if (over) quaternion.multiply(OVER)
    return { position: new Vector3(at.x, y + lift + (over ? height : 0), at.z), quaternion, scale: 1 }
  }, [at.x, at.z, yaw, y, lift, face, height])

  const drag = useDrag({
    enabled: draggable,
    level: target.position.y,
    position: () => group.current?.position ?? null,
    dropOn,
    onClick,
    onDragStart: () => {
      // A piece that was still flying is picked out of the air
      flight.current = null
      onDragStart?.()
    },
    onDrop,
    onDragCancel,
  })

  // What a frame reads: the newest props, not the ones of the render that made the frame's closure
  const solid = opacity >= 1
  const latest = useRef({ target, size, y, halo, shadow: shadow && solid, onArrive, model })
  useEffect(() => {
    latest.current = { target, size, y, halo, shadow: shadow && solid, onArrive, model }
  })

  const geometry = useMemo(() => model.geometry(size), [model, size])
  useEffect(() => () => geometry.dispose(), [geometry])
  const materials = useMemo(() => {
    // A piece that is not solid is see-through and writes no depth, so what lies under it shows
    const seen = { transparent: !solid, opacity: Math.min(1, Math.max(0, opacity)), depthWrite: solid }
    const edge = new MeshBasicMaterial({ color, vertexColors: true, toneMapped: false, ...seen })
    if (!model.flat) return [edge]
    const wear = (map?: Texture) => new MeshBasicMaterial({ ...(map ? { map } : { color }), vertexColors: true, toneMapped: false, ...seen })
    return [edge, wear(faces?.top), wear(faces?.bottom)]
  }, [model, color, faces?.top, faces?.bottom, solid, opacity])
  useEffect(() => () => materials.forEach((material: BasicMaterial) => material.dispose()), [materials])
  // The ring is only made for a piece that has one
  const ringed = !!halo
  const circle = useMemo(() => (ringed ? new RingGeometry(model.reach * size * 1.12, model.reach * size * 1.3, 48) : null), [ringed, model, size])
  useEffect(() => () => circle?.dispose(), [circle])

  // The piece is lit as it turns: its vertices take a grey from the way each one faces, whenever it has turned
  const light = (q: Quaternion) => {
    if (shaded.current.equals(q)) return
    shaded.current.copy(q)
    const colors = geometry.getAttribute("color") as BufferAttribute
    shadeVertices(geometry.getAttribute("normal").array, q, colors.array as Float32Array)
    colors.needsUpdate = true
  }

  // The first frame: where the piece that left under this id was, or where it comes from, or its place
  useLayoutEffect(() => {
    const g = group.current
    if (!g) return
    const left = memory && id !== undefined ? memory.recall(id, g, target) : null
    const begin: Pose = from ? { position: new Vector3(from.x, from.y ?? y, from.z), quaternion: target.quaternion, scale: 1 } : (left ?? target)
    g.position.copy(begin.position)
    g.quaternion.copy(begin.quaternion)
    g.scale.setScalar(begin.scale)
    last.current.copy(target.position)
    const settings = { flightDuration: CARD_SETTINGS.flightDuration, flightHeight: CARD_SETTINGS.flightHeight * Math.min(1, size * 1.4), foldable: 0, easing: CARD_SETTINGS.easing }
    if (from || (left && g.position.distanceTo(target.position) > JUMP)) flight.current = startFlight(g, target, 0, settings)
    light(g.quaternion)
    // On its way out the piece writes down where it was, for the piece with the same id that appears next
    return () => {
      if (memory && id !== undefined) memory.remember(id, g)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    const S = PIECE_SETTINGS
    const now = latest.current
    const flightSettings = { flightDuration: CARD_SETTINGS.flightDuration, flightHeight: CARD_SETTINGS.flightHeight * Math.min(1, now.size * 1.4), foldable: 0, easing: CARD_SETTINGS.easing }
    // Turning over starts a hop
    if (faceNow.current !== face) {
      faceNow.current = face
      hop.current = { t: 0 }
    }
    // While the piece is held it goes where the pointer has it, lifted; the rest of the time it goes to the place the game gives it
    const held = drag.held.current
    const aim = held ? dragGoal(goal, now.target, held.x, held.z, DRAG_SETTINGS.lift, 1) : now.target
    if (!held && !flight.current && now.target.position.distanceTo(last.current) > JUMP && g.position.distanceTo(now.target.position) > JUMP) flight.current = startFlight(g, now.target, 0, flightSettings)
    last.current.copy(aim.position)

    if (flight.current) {
      if (stepFlight(flight.current, dt, g, now.target, flightSettings, fold.current)) {
        flight.current = null
        now.onArrive?.()
      }
    } else {
      let hopY = 0
      if (hop.current) {
        hop.current.t += dt / Math.max(0.05, S.hopSeconds)
        hopY = Math.sin(Math.PI * Math.min(1, hop.current.t)) * S.hop * now.size
        if (hop.current.t >= 1) hop.current = null
      }
      const smooth = held ? followSeconds(drag.reduced) : S.glide
      easing.damp3(g.position, tmp.copy(aim.position).setY(aim.position.y + hopY), smooth, dt)
      easing.dampQ(g.quaternion, aim.quaternion, smooth, dt)
    }
    light(g.quaternion)

    const s = shadowMesh.current
    if (s) {
      const rise = Math.max(0, g.position.y - now.y)
      s.visible = now.shadow
      s.position.set(g.position.x + SHADOW_PUSH.x * (now.y + rise + 0.3) * now.size, SHADOW_HEIGHT, g.position.z + SHADOW_PUSH.z * (now.y + rise + 0.3) * now.size)
      s.scale.setScalar(now.model.reach * now.size * (2.3 + 0.5 * rise))
      ;(s.material as MeshBasicMaterial).opacity = S.shadow / (1 + rise * 0.9)
    }
    const r = ring.current
    if (r) {
      r.visible = !!now.halo
      r.position.set(g.position.x, RING_HEIGHT, g.position.z)
      ;(r.material as MeshBasicMaterial).opacity = 0.55 + 0.3 * Math.sin(clock.elapsedTime * 3.2)
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
      <group
        ref={group}
        onPointerDown={drag.bind.onPointerDown}
        onClick={drag.bind.onClick}
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
        <mesh geometry={geometry} material={materials} />
        {children && (
          <group position-y={height + 0.002} rotation-x={-Math.PI / 2}>
            {children}
          </group>
        )}
      </group>
    </>
  )
}

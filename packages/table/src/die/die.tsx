"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { type BufferAttribute, type Group, type Mesh, MeshBasicMaterial, Quaternion, type Texture, Vector3 } from "three"
import { shadowTexture } from "../card/textures"
import { hashRandom } from "../pose"
import { labelFace, type Labels, newLabels } from "./labels"
import { type DieModel, dropOf, restingQuaternion } from "./model"
import { numberFace } from "./numbers"
import { durationOf, impactsOf, loadPhysics, type Pose, type Recording, sampleRecording } from "./physics"
import { DEFAULT_BODY, DEFAULT_INK, pipFace } from "./pips"
import { DIE_DEBUG, DIE_SETTINGS, DIE_SIZE } from "./settings"
import { shadeVertices } from "./shade"
import { dieModel, type DieShape } from "./solids"
import { Tray, useTray } from "./tray"

/** What a face of a die can say: a number or a word */
export type DieValue = number | string

export type DieProps = {
  /** Names the die. It seeds the look of its roll, so that every player sees the same throw, and tells one die from another in a tray: no two dice of a tray have the same */
  id: string
  /** The shape: one of the dice of the package (`d6` by default) or a `DieModel` of the game's own, made with `makeDieModel` */
  model?: DieShape | DieModel
  /** What each face says, one entry for each face of the shape, as the labels run: numbers or words. A cube says 1 to 6 and any other die 1 up to its number of faces unless the game gives its own */
  values?: readonly DieValue[]
  /** The value that lies up: one of `values`, the one the engine gave. The die shows it at once when it appears, and turns onto it when it changes without a `roll` */
  value: DieValue
  /** Where the die lies on the table and which way it is turned (`yaw`, radians about the vertical axis, counterclockwise from above). Without a `yaw` it lies a little askew, always the same way for the same `id`. After a roll the die stays where it landed until `at` or `value` changes */
  at: { x: number; z: number; yaw?: number }
  /** The distance across the die from a face to the opposite one, in world units (default `DIE_SIZE`) */
  size?: number
  /** Names the roll that gave `value`. When it changes after the die appeared, the die is thrown and rolls with the physics onto `value`; while it stays, nothing is thrown. Use something every player sees alike: the move's number in the log, a count of rolls kept in the view */
  roll?: string | number
  /** Where the die is thrown from, its centre. By default from the near side of its tray, above the table */
  from?: Vector3 | [number, number, number]
  /** Raised above the table by this much once at rest: a die the player holds back, or picks to roll again */
  lift?: number
  /** The picture of each value, `faces[i]` for `values[i]`: textures in sRGB, painted by the game or made from its pictures. By default the pips of `pipFace` on a cube numbered 1 to 6 and the number written by `numberFace` on any other */
  faces?: readonly Texture[]
  /** The colour of the body, and of the ink of the default faces */
  body?: string
  ink?: string
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onHover?: (hovered: boolean) => void
  /** Called each time a rolling die hits the table, with how hard (1 is the hardest): where a game plays the sound of a die */
  onBounce?: (strength: number) => void
  /** Called when a roll ends and the die lies still */
  onLand?: () => void
}

// The shadow lies on the table, a hair above the surface and its picture; it is pushed away from the light by half the height of the die's centre
const SHADOW_HEIGHT = 0.012
const SHADOW_PUSH = { x: 0.175, z: -0.275 }
// Where the area of a die with no tray is: this wide and deep, centred on its place
const OWN_AREA = { width: 6, depth: 4 }

const tmp = new Vector3()

function faceFor(model: DieModel, value: DieValue, body: string, ink: string): Texture {
  return model.name === "d6" && typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6 ? pipFace(value, { body, ink }) : numberFace(String(value), { body, ink })
}

/**
 * A die on the table: any number of faces, any shape, any values. It lies on the face that carries `value`; when `roll` changes it is thrown, and the physics rolls it onto the table: it bounces, tumbles, knocks the other dice
 * of its `DiceTray` and comes to rest. The roll is simulated before it is drawn, and the die is then labelled so that the face that ended on top carries `value`, the number the engine gave: the physics decides how the die falls,
 * the engine decides what it says. The throw is worked out from the die's `id` and the roll, so it is the same on every machine. A visitor who asks for less motion sees the die lie on its value at once.
 *
 * The die is lit by a light of its own, so it needs none from the table. Its faces are the pips of `pipFace` on a cube and the number of `numberFace` on any other die, unless the game gives its own pictures.
 */
export function Die({ id, model: shape = "d6", values, value, at, size = DIE_SIZE, roll, from, lift = 0, faces, body = DEFAULT_BODY, ink = DEFAULT_INK, onClick, onHover, onBounce, onLand }: DieProps) {
  const model = useMemo(() => (typeof shape === "string" ? dieModel(shape) : shape), [shape])
  const list = useMemo<readonly DieValue[]>(() => (values && values.length === model.sides ? values : Array.from({ length: model.sides }, (_, i) => i + 1)), [values, model])
  const yaw = at.yaw ?? hashRandom(`${id}:yaw`) * 0.5
  const reduced = usePrefersReducedMotion()

  const group = useRef<Group>(null)
  const shadow = useRef<Mesh>(null)
  // The labels belong to a model: a model of another solid has other faces, so the labels start again
  const [facing, setFacing] = useState<{ model: DieModel; labels: Labels }>(() => ({ model, labels: newLabels(model) }))
  if (facing.model !== model) setFacing({ model, labels: newLabels(model) })
  const current = facing.model === model ? facing.labels : newLabels(model)
  const labelsNow = useRef<Labels>(current)
  useEffect(() => {
    labelsNow.current = current
  })

  const playing = useRef<{ recording: Recording; t: number; duration: number; hits: { at: number; strength: number }[]; next: number } | null>(null)
  const armed = useRef<Recording | null>(null)
  const pending = useRef(false)
  const landed = useRef<Pose | null>(null)
  const pose = useRef<Pose>({ position: new Vector3(), quaternion: new Quaternion() })
  const shaded = useRef(new Quaternion(2, 2, 2, 2))
  const landedNow = useRef(false)
  const rolled = useRef(roll)
  const replays = useRef(DIE_DEBUG.replays)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && !!onClick)
  const [shadowTex] = useState(shadowTexture)

  // What a frame reads: the newest props, not the ones of the render that made the frame's closure
  const latest = useRef({ id, value, list, at, size, yaw, lift, from, reduced, onBounce, onLand })
  useEffect(() => {
    latest.current = { id, value, list, at, size, yaw, lift, from, reduced, onBounce, onLand }
  })

  // A die with no tray of its own is thrown alone, in an area round its place: a die that is moved has the tray of its new place
  const own = useMemo(() => new Tray({ x: at.x, z: at.z, ...OWN_AREA }), [at.x, at.z])
  const shared = useTray()
  const tray = shared ?? own

  const labelOfValue = (v: DieValue) => Math.max(0, list.indexOf(v))
  const faceOfValue = current.indexOf(labelOfValue(value))
  const placed = useMemo(() => {
    const quaternion = restingQuaternion(model, Math.max(0, faceOfValue), yaw)
    return { quaternion, height: dropOf(model, quaternion) * size }
  }, [model, faceOfValue, yaw, size])

  const geometry = useMemo(() => model.geometry(size), [model, size])
  useEffect(() => () => geometry.dispose(), [geometry])
  const pictures = useMemo(() => list.map((v, i) => faces?.[i] ?? faceFor(model, v, body, ink)), [list, faces, model, body, ink])
  const byLabel = useMemo(() => pictures.map((map) => new MeshBasicMaterial({ map, vertexColors: true, toneMapped: false })), [pictures])
  const bodyMaterial = useMemo(() => new MeshBasicMaterial({ color: body, vertexColors: true, toneMapped: false }), [body])
  useEffect(() => () => byLabel.forEach((material) => material.dispose()), [byLabel])
  useEffect(() => () => bodyMaterial.dispose(), [bodyMaterial])
  const materials = useMemo(() => [bodyMaterial, ...current.map((label) => byLabel[label] ?? bodyMaterial)], [bodyMaterial, byLabel, current])

  // The die is lit as it turns: its vertices take a grey from the way each one faces, whenever it has turned
  const light = (q: Quaternion) => {
    if (shaded.current.equals(q)) return
    shaded.current.copy(q)
    const colors = geometry.getAttribute("color") as BufferAttribute
    shadeVertices(geometry.getAttribute("normal").array, q, colors.array as Float32Array)
    colors.needsUpdate = true
  }

  // What the tray knows of the die: where it lies when it lies still
  const handle = useMemo(
    () => ({
      id,
      model,
      size,
      resting: () => (playing.current || pending.current || !group.current ? null : { position: group.current.position.clone(), quaternion: group.current.quaternion.clone() }),
    }),
    [id, model, size],
  )
  useEffect(() => tray.register(handle), [tray, handle])
  // The physics is loaded as soon as a die is on the table, so that it is there when the first roll comes
  useEffect(() => {
    loadPhysics().catch(() => undefined)
  }, [])

  const target = (out: Vector3) => out.set(at.x, placed.height + lift, at.z)

  // The die is where `value` and `at` say from the first frame: a table that opens on a die that was rolled long ago shows it lying still
  useLayoutEffect(() => {
    const g = group.current
    if (!g) return
    target(g.position)
    g.quaternion.copy(placed.quaternion)
    light(g.quaternion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry])

  // A die that is moved, or whose value changes with no new roll, goes to its place: it forgets where it landed
  useEffect(() => {
    landed.current = null
  }, [at.x, at.z, at.yaw, value, lift])

  const throwDie = (name: string) => {
    const now = latest.current
    const g = group.current
    pending.current = true
    landed.current = null
    playing.current = null
    if (g) g.visible = false
    const key = `${now.id}:${name}`
    const start = now.from ? (Array.isArray(now.from) ? new Vector3(...now.from) : now.from.clone()) : undefined
    tray.throw({
      handle,
      key,
      ...(start ? { from: start } : {}),
      done: (recording) => {
        if (!recording) {
          // No physics: the die lies on its number at once
          pending.current = false
          landedNow.current = true
          if (group.current) group.current.visible = true
          return
        }
        armed.current = recording
        const next = labelFace(model, labelsNow.current, recording.up, Math.max(0, latest.current.list.indexOf(latest.current.value)), key)
        labelsNow.current = next
        setFacing((now) => (now.model === model ? { model, labels: next } : now))
      },
    })
  }

  // The roll has been simulated and the die labelled: once the new faces are drawn, the recording plays
  useLayoutEffect(() => {
    const recording = armed.current
    const g = group.current
    if (!recording || !g) return
    armed.current = null
    pending.current = false
    playing.current = { recording, t: 0, duration: durationOf(recording), hits: impactsOf(recording, model, latest.current.size), next: 0 }
    sampleRecording(recording, 0, pose.current)
    g.position.copy(pose.current.position)
    g.quaternion.copy(pose.current.quaternion)
    light(g.quaternion)
    g.visible = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  // A new roll throws the die. The roll the die appeared with is not new
  useEffect(() => {
    if (roll === rolled.current) return
    rolled.current = roll
    if (roll === undefined) return
    if (latest.current.reduced) {
      // No throw: the die lies on its value at once, where the game puts it
      landed.current = null
      playing.current = null
      landedNow.current = true
    } else throwDie(String(roll))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const now = latest.current
    if (DIE_DEBUG.replays !== replays.current) {
      replays.current = DIE_DEBUG.replays
      if (!now.reduced) throwDie(`replay-${replays.current}`)
    }
    let clearance = 0
    const play = playing.current
    if (play) {
      play.t = Math.min(play.duration, play.t + dt * DIE_SETTINGS.speed)
      sampleRecording(play.recording, play.t, pose.current)
      g.position.copy(pose.current.position)
      g.quaternion.copy(pose.current.quaternion)
      clearance = Math.max(0, g.position.y - dropOf(model, g.quaternion) * now.size)
      while (play.next < play.hits.length && play.hits[play.next]!.at <= play.t) {
        now.onBounce?.(play.hits[play.next]!.strength)
        play.next++
      }
      if (play.t >= play.duration) {
        playing.current = null
        landed.current = { position: g.position.clone(), quaternion: g.quaternion.clone() }
        now.onLand?.()
      }
    } else if (!pending.current) {
      const rest = landed.current
      if (rest) {
        g.position.copy(rest.position)
        g.quaternion.copy(rest.quaternion)
      } else if (now.reduced) {
        target(g.position)
        g.quaternion.copy(placed.quaternion)
      } else {
        easing.damp3(g.position, target(tmp), DIE_SETTINGS.glide, dt)
        easing.dampQ(g.quaternion, placed.quaternion, DIE_SETTINGS.glide, dt)
      }
      clearance = Math.max(0, g.position.y - dropOf(model, g.quaternion) * now.size)
      if (landedNow.current) {
        landedNow.current = false
        now.onLand?.()
      }
    }
    light(g.quaternion)
    const s = shadow.current
    if (s) {
      const lifted = g.position.y
      s.visible = g.visible
      s.position.set(g.position.x + SHADOW_PUSH.x * lifted, SHADOW_HEIGHT, g.position.z + SHADOW_PUSH.z * lifted)
      s.scale.setScalar(now.size * (1.9 + 0.5 * clearance))
      ;(s.material as MeshBasicMaterial).opacity = DIE_SETTINGS.shadow / (1 + clearance * 0.9)
    }
  })

  return (
    <>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group
        ref={group}
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
        <mesh geometry={geometry} material={materials} />
      </group>
    </>
  )
}

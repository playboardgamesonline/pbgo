"use client"

import { useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { copyButton } from "@pbgo/core/components/game/debug-controls"
import { useDebugFolder } from "@pbgo/core/components/game/debug-folders"
import { captureGamePhoto } from "@pbgo/core/lib/photo"
import { definedGlows, type Glow } from "../card/glows"
import { BAG_FIELDS, BAG_SETTINGS } from "../bag/settings"
import { CARD_FIELDS, CARD_SETTINGS } from "../card/settings"
import { COUNTER_FIELDS, COUNTER_SETTINGS } from "../counter/settings"
import { CUP_FIELDS, CUP_SETTINGS } from "../cup/settings"
import { DIE_DEBUG, DIE_FIELDS, DIE_SETTINGS } from "../die/settings"
import { DRAG_FIELDS, DRAG_SETTINGS } from "../drag/settings"
import { PIECE_FIELDS, PIECE_SETTINGS } from "../piece/settings"
import { SEAT_FIELDS, SEAT_SETTINGS } from "../seat/placement"
import { CAMERA_FIELDS, CAMERA_INTRO, type CameraIntro, type CameraSettings, INTRO_FIELDS } from "../table/camera"
import { DEFAULT_LIGHTS, type LightsProps } from "../table/lights"
import { SURFACE_TILE } from "../table/surface"
import type { TableProps } from "../table/table"
import { SLIDER_FIELDS, SLIDER_SETTINGS } from "../slider/settings"
import { STEPPER_FIELDS, STEPPER_SETTINGS } from "../stepper/settings"
import { TIMER_FIELDS, TIMER_SETTINGS } from "../timer/settings"
import { TRACK_FIELDS, TRACK_SETTINGS } from "../track/settings"
import { AxesGizmo } from "./gizmos"
import { describeCard, inspector } from "./inspector"
import { ENTRANCE, FLOOR_OVERRIDE, LIGHTS_OVERRIDE } from "./overrides"
import { type Field, inputs, notifySettings, settingsSchema, useSettings, useSettingsVersion } from "./settings"
import { slowClock } from "./time"
import { DEBUG_VIEW, resetView, TIME, TIME_FIELDS, VIEW_FIELDS } from "./view"

export type TableDebugProps = Pick<TableProps, "camera" | "intro" | "photo" | "lights" | "surface">

/**
 * The debug tools of the table: the folders of the panel for what the table owns (the camera and its entrance, the lights, the floor, the cards, the seats and the glows), and the
 * helpers it draws over the table (axes, zone frames and seat spots), an inspector for the card under the pointer and a slow motion. The `Table` mounts it while the panel is
 * open; closing the panel takes it all away, and puts the view and the time back to normal. A game adds the folders of its own with `useSettings`.
 */
export default function TableDebug({ camera, intro, photo, lights, surface }: TableDebugProps) {
  // The axes are drawn here when the View folder says so
  useSettingsVersion()
  useEffect(() => resetView, [])
  return (
    <>
      <CameraFolders camera={camera} intro={intro ?? CAMERA_INTRO} photo={photo} />
      {lights && <LightsFolder lights={lights} />}
      <FloorFolder surface={surface} />
      <PieceFolders />
      <ViewFolders />
      <TimeScale />
      {DEBUG_VIEW.axes && <AxesGizmo />}
    </>
  )
}

/** The table's camera, its entrance (with a button to play it again) and, when the table has one, the camera of the share photo (with a button to download a test photo) */
function CameraFolders({ camera, intro, photo }: { camera: CameraSettings; intro: CameraIntro; photo?: CameraSettings }) {
  useSettings("Camera", camera, CAMERA_FIELDS, { order: 0, closed: false })
  useDebugFolder({
    folder: "Entrance",
    tab: "SCENE",
    order: 4,
    schema: ({ button }) => ({
      ...settingsSchema("Entrance", "SCENE", intro, INTRO_FIELDS),
      "Play again": button(() => {
        ENTRANCE.replays++
      }),
    }),
  })
  return photo ? <PhotoFolder photo={photo} /> : null
}

function PhotoFolder({ photo }: { photo: CameraSettings }) {
  useDebugFolder({
    folder: "Share Photo",
    tab: "SCENE",
    order: 14,
    schema: ({ button }) => ({
      ...settingsSchema("Share Photo", "SCENE", photo, CAMERA_FIELDS),
      "Download test photo": button(() => {
        const canvas = captureGamePhoto(1600, 1200)
        if (!canvas) return
        const link = document.createElement("a")
        link.href = canvas.toDataURL("image/png")
        link.download = "table-photo.png"
        link.click()
      }),
    }),
  })
  return null
}

/** A number knob that leaves what the panel starts with alone, and says it when it moves */
function knob(label: string, min: number, max: number, step: number, value: number, set: (value: number) => void) {
  return {
    value,
    label,
    min,
    max,
    step,
    onChange: (next: number, _route: string, context: { initial: boolean }) => {
      if (context.initial) return
      set(next)
      notifySettings()
    },
  }
}

/** The lights are props of the table, not an object a frame reads: the folder lays what it changed over them (`LIGHTS_OVERRIDE`), and starts from what is laid over them already */
function LightsFolder({ lights }: { lights: Exclude<TableProps["lights"], false | undefined> }) {
  const start: Required<LightsProps> = { ...DEFAULT_LIGHTS, ...(lights === true ? {} : lights), ...LIGHTS_OVERRIDE }
  useDebugFolder({
    folder: "Lights",
    tab: "SCENE",
    order: 5,
    schema: () => {
      const sun: [number, number, number] = [...start.sunPosition]
      const move = (axis: 0 | 1 | 2) => (value: number) => {
        sun[axis] = value
        LIGHTS_OVERRIDE.sunPosition = [...sun]
      }
      return {
        ambient: knob("ambient", 0, 4, 0.05, start.ambient, (value) => (LIGHTS_OVERRIDE.ambient = value)),
        sun: knob("sun", 0, 8, 0.05, start.sun, (value) => (LIGHTS_OVERRIDE.sun = value)),
        sunX: knob("sun x", -30, 30, 0.5, sun[0], move(0)),
        sunY: knob("sun y", 1, 40, 0.5, sun[1], move(1)),
        sunZ: knob("sun z", -30, 30, 0.5, sun[2], move(2)),
        ...copyButton("SCENE", "Lights"),
      }
    },
  })
  return null
}

/** Same for the floor: its colour and how big one repeat of its picture is */
function FloorFolder({ surface }: { surface: TableProps["surface"] }) {
  const color = FLOOR_OVERRIDE.color ?? surface.color
  const tile = FLOOR_OVERRIDE.tile ?? surface.tile ?? SURFACE_TILE
  useDebugFolder({
    folder: "Floor",
    tab: "SCENE",
    order: 6,
    schema: () => ({
      color: {
        value: color,
        label: "colour",
        onChange: (next: string, _route: string, context: { initial: boolean }) => {
          if (context.initial) return
          FLOOR_OVERRIDE.color = next
          notifySettings()
        },
      },
      tile: knob("picture tile", 0.5, 8, 0.1, tile, (value) => (FLOOR_OVERRIDE.tile = value)),
      ...copyButton("SCENE", "Floor"),
    }),
  })
  return null
}

/** The parts of a glow a frame reads, and the knob of each: `spread` and `blend` are read when the card is drawn, so they have none */
const GLOW_FIELDS: { [Part in keyof Glow]-?: Record<string, Field> } = {
  halo: { color: "colour", opacity: ["opacity", 0, 1, 0.01], pulse: ["pulse", 0, 0.5, 0.005], speed: ["speed", 0, 10, 0.05] },
  outline: { color: "colour", visible: "visible" },
  frame: { color: "colour", opacity: ["opacity", 0, 1, 0.01], pulse: ["pulse", 0, 0.5, 0.005], breath: ["breath", 0, 0.1, 0.001], speed: ["speed", 0, 10, 0.05] },
  sparkle: { opacity: ["opacity", 0, 1, 0.01], speed: ["speed", 0, 3, 0.01] },
}

/** One folder for a glow, with a sub-folder for each part it has */
function GlowFolder({ name, glow }: { name: string; glow: Glow }) {
  const folder = `Glow · ${name}`
  useDebugFolder({
    folder,
    tab: "SCENE",
    order: 7,
    schema: ({ folder: group }) => {
      const parts = (Object.keys(GLOW_FIELDS) as (keyof Glow)[]).flatMap((part) => {
        const values = glow[part]
        // The inputs are made the way every folder's are (`inputs`); leva's own types cannot tell what they hold
        return values ? [[part, group(inputs(values as Record<string, unknown>, GLOW_FIELDS[part]) as never, { collapsed: true })] as const] : []
      })
      return { ...Object.fromEntries(parts), ...copyButton("SCENE", folder) }
    },
  })
  return null
}

/** What the table owns and a frame reads: the cards, the dice, the pieces, the counters, the cups, the bags, the tracks, the steppers, the sliders, the timers, the drag, the seats, and the glows the game defined (those with no part at all have nothing to tune) */
function PieceFolders() {
  useSettings("Card", CARD_SETTINGS, CARD_FIELDS, { order: 2 })
  useDebugFolder({
    folder: "Die",
    tab: "SCENE",
    order: 2,
    schema: ({ button }) => ({
      ...settingsSchema("Die", "SCENE", DIE_SETTINGS, DIE_FIELDS),
      "Roll again": button(() => {
        DIE_DEBUG.replays++
      }),
    }),
  })
  useSettings("Piece", PIECE_SETTINGS, PIECE_FIELDS, { order: 2 })
  useSettings("Counter", COUNTER_SETTINGS, COUNTER_FIELDS, { order: 2 })
  useSettings("Cup", CUP_SETTINGS, CUP_FIELDS, { order: 2 })
  useSettings("Bag", BAG_SETTINGS, BAG_FIELDS, { order: 2 })
  useSettings("Track", TRACK_SETTINGS, TRACK_FIELDS, { order: 2 })
  useSettings("Stepper", STEPPER_SETTINGS, STEPPER_FIELDS, { order: 2 })
  useSettings("Slider", SLIDER_SETTINGS, SLIDER_FIELDS, { order: 2 })
  useSettings("Timer", TIMER_SETTINGS, TIMER_FIELDS, { order: 2 })
  useSettings("Drag", DRAG_SETTINGS, DRAG_FIELDS, { order: 2 })
  useSettings("Seat", SEAT_SETTINGS, SEAT_FIELDS, { order: 3 })
  return (
    <>
      {definedGlows()
        .filter(([, glow]) => Object.keys(glow).length > 0)
        .map(([name, glow]) => (
          <GlowFolder key={name} name={name} glow={glow} />
        ))}
    </>
  )
}

/** The lines the Inspector shows, in order */
const INSPECTOR_LINES = ["card", "at", "target", "scale", "flight", "glow"] as const

/** What to draw over the table, what the pointer is on, and how fast time goes */
function ViewFolders() {
  useSettings("View", DEBUG_VIEW, VIEW_FIELDS, { order: 20, closed: false })
  useDebugFolder({
    folder: "Inspector",
    tab: "SCENE",
    order: 21,
    schema: ({ monitor }) =>
      Object.fromEntries(
        INSPECTOR_LINES.map((line) => [
          line,
          // A monitor reads `current` now and then; the getter reads the card under the pointer then
          monitor({ get current() { return describeCard(DEBUG_VIEW.inspector ? inspector.reading() : null)[line] } }, { graph: false, interval: 100 }),
        ]),
      ),
  })
  useSettings("Time", TIME, TIME_FIELDS, { order: 22 })
  return null
}

/** Slows the canvas's clock for as long as the panel is open */
function TimeScale() {
  const clock = useThree((state) => state.clock)
  useEffect(() => slowClock(clock), [clock])
  return null
}

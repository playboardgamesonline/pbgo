"use client"

import { Card, type CameraIntro, type CameraSettings, onTable, type Pose, type SurfaceProps, Table } from "@pbgo/table"
import { useFrame } from "@react-three/fiber"
import { type ReactNode, useRef } from "react"
import { useSceneReady } from "../frame"
import { back, CARD_SIZE, face, felt, label, palette, type Palette } from "./art"

// What the scenes have in common. A scene is always a `Stage` (one `Table`, with an id of its own because the default id is the same for all and ids are unique on a page) with some words and some cards on it.

/** Tells the frame, once, that the first frame is drawn. */
function Ready() {
  const ready = useSceneReady()
  const told = useRef(false)
  useFrame(() => {
    if (told.current) return
    told.current = true
    ready()
  })
  return null
}

/** The table of a specimen: a felt that never ends, and nothing else on it but what the scene puts. */
export function Stage({
  id,
  camera,
  intro,
  playIntro,
  surface,
  children,
}: {
  id: string
  camera: CameraSettings
  intro?: CameraIntro
  playIntro?: boolean
  /** The felt of the table, when a scene has one of its own (default: the specimens' felt) */
  surface?: SurfaceProps
  children: ReactNode
}) {
  return (
    <Table id={id} camera={camera} intro={intro} playIntro={playIntro} surface={surface ?? { color: palette().felt, map: felt() }}>
      <Ready />
      {children}
    </Table>
  )
}

/** Words written flat on the table, upright for the viewer: a caption in the scene, where a page could not put one. */
export function TableLabel({ text, x, z, height = 0.85, tone }: { text: string; x: number; z: number; height?: number; tone?: keyof Pick<Palette, "text" | "muted" | "ink"> }) {
  const { texture, aspect } = label(text, tone)
  return (
    <mesh position={[x, 0.02, z]} rotation-x={-Math.PI / 2} renderOrder={5} raycast={() => null}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** A few cards lying where they were dropped, some face up and some face down: a table that has been played on. */
const RESTING: readonly { n: number; pose: Pose }[] = [
  { n: 3, pose: onTable(-4.4, 0.8, { yaw: 0.28 }) },
  { n: 12, pose: onTable(-1.9, -0.6, { yaw: -0.18 }) },
  { n: 21, pose: onTable(0.9, 0.9, { face: "down", yaw: 0.12 }) },
  { n: 8, pose: onTable(3.3, -0.5, { yaw: 0.35 }) },
  { n: 30, pose: onTable(5, 1.1, { face: "down", yaw: -0.3 }) },
]

export function RestingCards() {
  const cardBack = back()
  return (
    <>
      {RESTING.map(({ n, pose }) => (
        <Card key={n} target={pose} front={face(n)} back={cardBack} size={CARD_SIZE} />
      ))}
    </>
  )
}

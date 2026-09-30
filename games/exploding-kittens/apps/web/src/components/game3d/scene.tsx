"use client"

import type { PlayedCard, PlayerView } from "@exploding-kittens/engine"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useControls } from "leva"
import { Suspense, useEffect, useMemo, useState } from "react"
import { type PerspectiveCamera, Vector3 } from "three"
import { Aura, WINNER_AURA_SETTINGS } from "./aura"
import { Card3D } from "./card3d"
import { DECK_POSE, type Pose, backPose, handPose, trickPose, collectedPose, LAYOUT_SETTINGS, seats } from "./layout"
import { copyButton, debugTab } from "@pbgo/core/components/game/debug-tabs"
import { GamePhoto } from "./photo"
import { useSettings } from "./settings"
import { TableText } from "./table-text"
import { CARD_H, CARD_W, backTexture, faceTexture, matTexture } from "./textures"

const RAD = Math.PI / 180
const TARGET = new Vector3()

function CameraRig() {
  const { size } = useThree()
  const r = useControls(
    "Camera",
    {
      tilt: { value: 42, min: 0, max: 85, step: 0.5, label: "tilt °" },
      distance: { value: 21, min: 8, max: 60, step: 0.1, label: "distance" },
      fov: { value: 34, min: 10, max: 90, step: 0.5, label: "fov °" },
      targetZ: { value: 1.2, min: -6, max: 6, step: 0.05, label: "target z" },
      ...copyButton("SCENE", "Camera"),
    },
    { order: 0 },
    debugTab("SCENE"),
  )
  useFrame((state) => {
    const cam = state.camera as PerspectiveCamera
    const k = Math.max(1, 1.6 / (size.width / size.height))
    const d = r.distance * k
    cam.position.set(0, d * Math.cos(r.tilt * RAD), r.targetZ + d * Math.sin(r.tilt * RAD))
    cam.lookAt(TARGET.set(0, 0, r.targetZ))
    if (cam.fov !== r.fov) {
      cam.fov = r.fov
      cam.updateProjectionMatrix()
    }
  })
  return null
}

function Table() {
  const R = LAYOUT_SETTINGS
  const [tex] = useState(matTexture)
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} raycast={() => null}>
        <planeGeometry args={[120, 80]} />
        <meshBasicMaterial color="#0d1729" toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} scale={[R.radiusX + 1.6, R.radiusZ + 1.6, 1]} raycast={() => null}>
        <circleGeometry args={[1, 96]} />
        <meshBasicMaterial color="#6b4a2a" toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} scale={[R.radiusX + 1.35, R.radiusZ + 1.35, 1]} raycast={() => null}>
        <circleGeometry args={[1, 96]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

function useCollect(view: PlayerView) {
  const key = view.lastTrick ? view.lastTrick.cards.map((c) => c.card.id).join("|") : null
  const [state, setState] = useState<{ key: string | null; phase: "rest" | "flight" | "done" }>({ key, phase: "done" })
  if (state.key !== key) setState({ key, phase: key ? "rest" : "done" })
  useEffect(() => {
    if (state.phase === "done") return
    const t = setTimeout(() => setState((e) => ({ ...e, phase: e.phase === "rest" ? "flight" : "done" })), state.phase === "rest" ? 1300 : 1100)
    return () => clearTimeout(t)
  }, [state.phase, state.key])
  return state.phase
}

function World({ view, color, onPlay, myTurn }: SceneProps) {
  useSettings("Layout", LAYOUT_SETTINGS, {
    radiusX: ["table radius x", 3, 14, 0.1],
    radiusZ: ["table radius z", 2, 10, 0.1],
    handZ: ["hand z", 0, 10, 0.05],
    handY: ["hand height", 0, 4, 0.05],
    handTilt: ["hand tilt", 0, 1.5, 0.01],
    handGap: ["hand spacing", 0.5, 2, 0.01],
    handScale: ["hand scale", 0.5, 2, 0.01],
    hoverLift: ["hover lift", 0, 1.5, 0.01],
    trickGap: ["trick spread", 0, 1, 0.01],
  }, { order: 1 })
  const meId = view.me?.id ?? null
  const slots = useMemo(() => seats(view.players.map((j) => j.id), meId), [view.players, meId])
  const [hovered, setHovered] = useState<string | null>(null)
  const collecting = useCollect(view)
  const back = useMemo(() => backTexture(), [])

  const hand = view.me?.hand ?? []
  const trickCards: { p: PlayedCard; pose: Pose; from?: Pose }[] = view.trick.map((p, rank) => {
    const seat = slots.get(p.playerId)!
    return { p, pose: trickPose(seat, rank), from: p.playerId === meId ? undefined : backPose(seat, 0, 1) }
  })
  const last = view.lastTrick
  const collectedCards =
    last && collecting !== "done"
      ? last.cards.map((p, rank) => ({
          p,
          pose: collecting === "rest" ? trickPose(slots.get(p.playerId)!, rank) : collectedPose(slots.get(last.winnerId)!),
          from: p.playerId === meId ? undefined : backPose(slots.get(p.playerId)!, 0, 1),
        }))
      : []
  const winners = view.results?.winners ?? []

  return (
    <>
      <CameraRig />
      <Table />
      {view.players.map((j) => {
        const s = slots.get(j.id)!
        const active = view.activePlayerId === j.id
        const pos: [number, number, number] = [s.x * (j.id === meId ? 1 : 1.32), 0.02, s.z * (j.id === meId ? 1.18 : 1.32)]
        return (
          <group key={j.id}>
            <Aura width={3.2} depth={1.6} position={[pos[0], 0.015, pos[2]]} yaw={0} force={active ? 0.9 : winners.includes(j.id) ? 1 : 0} color={color(j.id)} settings={WINNER_AURA_SETTINGS} />
            <TableText text={j.nickname.toUpperCase()} style={{ color: color(j.id), shadow: "rgba(0,0,0,0.6)|12|4" }} height={0.62} position={[pos[0], 0.03, pos[2] - 0.25]} />
            <TableText text={`${j.points} pt${j.points > 1 ? "s" : ""}`} style={{ color: "#f5f2ea", weight: 700 }} height={0.42} position={[pos[0], 0.03, pos[2] + 0.35]} />
            {j.id !== meId &&
              Array.from({ length: j.cardCount }, (_, i) => (
                <Card3D key={`back-${j.id}-${i}`} target={backPose(s, i, j.cardCount)} from={{ ...DECK_POSE, delay: i * 0.08 }} front={back} backFace={back} width={CARD_W} height={CARD_H} />
              ))}
          </group>
        )
      })}
      {hand.map((c, i) => (
        <Card3D
          key={c.id}
          target={handPose(i, hand.length, myTurn && hovered === c.id)}
          from={{ ...DECK_POSE, delay: i * 0.08 }}
          front={faceTexture(c)}
          backFace={back}
          width={CARD_W}
          height={CARD_H}
          glow={myTurn && hovered === c.id ? "selection" : null}
          gloss={hovered === c.id}
          onHover={(s) => setHovered((v) => (s ? c.id : v === c.id ? null : v))}
          onClick={
            myTurn
              ? (e) => {
                  e.stopPropagation()
                  setHovered(null)
                  onPlay(c.id)
                }
              : undefined
          }
        />
      ))}
      {[...collectedCards, ...trickCards].map(({ p, pose, from }) => (
        <Card3D key={p.card.id} target={pose} from={from} front={faceTexture(p.card)} backFace={back} width={CARD_W} height={CARD_H} />
      ))}
      <GamePhoto />
    </>
  )
}

type SceneProps = {
  view: PlayerView
  color: (id: string) => string
  myTurn: boolean
  onPlay: (cardId: string) => void
}

export function Scene(props: SceneProps) {
  return (
    <Canvas id="scene-3d" gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]} camera={{ fov: 34, near: 0.1, far: 300, position: [0, 18, 14] }}>
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
    </Canvas>
  )
}

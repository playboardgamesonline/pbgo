"use client"

import type { PlayedCard, PlayerView } from "@template/engine"
import { useEffect, useMemo, useState } from "react"
import { Aura, WINNER_AURA_SETTINGS } from "./aura"
import { CAMERA, PHOTO, useCameraSettings } from "./camera"
import { TurnCrown } from "./crown"
import { CARD_SETTINGS, Surface, Table, Zone, type Pose, type ZoneCard } from "@pbgo/table"
import { GLOWS } from "./glows"
import { DECK_POSE, backFrame, backLayout, backPose, collectedPose, handLayout, LAYOUT_SETTINGS, seats, trickPose } from "./layout"
import type { SeatTheme } from "@pbgo/core/lib/ui-theme"
import { SeatAvatarMesh } from "./seat-avatar-mesh"
import { EASING_NAMES } from "@pbgo/core/components/game/easing"
import { useSettings } from "./settings"
import { TableText } from "./table-text"
import { CARD_SIZE, backTexture, faceTexture, matTexture } from "./textures"

/** The seat avatar left of a nickname: its diameter and the gap to the first letter, in world units */
const AVATAR = { size: 0.56, gap: 0.18 }

/** The mat reaches this far past the ellipse of the seats, then comes its wooden rim */
const MAT = { margin: 1.35, rim: 0.25 }

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

function World({ view, color, avatarUrl, seat, onPlay, myTurn, crownIcon }: SceneProps) {
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
  useSettings("Card", CARD_SETTINGS, {
    flightDuration: ["flight duration (×)", 0.2, 3, 0.01],
    flightHeight: ["flight height (×)", 0, 3, 0.01],
    easing: ["flight easing", EASING_NAMES as string[]],
    foldable: ["bendability", 0, 1, 0.01],
    shadow: ["shadow", 0, 1, 0.01],
  } as never, { order: 2 })
  const meId = view.me?.id ?? null
  const slots = useMemo(() => seats(view.players.map((j) => j.id), meId), [view.players, meId])
  const [hovered, setHovered] = useState<string | null>(null)
  const collecting = useCollect(view)
  const back = useMemo(() => backTexture(), [])
  const [mat] = useState(matTexture)

  const hand = view.me?.hand ?? []
  const raised = myTurn ? hand.findIndex((c) => c.id === hovered) : -1
  const handCards: ZoneCard[] = hand.map((c) => ({
    key: c.id,
    id: c.id,
    front: faceTexture(c),
    back,
    glow: myTurn && hovered === c.id ? GLOWS.selection : null,
    gloss: hovered === c.id,
    onHover: (s) => setHovered((v) => (s ? c.id : v === c.id ? null : v)),
    onClick: myTurn
      ? (e) => {
          e.stopPropagation()
          setHovered(null)
          onPlay(c.id)
        }
      : undefined,
  }))
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
  const middle = [...collectedCards, ...trickCards]
  const winners = view.results?.winners ?? []

  return (
    <>
      <Surface
        size={[2 * (LAYOUT_SETTINGS.radiusX + MAT.margin), 2 * (LAYOUT_SETTINGS.radiusZ + MAT.margin)]}
        rim={{ width: MAT.rim, color: "#6b4a2a" }}
        map={mat}
      />
      {view.players.map((j) => {
        const s = slots.get(j.id)!
        const active = view.activePlayerId === j.id
        const pos: [number, number, number] = [s.x * (j.id === meId ? 1 : 1.32), 0.02, s.z * (j.id === meId ? 1.18 : 1.32)]
        // The cards of a right-hand seat fan out to the left of its name: its avatar goes after the name, away from them
        const after = s.x > 1
        const avatar = (
          <SeatAvatarMesh nickname={j.nickname} color={color(j.id)} imageUrl={avatarUrl(j.id)} theme={seat} size={AVATAR.size} position={[(after ? 1 : -1) * (AVATAR.gap + AVATAR.size / 2), 0, 0]} />
        )
        return (
          <group key={j.id}>
            <Aura width={3.2} depth={1.6} position={[pos[0], 0.015, pos[2]]} yaw={0} force={active ? 0.9 : winners.includes(j.id) ? 1 : 0} color={color(j.id)} settings={WINNER_AURA_SETTINGS} />
            <TableText text={j.nickname.toUpperCase()} style={{ color: color(j.id), shadow: "rgba(0,0,0,0.6)|12|4" }} height={0.62} position={[pos[0], 0.03, pos[2] - 0.25]} trailing={after ? avatar : undefined}>
              {/* left of the first letter: the avatar (but for a right-hand seat), then the turn crown */}
              {!after && avatar}
              <TurnCrown show={active} icon={crownIcon} position={[-((after ? 0 : AVATAR.gap + AVATAR.size) + 0.6), 0, 0]} />
            </TableText>
            <TableText text={`${j.points} pt${j.points > 1 ? "s" : ""}`} style={{ color: "#f5f2ea", weight: 700 }} height={0.42} position={[pos[0], 0.03, pos[2] + 0.35]} />
            {j.id !== meId && (
              <Zone
                frame={backFrame(s)}
                layout={backLayout(s, j.cardCount)}
                size={CARD_SIZE}
                enter={DECK_POSE}
                cards={Array.from({ length: j.cardCount }, (_, i) => ({ key: `back-${j.id}-${i}`, front: back, back }))}
              />
            )}
          </group>
        )
      })}
      <Zone layout={handLayout(hand.length, raised)} size={CARD_SIZE} enter={DECK_POSE} cards={handCards} />
      {/* The middle of the table: the trick being played, and the last one on its way to its winner. Each card lies by its player's seat, so the layout is the game's own */}
      <Zone
        layout={middle.map(({ pose }) => pose)}
        size={CARD_SIZE}
        cards={middle.map(({ p, from }) => ({ key: p.card.id, id: p.card.id, front: faceTexture(p.card), back, from }))}
      />
    </>
  )
}

type SceneProps = {
  view: PlayerView
  color: (id: string) => string
  /** The account's picture of a player (PLT-13), null: the avatar is generated */
  avatarUrl: (id: string) => string | null
  /** How the game dresses its seat avatars (`UI_THEME.seat`, see `useSeatTheme()`) */
  seat: SeatTheme
  /** Icon of the turn crown (the skin's `hostIcon`); without one, a drawn crown */
  crownIcon?: string | null
  /** The floor around the table: the skin's dark surface, so the room matches the page behind the canvas */
  floor: string
  myTurn: boolean
  onPlay: (cardId: string) => void
}

export function Scene(props: SceneProps) {
  useCameraSettings()
  return (
    <Table camera={CAMERA} photo={PHOTO} floor={{ color: props.floor }}>
      <World {...props} />
    </Table>
  )
}

"use client"

import type { PlayedCard, PlayerView } from "@template/engine"
import { useEffect, useMemo, useState } from "react"
import { Bids } from "./bids"
import { CAMERA, PHOTO } from "./camera"
import { PlayerSeat, Table, Timer, useSettings, Zone, type Pose, type ZoneCard } from "@pbgo/table"
import { GLOWS } from "./glows"
import { CLOCK, DECK_POSE, backFrame, backLayout, backPose, collectedPose, handLayout, LAYOUT_SETTINGS, seats, trickPose } from "./layout"
import { CARD_SIZE, MAT_COLOR, backTexture, faceTexture, matTexture } from "./textures"

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

function World({ view, pointsText, onPlay, myTurn, canBid, onBid, deadlineAt }: SceneProps) {
  // The table's own folders (camera, cards, seats, glows, lights...) are made by the shared `Table`; the game binds the knobs of its layout
  useSettings("Layout", LAYOUT_SETTINGS, {
    radiusX: ["seat ring radius x", 3, 14, 0.1],
    radiusZ: ["seat ring radius z", 2, 10, 0.1],
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

  return (
    <>
      {view.players.map((j) => {
        const s = slots.get(j.id)!
        return (
          <PlayerSeat key={j.id} id={j.id} spot={s} viewer={j.id === meId} line={pointsText(j.points)}>
            {j.id !== meId && (
              <Zone
                frame={backFrame(s)}
                layout={backLayout(s, j.cardCount)}
                size={CARD_SIZE}
                enter={DECK_POSE}
                cards={Array.from({ length: j.cardCount }, (_, i) => ({ key: `back-${j.id}-${i}`, front: back, back }))}
              />
            )}
          </PlayerSeat>
        )
      })}
      <Zone layout={handLayout(hand.length, raised)} size={CARD_SIZE} enter={DECK_POSE} cards={handCards} />
      {/* The bids of the simultaneous step, asked and shown with cards of the game's own on the table */}
      <Bids view={view} slots={slots} canBid={canBid} onBid={onBid} />
      {/* The clock of the step, for a game with the option `turnSeconds`: the game says how long a step lasts (the view), the platform when it ends (`deadlineAt`) */}
      {view.timer && <Timer endsAt={deadlineAt} seconds={view.timer.seconds} at={CLOCK.at} size={CLOCK.size} />}
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
  /** A player's score as the line under their name, in the visitor's language (`pointsShort` of the skin) */
  pointsText: (points: number) => string
  myTurn: boolean
  onPlay: (cardId: string) => void
  /** The viewer may bid now: the players are bidding and no bid is waiting for the server */
  canBid: boolean
  /** The viewer pressed the bid card of this many tricks */
  onBid: (amount: number) => void
  /** Where the clock of the step ends, on the page's own clock (`deadlineAt` of the board props), null when none runs */
  deadlineAt: number | null
  /** The start screen is up: the camera's entrance waits for it to go (`held` of the shared `Table`) */
  held?: boolean
  /** Called once when the table is drawn with everything it waited for (`onLoaded` of the shared `Table`) */
  onLoaded?: () => void
}

export function Scene(props: SceneProps) {
  const [mat] = useState(matTexture)
  return (
    <Table camera={CAMERA} photo={PHOTO} surface={{ color: MAT_COLOR, map: mat }} held={props.held} onLoaded={props.onLoaded}>
      <World {...props} />
    </Table>
  )
}

"use client"

import type { PlayedCard, PlayerView } from "@template/engine"
import { useEffect, useMemo, useState } from "react"
import { Bids } from "./bids"
import { CAMERA, PHOTO } from "./camera"
import { HELD_FAN_FIELDS, HELD_FAN_SETTINGS, HeldHand, PlayerSeat, SCREEN_HAND_FIELDS, ScreenHand, screenHandLayout, Table, Timer, useSettings, Zone, type Pose, type ZoneCard } from "@pbgo/table"
import { CLOCK, DECK_POSE, collectedPose, HAND_SETTINGS, heldFrom, heldLayout, HELD_SHADOW, LAYOUT_SETTINGS, seatBox, seatFrame, seats, trickPose } from "./layout"
import { CARD_SIZE, MAT_COLOR, MAT_LAYERS, MAT_LIGHT, MAT_RESOLUTION, backTexture, faceTexture } from "./textures"

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
    reachX: ["seat line reach x", 0.8, 1.6, 0.01],
    reachZ: ["seat line reach z", 0.8, 1.6, 0.01],
    trickGap: ["trick spread", 0, 1, 0.01],
  }, { order: 1 })
  // The cards the others hold are a small fan of backs that stands, in the frame of its seat like the name: the Held hands folder tunes it
  useSettings("Held hands", HELD_FAN_SETTINGS, HELD_FAN_FIELDS, { order: 3 })
  // The viewer's hand is held at the bottom left of the screen, as Courtisans does: the Hand folder tunes it
  useSettings("Hand", HAND_SETTINGS, SCREEN_HAND_FIELDS, { order: 2 })
  const meId = view.me?.id ?? null
  const slots = useMemo(() => seats(view.players.map((j) => j.id), meId), [view.players, meId])
  const [hovered, setHovered] = useState<string | null>(null)
  const collecting = useCollect(view)
  const back = useMemo(() => backTexture(), [])

  const hand = view.me?.hand ?? []
  const raised = myTurn ? hand.findIndex((c) => c.id === hovered) : -1
  // The cards are in the state the game says (they can be chosen on the viewer's turn) and the table draws the rest: the bloom, the lift under the pointer, the shine
  const handCards: ZoneCard[] = hand.map((c) => ({
    key: c.id,
    id: c.id,
    front: faceTexture(c),
    back,
    state: myTurn ? "interactive" : "base",
    onHover: (over) => setHovered((v) => (over ? c.id : v === c.id ? null : v)),
    onClick: myTurn
      ? (e) => {
          e.stopPropagation()
          setHovered(null)
          onPlay(c.id)
        }
      : undefined,
  }))
  // Where a card an opponent has just played flies from: the left end of their hand, which still held one card more
  const playedFrom = (playerId: string) => heldFrom(slots.get(playerId)!, (view.players.find((j) => j.id === playerId)?.cardCount ?? 0) + 1)
  const trickCards: { p: PlayedCard; pose: Pose; from?: Pose }[] = view.trick.map((p, rank) => {
    const seat = slots.get(p.playerId)!
    return { p, pose: trickPose(seat, rank), from: p.playerId === meId ? undefined : playedFrom(p.playerId) }
  })
  const last = view.lastTrick
  const collectedCards =
    last && collecting !== "done"
      ? last.cards.map((p, rank) => ({
          p,
          pose: collecting === "rest" ? trickPose(slots.get(p.playerId)!, rank) : collectedPose(slots.get(last.winnerId)!),
          from: p.playerId === meId ? undefined : playedFrom(p.playerId),
        }))
      : []
  const middle = [...collectedCards, ...trickCards]

  return (
    <>
      {/* Every player is a line along the axis of their seat, turned as their name is, and in this order from the middle of the table: the plate (the name, the info line under it), the play area (the bid) and the hand. The hands of the others are a small fan of backs that stands, with a small
          round shadow under it: a card played leaves from the left end, a card drawn comes in at the right */}
      {view.players
        .filter((j) => j.id !== meId)
        .map((j) => {
          const s = slots.get(j.id)!
          return (
            <group key={j.id}>
              <PlayerSeat id={j.id} frame={seatFrame(s)} above={seatBox(s)} line={pointsText(j.points)} />
              <HeldHand count={j.cardCount} frame={seatFrame(s)} layout={(n) => heldLayout(n, s)} size={CARD_SIZE} back={back} enter={DECK_POSE} shadow={HELD_SHADOW} />
            </group>
          )
        })}
      {/* The viewer is the same line at the front of the table: the plate, then the play area, then their hand, which is held at the bottom left of the screen, as in Courtisans, whatever the window */}
      {meId && (
        <>
          <PlayerSeat id={meId} frame={seatFrame(slots.get(meId)!)} above={seatBox(slots.get(meId)!)} line={pointsText(view.players.find((j) => j.id === meId)?.points ?? 0)} />
          <ScreenHand settings={HAND_SETTINGS}>
            {(screen) => <Zone layout={screenHandLayout(hand.length, screen, CARD_SIZE, HAND_SETTINGS, raised)} size={CARD_SIZE} enter={screen.local(DECK_POSE)} cards={handCards} />}
          </ScreenHand>
        </>
      )}
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
  return (
    <Table camera={CAMERA} photo={PHOTO} surface={{ color: MAT_COLOR, layers: MAT_LAYERS, resolution: MAT_RESOLUTION, light: MAT_LIGHT }} held={props.held} onLoaded={props.onLoaded}>
      <World {...props} />
    </Table>
  )
}

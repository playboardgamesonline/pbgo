"use client"

import type { PlayedCard, PlayerView } from "@template/engine"
import { useEffect, useMemo, useState } from "react"
import { Bids } from "./bids"
import { CAMERA, PHOTO } from "./camera"
import { HeldHand, PlayerSeat, SCREEN_HAND_FIELDS, ScreenHand, screenHandLayout, Table, Timer, useSettings, Zone, type Pose, type ZoneCard } from "@pbgo/table"
import { CLOCK, DECK_POSE, collectedPose, HAND_SETTINGS, heldFrame, heldFrom, heldBox, heldLayout, HELD_SHADOW, LAYOUT_SETTINGS, seats, trickPose } from "./layout"
import { CARD_SIZE, MAT_COLOR, MAT_LIGHT, backTexture, faceTexture, matTexture } from "./textures"

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
    heldReach: ["opponent hand reach", 0.8, 1.6, 0.01],
    heldGap: ["opponent hand spacing", 0.1, 0.8, 0.01],
    heldScale: ["opponent hand scale", 0.3, 1, 0.01],
    heldY: ["opponent hand height", 0, 2, 0.05],
    heldRoll: ["opponent hand fan", 0, 0.4, 0.005],
    heldTilt: ["opponent hand lean (front)", -1.57, 0, 0.01],
    heldSideTilt: ["opponent hand lean (side)", -1.57, 0, 0.01],
    trickGap: ["trick spread", 0, 1, 0.01],
  }, { order: 1 })
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
      {/* The hands of the others: a fan of backs held up, a small round shadow under it, and the plate of the player on the side that faces the middle, turned with the seat. A card played leaves from the left end, a card drawn comes in at the right */}
      {view.players
        .filter((j) => j.id !== meId)
        .map((j) => {
          const s = slots.get(j.id)!
          const frame = heldFrame(s)
          return (
            <group key={j.id}>
              <PlayerSeat id={j.id} frame={frame} above={heldBox(s)} line={pointsText(j.points)} />
              <HeldHand count={j.cardCount} frame={frame} layout={(n) => heldLayout(n, s.yaw)} size={CARD_SIZE} back={back} enter={DECK_POSE} shadow={HELD_SHADOW} />
            </group>
          )
        })}
      {/* The viewer: their name stays at their seat, in the middle of the front of the table, and their hand is held at the bottom left of the screen, as in Courtisans */}
      {meId && (
        <>
          <PlayerSeat id={meId} spot={slots.get(meId)!} viewer line={pointsText(view.players.find((j) => j.id === meId)?.points ?? 0)} />
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
  const [mat] = useState(matTexture)
  return (
    <Table camera={CAMERA} photo={PHOTO} surface={{ color: MAT_COLOR, map: mat, light: MAT_LIGHT }} held={props.held} onLoaded={props.onLoaded}>
      <World {...props} />
    </Table>
  )
}

"use client"

import { DEFAULT_SEAT_THEME } from "@pbgo/core/lib/ui-theme"
import { Card, type CameraSettings, defineGlows, onTable, Seat, seats, shifted } from "@pbgo/table"
import { useEffect, useState } from "react"
import { BID, type BidView } from "../defaults"
import { bidBack, bidFace, CARD_SIZE, DECK, palette } from "./art"
import { Stage } from "./parts"

// A bid made with cards, as a game with a simultaneous step shows it. The viewer has a row of bid cards across the middle of the table, one for each bid they may make: pressing one sends it to their seat, face up for them to read, and pressing another
// takes its place. The others' bids lie face down at their seats as soon as they are made, and turn over together when the last has. The scene is given what the view gives a board: the viewer's own bid, who else has bid, and what they bid only once
// everybody has.

const CAMERA: CameraSettings = { tilt: 44, yaw: 0, distance: 14.5, fov: 34, targetX: 0, targetZ: 0.7 }
const RING = { radiusX: 5, radiusZ: 3.6 }
const GLOWS = defineGlows({ selection: { frame: {} } })
/** How long the cards that were not chosen stay once the bids are in, so that they are seen going. */
const LEAVING_MS = 900

/** True while `active` is, and for `ms` after it stops. */
function useLinger(active: boolean, ms: number) {
  const [state, setState] = useState({ active, lingering: false })
  if (state.active !== active) setState({ active, lingering: !active })
  useEffect(() => {
    if (!state.lingering) return
    const timer = setTimeout(() => setState((now) => ({ ...now, lingering: false })), ms)
    return () => clearTimeout(timer)
  }, [state.lingering, ms])
  return active || state.lingering
}

const rowAt = (k: number, raised: boolean) => {
  const pose = onTable((k - (BID.count - 1) / 2) * BID.gap, BID.z, { scale: BID.scale })
  return raised ? shifted(pose, { y: 0.3, z: 0.2 }) : pose
}
const bidAt = (spot: { x: number; z: number; yaw: number }, up: boolean) => onTable(spot.x * BID.toward, spot.z * BID.toward, { face: up ? "up" : "down", yaw: spot.yaw, scale: BID.scale })

export function BidScene({ view, onBid }: { view: BidView; onBid: (amount: number) => void }) {
  const p = palette()
  const ring = seats(3, { ...RING, me: 0 })
  const players = [
    { nickname: "Alix", color: p.ivory, spot: ring[0]! },
    { nickname: "Basile", color: p.marks[2], spot: ring[1]! },
    { nickname: "Camille", color: p.marks[0], spot: ring[2]! },
  ] as const
  const [hovered, setHovered] = useState<number | null>(null)
  // Everybody has bid: the others' bids are known and turn over
  const revealed = view.mine !== null && view.others.every((other) => other.bid !== null)
  const rowShown = useLinger(!revealed, LEAVING_MS)
  const back = bidBack()
  const cards = rowShown ? Array.from({ length: BID.count }, (_, k) => k) : view.mine !== null ? [view.mine] : []

  return (
    <Stage id="scene-bid" camera={CAMERA} playIntro={false}>
      {players.map(({ nickname, color, spot }, i) => (
        <Seat key={nickname} nickname={nickname} color={color} theme={DEFAULT_SEAT_THEME} spot={spot} viewer={i === 0} waiting={!revealed && (i === 0 ? view.mine === null : !view.others[i - 1]!.hasBid)} line={i === 0 ? "You" : ""} />
      ))}
      {cards.map((k) => {
        const placed = view.mine === k
        const pressable = !revealed && !placed
        return (
          <Card
            key={`bid-${k}`}
            id={`bid-${k}`}
            target={placed ? bidAt(ring[0]!, true) : !revealed ? rowAt(k, pressable && hovered === k) : DECK}
            from={DECK}
            front={bidFace(k)}
            back={back}
            size={CARD_SIZE}
            glow={(placed && !revealed) || (pressable && hovered === k) ? GLOWS.selection : null}
            gloss={pressable && hovered === k}
            onHover={pressable ? (over) => setHovered((current) => (over ? k : current === k ? null : current)) : undefined}
            onClick={
              pressable
                ? (event) => {
                    event.stopPropagation()
                    setHovered(null)
                    onBid(k)
                  }
                : undefined
            }
          />
        )
      })}
      {view.others.map((other, i) => {
        if (!other.hasBid) return null
        const spot = ring[i + 1]!
        return (
          <Card
            key={`sealed-${i}`}
            id={`sealed-${i}`}
            target={bidAt(spot, other.bid !== null)}
            from={onTable(spot.x * 1.1, spot.z * 1.1, { face: "down", yaw: spot.yaw, scale: 0.62 })}
            front={bidFace(other.bid ?? 0)}
            back={back}
            size={CARD_SIZE}
          />
        )
      })}
    </Stage>
  )
}

"use client"

import type { PlayerView } from "@template/engine"
import { Card } from "@pbgo/table"
import { useEffect, useState } from "react"
import { GLOWS } from "./glows"
import { backPose, bidPose, bidRowPose, DECK_POSE, type SeatSpot } from "./layout"
import { bidBackTexture, bidFaceTexture, CARD_SIZE } from "./textures"

/** How long the bid cards that were not chosen stay on the table once the bids are in, so that they are seen going */
const LEAVING_MS = 900

/** True while `active` is, and for `ms` after it stops: what lets a thing be seen leaving */
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

/**
 * The bids of the simultaneous step, asked and shown on the table with the game's own cards instead of a window. The viewer has a row of bid cards across the middle of the table, one for each bid they may make: pressing one sends it to their
 * seat, where it lies face up for them to read (and glows while they may still change their mind, by pressing another, which takes its place); the others' bids lie face down at their seats as soon as they have bid, and turn over together when the last
 * has. The cards that were not chosen leave once the bids are in. The view says who has bid and never what, until everybody has (`hasBid`, then `bid`), so a bid face down carries a numeral that nobody can read: it is a stand-in.
 */
export function Bids({ view, slots, canBid, onBid }: { view: PlayerView; slots: Map<string, SeatSpot>; canBid: boolean; onBid: (amount: number) => void }) {
  const meId = view.me?.id ?? null
  const mine = view.me
  const mySeat = meId ? slots.get(meId) : undefined
  const bidding = view.phase === "bidding"
  const [hovered, setHovered] = useState<number | null>(null)
  const rowShown = useLinger(bidding, LEAVING_MS)
  const back = bidBackTexture()

  const count = mine ? mine.hand.length + 1 : 0
  // The row while the players bid and for a moment after; then only the card the viewer chose, which stays at their seat for the round
  const own = mine && mySeat ? (rowShown ? Array.from({ length: count }, (_, k) => k) : mine.bid !== null ? [mine.bid] : []) : []

  return (
    <>
      {mine &&
        mySeat &&
        own.map((k) => {
          const placed = mine.bid === k
          const pressable = canBid && bidding && !placed
          const target = placed ? bidPose(mySeat, true) : bidding ? bidRowPose(k, count, pressable && hovered === k) : DECK_POSE
          return (
            <Card
              key={`bid-${k}`}
              id={`bid-${k}`}
              target={target}
              from={DECK_POSE}
              front={bidFaceTexture(k)}
              back={back}
              size={CARD_SIZE}
              glow={placed && bidding ? GLOWS.selection : pressable && hovered === k ? GLOWS.selection : null}
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
      {/* The others' bids: face down at their seats as soon as they are made, face up when everybody's are known */}
      {view.players
        .filter((player) => player.id !== meId && (player.hasBid || player.bid !== null))
        .map((player) => {
          const seat = slots.get(player.id)
          if (!seat) return null
          return (
            <Card
              key={`bid-of-${player.id}`}
              id={`bid-of-${player.id}`}
              target={bidPose(seat, player.bid !== null)}
              from={backPose(seat, 0, Math.max(1, player.cardCount))}
              front={bidFaceTexture(player.bid ?? 0)}
              back={back}
              size={CARD_SIZE}
            />
          )
        })}
    </>
  )
}

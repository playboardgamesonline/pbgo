"use client"

import { type CameraSettings, ChoiceField, NumberField, Paper } from "@pbgo/table"
import { BID_FACES, type Bid, BET_MOST } from "../defaults"
import { Stage, TableLabel } from "./parts"

// Three papers on a table, each opening a window of the platform. The first is a number field (a bet of tricks, as in Skull King), the second a choice field (a face), the third a plain `Paper` that the board presses to open a window of its own with
// two fields at once (a bid, as in Perudo: how many, of which face). What each gives back goes up to the board as the game's action, which the engine checks again.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 10, fov: 34, targetX: 0, targetZ: 0.1 }

export function BetsScene({ bet, face, bid, onBet, onFace, onAskBid }: { bet: number | null; face: number | null; bid: Bid | null; onBet: (value: number) => void; onFace: (value: number) => void; onAskBid: () => void }) {
  const faceLabel = (value: number) => BID_FACES.find((option) => option.value === value)?.label ?? ""
  return (
    <Stage id="scene-bets" camera={CAMERA} playIntro={false}>
      <NumberField
        value={bet}
        onChange={onBet}
        label="Your bet"
        hint="How many tricks you think you will win."
        placeholder="Press to bet"
        min={0}
        max={BET_MOST}
        format={(value) => `${value} ${value === 1 ? "trick" : "tricks"}`}
        at={{ x: -2.4, z: 0.7, yaw: 0.03 }}
        width={2.7}
      />
      <TableLabel text="A number field" x={-2.4} z={1.6} height={0.45} tone="muted" />
      <ChoiceField value={face} options={BID_FACES} onChange={onFace} instant label="Your face" hint="The face of the die you bet on." placeholder="Press to pick" at={{ x: 2.4, z: 0.7, yaw: -0.03 }} width={2.7} />
      <TableLabel text="A choice field" x={2.4} z={1.6} height={0.45} tone="muted" />
      <Paper text={bid ? `${bid.count} × ${faceLabel(bid.face)}` : ""} placeholder="Press to bid" onPress={onAskBid} at={{ x: 0, z: -1.2 }} width={3.4} />
      <TableLabel text="A paper that opens a window of its own" x={0} z={-0.3} height={0.45} tone="muted" />
    </Stage>
  )
}

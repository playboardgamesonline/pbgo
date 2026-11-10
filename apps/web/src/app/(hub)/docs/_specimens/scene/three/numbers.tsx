"use client"

import { type CameraSettings, Piece, Slider, Stepper } from "@pbgo/table"
import { NUMBERS } from "../defaults"
import { palette, tokenFace } from "./art"
import { Stage, TableLabel } from "./parts"

// The three ways to ask for a number or a choice on the table, in the game's own pieces instead of a window. A stepper for a count: two arrows round a number, which repeat when they are held. A row of tokens for a choice among a few things:
// pressing one takes it, and the one that is chosen rises and is ringed. A slider for a number in a wide range: drag the knob along the rail, or press the rail to take it there. The scene holds no number: it shows what the board gives it and
// says what the player pressed.

const CAMERA: CameraSettings = { tilt: 46, yaw: 0, distance: 14, fov: 34, targetX: 0.2, targetZ: 1.5 }
/** Where each way to ask stands on the table: the stepper, the row of tokens, the slider. */
const STEPPER = { x: -3.7, z: -1.4, size: 1 }
const TOKENS = { x: 1, gap: 1.05, z: -1.4, size: 0.9 }
const SLIDER = { x: 0, z: 3.3, length: 9, size: 1.1 }

export type NumbersSceneProps = {
  count: number
  face: number | null
  bet: number
  onCount: (count: number) => void
  onFace: (face: number) => void
  onBet: (bet: number) => void
  /** The slider tells when the knob is let go, which is when a board that asks the server would ask */
  onSettle: (bet: number) => void
}

export function NumbersScene({ count, face, bet, onCount, onFace, onBet, onSettle }: NumbersSceneProps) {
  const colors = palette()
  const tones = [colors.marks[0], colors.marks[1], colors.marks[2], colors.ivory, colors.marks[3], colors.navy]
  return (
    <Stage id="scene-numbers" camera={CAMERA} playIntro={false}>
      <Stepper value={count} onChange={onCount} min={NUMBERS.count.min} max={NUMBERS.count.max} at={{ x: STEPPER.x, z: STEPPER.z }} size={STEPPER.size} format={(value) => `${value} ×`} color={colors.marks[2]} />
      <TableLabel text="Stepper" x={STEPPER.x} z={0.2} height={0.4} tone="muted" />
      {Array.from({ length: NUMBERS.faces }, (_, k) => {
        const chosen = face === k + 1
        return (
          <Piece
            key={k}
            model="hex"
            size={TOKENS.size}
            color={tones[k]}
            faces={{ top: tokenFace(k + 1, tones[k]!) }}
            at={{ x: TOKENS.x + k * TOKENS.gap, z: TOKENS.z }}
            lift={chosen ? 0.2 : 0}
            halo={chosen ? colors.text : null}
            onClick={(event) => {
              event.stopPropagation()
              onFace(k + 1)
            }}
          />
        )
      })}
      <TableLabel text="A row of tokens" x={TOKENS.x + ((NUMBERS.faces - 1) * TOKENS.gap) / 2} z={0.2} height={0.4} tone="muted" />
      <Slider value={bet} onChange={onBet} onCommit={onSettle} min={NUMBERS.bet.min} max={NUMBERS.bet.max} step={NUMBERS.bet.step} at={{ x: SLIDER.x, z: SLIDER.z }} length={SLIDER.length} size={SLIDER.size} fill={colors.marks[2]} />
      <TableLabel text="Slider" x={SLIDER.x} z={5} height={0.4} tone="muted" />
    </Stage>
  )
}

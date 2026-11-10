"use client"

import { askNumber } from "@pbgo/core/components/game/prompt"
import { Paper, type PaperProps } from "./paper"

export type NumberFieldProps = Omit<PaperProps, "text" | "onPress"> & {
  /** The number in the field, or null while none was chosen. The board owns it */
  value: number | null
  /** Called with the number the player confirmed in the window. Without it the field cannot be changed, and only shows its number */
  onChange?: (value: number) => void
  /** What the field is called, in the game's words: the title of the window the field opens */
  label: string
  /** A line in the window that says what the number is for, in the game's words */
  hint?: string
  /** The least and the most the number may be, itself included: the same as the rules the engine checks it with (`cleanNumber`) */
  min: number
  max: number
  /** The steps the number goes by, counted from `min` */
  step?: number
  /** How the number is written on the paper: its unit, a word, a sign (default the number itself) */
  format?: (value: number) => string
  /** The words of the window's two buttons, in the game's language (English unless given) */
  confirm?: string
  cancel?: string
}

/**
 * A number on the table, which a player presses to change: a bet, a quantity, a bid. It is a `Paper` that shows the number, and pressing it opens the platform's window (`askNumber`), with a stepper and the keyboard of the device, kept to
 * the range. The number they confirm comes back through `onChange`, for the board to post as the game's action, which the engine checks again with `cleanNumber`.
 */
export function NumberField({ value, onChange, label, hint, min, max, step, format = String, confirm, cancel, ...paper }: NumberFieldProps) {
  return (
    <Paper
      {...paper}
      text={value === null ? "" : format(value)}
      onPress={
        onChange
          ? () => {
              void askNumber({ title: label, description: hint, value: value ?? undefined, min, max, step, confirm, cancel }).then((chosen) => {
                if (chosen !== null) onChange(chosen)
              })
            }
          : undefined
      }
    />
  )
}

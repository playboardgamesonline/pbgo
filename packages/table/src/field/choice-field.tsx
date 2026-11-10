"use client"

import { askChoice, type ChoiceValue, type PromptOption } from "@pbgo/core/components/game/prompt"
import { Paper, type PaperProps } from "./paper"

export type ChoiceFieldProps<V extends ChoiceValue> = Omit<PaperProps, "text" | "onPress"> & {
  /** The option chosen, or null while none was. The board owns it */
  value: V | null
  /** The options to choose among: their values, what they say in the game's words, and optionally a line under them and a picture. The field shows the label of the one chosen */
  options: readonly PromptOption<V>[]
  /** Called with the option the player confirmed in the window. Without it the field cannot be changed, and only shows its choice */
  onChange?: (value: V) => void
  /** What the field is called, in the game's words: the title of the window the field opens */
  label: string
  /** A line in the window that says what is being chosen, in the game's words */
  hint?: string
  /** Pressing an option confirms it, with no button to press after: for a choice of a few words, yes or no */
  instant?: boolean
  /** The words of the window's two buttons, in the game's language (English unless given) */
  confirm?: string
  cancel?: string
}

/**
 * A choice on the table, which a player presses to change: a colour, a face, a card to take, yes or no. It is a `Paper` that says the option chosen, and pressing it opens the platform's window (`askChoice`) with the options to
 * pick among. The option they confirm comes back through `onChange`, for the board to post as the game's action, which the engine checks again with `cleanChoice`.
 */
export function ChoiceField<V extends ChoiceValue>({ value, options, onChange, label, hint, instant, confirm, cancel, ...paper }: ChoiceFieldProps<V>) {
  return (
    <Paper
      {...paper}
      text={options.find((option) => option.value === value)?.label ?? ""}
      onPress={
        onChange
          ? () => {
              void askChoice({ title: label, description: hint, options, value: value ?? undefined, instant, confirm, cancel }).then((chosen) => {
                if (chosen !== null) onChange(chosen)
              })
            }
          : undefined
      }
    />
  )
}

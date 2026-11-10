"use client"

import { askText, type TextPrompt } from "@pbgo/core/components/game/prompt"
import { Paper, type PaperProps } from "./paper"

/** What a text is checked against: the rules of the engine's `cleanText` */
type TextRules = NonNullable<TextPrompt["rules"]>

export type TextFieldProps = Omit<PaperProps, "text" | "onPress" | "lines"> & {
  /** The text in the field. The board owns it: the text the player confirmed, or a text another player wrote when the field is only read */
  value: string
  /** Called with the text the player confirmed in the window, cleaned by the rules. Without it the field cannot be written in, and only shows its text */
  onChange?: (value: string) => void
  /** What the field is called, in the game's words: the title of the window the field opens */
  label: string
  /** A line in the window that says what to write, in the game's words */
  hint?: string
  /** What the text is checked against when the player confirms: the rules of the engine's `cleanText`, so that the engine does not refuse what the window accepted. They also decide how long the text may be (`max`) and how many lines the window has */
  rules?: TextRules
  /** The words of the window's two buttons, in the game's language (English unless given) */
  confirm?: string
  cancel?: string
  /** How many lines the field has on the table (the lines of `rules` unless given, one by default) */
  lines?: number
}

/**
 * A field of text on the table: a `Paper` with a few words on it, which a player presses to write in. Pressing it opens the platform's window (`askText`), where the player writes, checks and confirms, with the keyboard of their device
 * and everything it brings (input methods, paste, a screen reader). The text they confirm comes back through `onChange`, cleaned by the rules, for the board to post as the game's action.
 */
export function TextField({ value, onChange, label, hint, rules, confirm, cancel, lines, placeholder, ...paper }: TextFieldProps) {
  return (
    <Paper
      {...paper}
      text={value}
      placeholder={placeholder}
      lines={lines ?? rules?.lines ?? 1}
      onPress={
        onChange
          ? () => {
              void askText({ title: label, description: hint, value, placeholder: placeholder || undefined, rules, confirm, cancel }).then((text) => {
                if (text !== null) onChange(text)
              })
            }
          : undefined
      }
    />
  )
}

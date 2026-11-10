import { type ChoiceValue, cleanChoice, cleanChoices, cleanNumber, cleanText, type TextRules } from "@pbgo/engine-kit"

export type { ChoiceValue }

/**
 * The windows a board asks a player for something with: a text, a number (a bet, a quantity), a choice among a few options, or several of these at once (a bid: how many, of which face). They are the platform's own, in its look, so every game
 * asks the same way; a board calls a function, awaits what the player confirmed and posts it as the game's action. The window is DOM and the table is a canvas, where the context of the page does not reach, so asking is a plain function
 * and `PromptHost` (`prompt-host.tsx`, mounted by `GameHud`) draws the window.
 */

/** One option of a choice: what it is, what it says, and optionally a line under it and a picture */
export type PromptOption<V extends ChoiceValue = ChoiceValue> = {
  value: V
  /** What the option says, in the game's words */
  label: string
  /** A line under the label, in the game's words */
  description?: string
  /** The address of a picture shown with the label: the face of a die, a card */
  image?: string
  /** The option is there but cannot be chosen now */
  disabled?: boolean
}

type Named = { id: string; label?: string }

/** A field for a text, checked by `cleanText` with these rules */
export type TextField = Named & { kind: "text"; value?: string; placeholder?: string; rules?: TextRules }
/** A field for a number between `min` and `max`, on `step`s counted from `min` */
export type NumberField = Named & { kind: "number"; value?: number; min: number; max: number; step?: number }
/** A field for one option among `options`, or several of them with `many` (the least and the most that may be chosen) */
export type ChoiceField = Named & { kind: "choice"; options: readonly PromptOption[]; value?: ChoiceValue | readonly ChoiceValue[]; many?: { min?: number; max?: number } }
export type Field = TextField | NumberField | ChoiceField

/** What the player gave: the text, the number, the option, or the options (in the order of the options) of each field, by its `id` */
export type Answers = Record<string, string | number | readonly ChoiceValue[]>

/** A window: its title, what to say under it, its fields in order, and the words of its buttons in the game's language (English unless given) */
export type Prompt = {
  title: string
  description?: string
  fields: readonly Field[]
  confirm?: string
  cancel?: string
  /** A window of one choice only: pressing an option confirms it, with no button to press after */
  instant?: boolean
}

export type Asking = { id: number; prompt: Prompt; resolve: (answers: Answers | null) => void }

let asking: Asking | null = null
let counter = 0
const listeners = new Set<() => void>()

/** For the window that draws what is asked: what is open now, and a way to hear when it changes */
export const currentPrompt = () => asking
export function subscribePrompt(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function change(next: Asking | null) {
  asking = next
  listeners.forEach((listener) => listener())
}

/** Closes the window with what the player gave, or `null` when they closed it without confirming */
export function closePrompt(answers: Answers | null) {
  const closing = asking
  change(null)
  closing?.resolve(answers)
}

/** Opens a window with these fields and gives back the answers, or `null` when the player closes it. Asking while a window is open closes that one as cancelled */
export function ask(prompt: Prompt): Promise<Answers | null> {
  asking?.resolve(null)
  return new Promise((resolve) => change({ id: ++counter, prompt, resolve }))
}

/** What the window of one field takes besides its field: the same words as any window */
type Words = { title: string; description?: string; confirm?: string; cancel?: string }

export type TextPrompt = Words & { value?: string; placeholder?: string; rules?: TextRules }

/** The window where a player writes a text: the text they confirmed, cleaned by the rules, or `null` */
export async function askText({ value, placeholder, rules, ...words }: TextPrompt): Promise<string | null> {
  const answers = await ask({ ...words, fields: [{ id: "text", kind: "text", value, placeholder, rules }] })
  return answers ? (answers.text as string) : null
}

export type NumberPrompt = Words & { value?: number; min: number; max: number; step?: number }

/** The window where a player chooses a number: a bet, a quantity. The number they confirmed, or `null` */
export async function askNumber({ value, min, max, step, ...words }: NumberPrompt): Promise<number | null> {
  const answers = await ask({ ...words, fields: [{ id: "number", kind: "number", value, min, max, step }] })
  return answers ? (answers.number as number) : null
}

export type ChoicePrompt<V extends ChoiceValue> = Words & { options: readonly PromptOption<V>[]; value?: V; instant?: boolean }

/** The window where a player chooses one option: its value, or `null`. With `instant` pressing an option confirms it */
export async function askChoice<V extends ChoiceValue>({ options, value, instant, ...words }: ChoicePrompt<V>): Promise<V | null> {
  const answers = await ask({ ...words, instant, fields: [{ id: "choice", kind: "choice", options, value }] })
  return answers ? (answers.choice as V) : null
}

export type ChoicesPrompt<V extends ChoiceValue> = Words & { options: readonly PromptOption<V>[]; value?: readonly V[]; many?: { min?: number; max?: number } }

/** The window where a player chooses several options, between the least and the most that `many` says: their values in the order of the options, or `null` */
export async function askChoices<V extends ChoiceValue>({ options, value, many = {}, ...words }: ChoicesPrompt<V>): Promise<V[] | null> {
  const answers = await ask({ ...words, fields: [{ id: "choices", kind: "choice", options, value, many }] })
  return answers ? ([...(answers.choices as readonly V[])] as V[]) : null
}

/** What the window holds while the player is at it: the text or the number as they typed it, and the places of the options they picked */
export type Draft = Record<string, string | number[]>

/** The index of an option by its value, or -1 */
const indexOfValue = (options: readonly PromptOption[], value: unknown) => options.findIndex((option) => option.value === value)

/** What each field holds before the player touches it: the text it starts with, the number it starts at (the least without one), the options picked */
export function initialDraft(fields: readonly Field[]): Draft {
  const draft: Draft = {}
  for (const field of fields) {
    if (field.kind === "text") draft[field.id] = field.value ?? ""
    else if (field.kind === "number") draft[field.id] = String(field.value ?? field.min)
    else {
      const picked = Array.isArray(field.value) ? field.value : field.value === undefined ? [] : [field.value]
      draft[field.id] = picked.map((value) => indexOfValue(field.options, value)).filter((index) => index >= 0)
    }
  }
  return draft
}

/**
 * What the player gave, checked the way the engine will check it (`cleanText`, `cleanNumber`, `cleanChoice`, `cleanChoices` of the kit, with the same rules), so that the engine refuses nothing the window accepted. Either all the answers,
 * or the `id`s of the fields that are not right.
 */
export function answersOf(fields: readonly Field[], draft: Draft): { ok: true; answers: Answers } | { ok: false; invalid: string[] } {
  const answers: Answers = {}
  const invalid: string[] = []
  for (const field of fields) {
    const given = draft[field.id]
    try {
      if (field.kind === "text") answers[field.id] = cleanText(given, field.rules)
      else if (field.kind === "number") {
        const typed = typeof given === "string" && given.trim() !== "" ? Number(given) : Number.NaN
        answers[field.id] = cleanNumber(typed, { min: field.min, max: field.max, step: field.step, integer: field.step === undefined || Number.isInteger(field.step) })
      } else {
        const chosen = (Array.isArray(given) ? given : []).flatMap((index) => (field.options[index] && !field.options[index].disabled ? [field.options[index].value] : []))
        const available = field.options.filter((option) => !option.disabled).map((option) => option.value)
        answers[field.id] = field.many ? cleanChoices(chosen, available, field.many) : cleanChoice(chosen[0], available)
      }
    } catch {
      invalid.push(field.id)
    }
  }
  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, answers }
}

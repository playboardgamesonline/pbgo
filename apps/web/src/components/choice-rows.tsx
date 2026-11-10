"use client"

import { useId, useState } from "react"
import type { PreferenceName, Preferences, ReduceChoice } from "@pbgo/accounts"
import { savePreference } from "@pbgo/accounts/client"
import { applyDisplay } from "@pbgo/accounts/display"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Item, ItemActions, ItemContent, ItemTitle } from "@pbgo/ui/platform/item"
import { Label } from "@pbgo/ui/platform/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { changing, failureOf, type ChangeReport } from "@/lib/settings-change"

/** What each of these preferences is counted as when it is changed: the key, never the word chosen. */
const REPORTED: Partial<Record<PreferenceName, ChangeReport>> = { reduceMotion: { setting: "reduce_motion" }, reduceTransparency: { setting: "reduce_transparency" } }

/** One of the words a preference can hold, with what the picker says for it. */
type Choice<Name extends PreferenceName> = { value: Preferences[Name]; label: string }

/**
 * A preference that holds one word of a few, as a row: what it is and a picker, the way the Language row has it. The choice shows at once and goes back to the old one, with a sentence, when the account could not be written (`savePreference`: one key
 * of the account's metadata for each preference, the others untouched). `onSaved` is what the choice changes in the site once it is kept. The picker is not disabled while the choice is kept, since a control that is disabled drops the focus
 * of a keyboard: a choice made meanwhile is left for the next one.
 */
function ChoiceRow<Name extends PreferenceName>({
  name,
  title,
  choices,
  initial,
  demo,
  onSaved,
}: {
  name: Name
  title: string
  choices: readonly Choice<Name>[]
  initial: Preferences[Name]
  demo: boolean
  onSaved: (value: Preferences[Name]) => void
}) {
  const id = useId()
  const [current, setCurrent] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(word: string) {
    const next = choices.find((choice) => choice.value === word)?.value
    if (pending || next === undefined || next === current) return
    const previous = current
    setCurrent(next)
    setPending(true)
    setError(null)
    const outcome = await changing(demo, () => savePreference(name, next), REPORTED[name])
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setCurrent(previous)
      setError(failure)
      return
    }
    onSaved(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <Item>
        <ItemContent>
          <ItemTitle>
            <Label htmlFor={id}>{title}</Label>
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          {pending && <Spinner />}
          <Select value={String(current)} onValueChange={choose}>
            <SelectTrigger id={id} aria-busy={pending} className="w-48">
              <SelectValue>{choices.find((choice) => choice.value === current)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {choices.map((choice) => (
                <SelectItem key={String(choice.value)} value={String(choice.value)}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ItemActions>
      </Item>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/** The three words of a way the site can be reduced, in the words of the pickers: the device decides, always, never. */
const REDUCE_CHOICES: readonly { value: ReduceChoice; label: string }[] = [
  { value: "auto", label: "Match my device" },
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
]

/**
 * The Reduce motion row of the settings: whether the site's animations are reduced (Always), kept whatever the device says (Never), or follow the device's own setting (Match my device). A choice that is kept is put into effect on this page at once
 * and on this device for the next ones (`applyDisplay`: the attribute of `<html>` and the cookie that the head of every page reads before it paints); the other devices of the member take it from their account (`useDisplaySync`).
 */
export function ReduceMotionRow({ choice, demo }: { choice: ReduceChoice; demo: boolean }) {
  return <ChoiceRow name="reduceMotion" title="Reduce motion" choices={REDUCE_CHOICES} initial={choice} demo={demo} onSaved={(value) => applyDisplay("reduceMotion", value)} />
}

/**
 * The Reduce transparency row of the settings: whether the glass of the site, its blurred see-through surfaces, is made solid (Always), kept whatever the device says (Never), or follows the device's own setting (Match my device). Kept and
 * put into effect the way the motion's choice is (`applyDisplay`, `useDisplaySync`): the stylesheet turns the settings of the glass into a solid grey.
 */
export function ReduceTransparencyRow({ choice, demo }: { choice: ReduceChoice; demo: boolean }) {
  return <ChoiceRow name="reduceTransparency" title="Reduce transparency" choices={REDUCE_CHOICES} initial={choice} demo={demo} onSaved={(value) => applyDisplay("reduceTransparency", value)} />
}

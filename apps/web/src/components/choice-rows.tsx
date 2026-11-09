"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import type { PreferenceName, Preferences, ReduceMotion, TimeFormat } from "@pbgo/accounts"
import { savePreference } from "@pbgo/accounts/client"
import { applyMotion } from "@pbgo/accounts/motion"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Item, ItemActions, ItemContent, ItemTitle } from "@pbgo/ui/platform/item"
import { Label } from "@pbgo/ui/platform/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { changing, failureOf } from "@/lib/settings-change"

/** One of the words a preference can hold, with what the picker says for it. */
type Choice<Name extends PreferenceName> = { value: Preferences[Name]; label: string }

/**
 * A preference that holds one word of a few, as a row: what it is and a picker, the way the Language row has it. The choice shows at once and goes back to the old one, with a sentence, when the account could not be written (`savePreference`: one key
 * of the account's metadata for each preference, the others untouched). `onSaved` is what the choice changes in the site once it is kept.
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
    if (next === undefined || next === current) return
    const previous = current
    setCurrent(next)
    setPending(true)
    setError(null)
    const outcome = await changing(demo, () => savePreference(name, next))
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
          <Select value={String(current)} onValueChange={choose} disabled={pending}>
            <SelectTrigger id={id} className="w-48">
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

const TIME_FORMAT_CHOICES: readonly Choice<"timeFormat">[] = [
  { value: "auto", label: "Automatic" },
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
]

/**
 * The Time format row of the settings: how the times on the member's pages are written, in the hours of 12 or of 24, or as the language of the page does (Automatic). The pages that print a time read it from the account when they are drawn, so the page
 * is drawn again once it is kept.
 */
export function TimeFormatRow({ format, demo }: { format: TimeFormat; demo: boolean }) {
  const router = useRouter()
  return <ChoiceRow name="timeFormat" title="Time format" choices={TIME_FORMAT_CHOICES} initial={format} demo={demo} onSaved={() => router.refresh()} />
}

const REDUCE_MOTION_CHOICES: readonly Choice<"reduceMotion">[] = [
  { value: "auto", label: "Match my device" },
  { value: "always", label: "Always" },
  { value: "never", label: "Never" },
]

/**
 * The Reduce motion row of the settings: whether the site's animations are reduced (Always), kept whatever the device says (Never), or follow the device's own setting (Match my device). A choice that is kept is put into effect on this page at once
 * and on this device for the next ones (`applyMotion`: the attribute of `<html>` and the cookie that the head of every page reads before it paints); the other devices of the member take it from their account (`useMotionSync`).
 */
export function ReduceMotionRow({ choice, demo }: { choice: ReduceMotion; demo: boolean }) {
  return <ChoiceRow name="reduceMotion" title="Reduce motion" choices={REDUCE_MOTION_CHOICES} initial={choice} demo={demo} onSaved={(value) => applyMotion(value)} />
}

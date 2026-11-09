"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { isTimeFormat, type TimeFormat } from "@pbgo/accounts"
import { savePreference } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Label } from "@pbgo/ui/platform/label"
import { RadioGroup, RadioGroupItem } from "@pbgo/ui/platform/radio-group"
import { changing, failureOf } from "@/lib/settings-change"

const CHOICES: readonly { value: TimeFormat; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
]

/**
 * The Time format choice of the settings, three radios one under the other: how the times on the member's pages are written, in the hours of 12 or of 24, or as the language of the page does (Automatic). The pages that print a time read
 * it from the account when they are drawn, so the page is drawn again once it is kept. The choice shows at once and goes back to the old one, with a sentence, if the account could not be written (`savePreference`). The group is not
 * disabled while the choice is kept, since a control that is disabled drops the focus of a keyboard that moved along it: a choice made meanwhile is left for the next press (`aria-busy` says it).
 */
export function TimeFormatChoice({ format, demo }: { format: TimeFormat; demo: boolean }) {
  const router = useRouter()
  const id = useId()
  const [current, setCurrent] = useState(format)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(value: string) {
    if (pending || !isTimeFormat(value) || value === current) return
    const previous = current
    setCurrent(value)
    setPending(true)
    setError(null)
    const outcome = await changing(demo, () => savePreference("timeFormat", value))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setCurrent(previous)
      setError(failure)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup value={current} onValueChange={choose} aria-busy={pending} aria-label="Time format" className="gap-1">
        {CHOICES.map((choice) => (
          <div key={choice.value} className="flex items-center gap-3 py-1.5">
            <RadioGroupItem id={`${id}-${choice.value}`} value={choice.value} />
            <Label htmlFor={`${id}-${choice.value}`} className="cursor-pointer text-base">
              {choice.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

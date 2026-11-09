"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { isPlatformLanguage, type PlatformLanguage } from "@pbgo/accounts"
import { setLanguage } from "@pbgo/accounts/set-language"
import { trackClient } from "@pbgo/analytics/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { LanguageFlag } from "@/components/language-flag"

/** A language of the platform as the picker lists it: its name in that language, and its name in English beside it. */
export type LanguageOption = { id: PlatformLanguage; native: string; english: string }

/** What the picker shows for a language: its flag and its name in that language at the left, and the English name, quiet, at the right. */
function Names({ option }: { option: LanguageOption }) {
  return (
    <span className="flex w-full items-center justify-between gap-6">
      <span className="flex min-w-0 items-center gap-3">
        <LanguageFlag language={option.id} />
        <span lang={option.id} className="truncate">
          {option.native}
        </span>
      </span>
      {option.english !== option.native && <span className="text-muted-foreground">{option.english}</span>}
    </span>
  )
}

/**
 * The language picker of the settings, across the width of the page: the platform's languages, each with its flag, in its own language and with its English name beside it, English first. The choice goes through the one setter of `@pbgo/accounts` (the
 * cookie the server reads, and the account), then the page is drawn again. The new language shows at once and goes back to the old one if the account could not be written. The names are given, not found: the list is only drawn once
 * opened, and the server has to draw the picker with its language in it (the English names come from the server too, so that the browser never draws a name of its own for the same language). The picker is not disabled while the language is
 * kept, since a control that is disabled drops the focus of a keyboard: a choice made meanwhile is left for the next one (`aria-busy` says it), and the spinner stands inside the trigger so that nothing moves.
 */
export function LanguagePicker({ language, options }: { language: PlatformLanguage; options: readonly LanguageOption[] }) {
  const router = useRouter()
  const id = useId()
  const [current, setCurrent] = useState(language)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const chosen = options.find((option) => option.id === current)

  async function choose(value: string) {
    if (pending || !isPlatformLanguage(value) || value === current) return
    const previous = current
    setCurrent(value)
    setPending(true)
    setFailed(false)
    const change = await setLanguage(value)
    setPending(false)
    if (change === "failed") {
      setCurrent(previous)
      setFailed(true)
      return
    }
    trackClient("language_changed", { from: previous, to: value })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Select value={current} onValueChange={choose}>
          <SelectTrigger id={id} aria-label="Language" aria-busy={pending} className="w-full px-4 data-[size=default]:h-11 *:data-[slot=select-value]:flex-1">
            <SelectValue>{chosen && <Names option={chosen} />}</SelectValue>
          </SelectTrigger>
          <SelectContent position="popper" align="start" className="max-h-80">
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id} textValue={option.native} className="*:[span]:last:flex-1">
                <Names option={option} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending && <Spinner className="pointer-events-none absolute top-1/2 right-11 -translate-y-1/2" />}
      </div>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>Your language could not be saved. Try again.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

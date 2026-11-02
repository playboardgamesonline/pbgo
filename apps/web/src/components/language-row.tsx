"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { PLATFORM_LANGUAGES, PLATFORM_LANGUAGE_NAMES, isPlatformLanguage, type PlatformLanguage } from "@pbgo/accounts"
import { setLanguage } from "@pbgo/accounts/set-language"
import { trackClient } from "@pbgo/analytics/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Item, ItemActions, ItemContent, ItemTitle } from "@pbgo/ui/platform/item"
import { Label } from "@pbgo/ui/platform/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { Spinner } from "@pbgo/ui/platform/spinner"

/**
 * The Language row of the account's page: the platform's languages, each in its own language, English first. The choice goes through the one setter of `@pbgo/accounts` (the
 * cookie the server reads, and the account), then the page is drawn again. The new language shows at once and goes back to the old one if the account could not be written.
 */
export function LanguageRow({ language }: { language: PlatformLanguage }) {
  const router = useRouter()
  const [current, setCurrent] = useState(language)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function choose(value: string) {
    if (!isPlatformLanguage(value) || value === current) return
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
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>
            <Label htmlFor="language-row">Language</Label>
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          {pending && <Spinner />}
          <Select value={current} onValueChange={choose} disabled={pending}>
            <SelectTrigger id="language-row" className="w-48">
              {/* The name is given, not found: the list is only drawn once opened, and the server has to draw the picker with its language in it */}
              <SelectValue>
                <span lang={current}>{PLATFORM_LANGUAGE_NAMES[current]}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PLATFORM_LANGUAGES.map((option) => (
                <SelectItem key={option.id} value={option.id} lang={option.id}>
                  {option.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ItemActions>
      </Item>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>Your language could not be saved. Try again.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

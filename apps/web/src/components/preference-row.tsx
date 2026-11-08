"use client"

import { useId, useState } from "react"
import type { PreferenceName } from "@pbgo/accounts"
import { savePreference } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { Label } from "@pbgo/ui/platform/label"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { Switch } from "@pbgo/ui/platform/switch"
import { changing, failureOf } from "@/lib/settings-change"

/**
 * A preference of the account as a row: what it is, a line that says what it does and a switch. The new choice shows at once and goes back to the old one, with a sentence, if the account could not be written (`savePreference`: one key of the
 * account's metadata for each preference, the others untouched). It is the same row for every preference of the notifications and the privacy pages, so that none has a look of its own.
 */
export function PreferenceRow({ name, title, description, initial, demo }: { name: PreferenceName; title: string; description: string; initial: boolean; demo: boolean }) {
  const id = useId()
  const [on, setOn] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(next: boolean) {
    const previous = on
    setOn(next)
    setPending(true)
    setError(null)
    const outcome = await changing(demo, () => savePreference(name, next))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setOn(previous)
      setError(failure)
    }
  }

  return (
    <>
      <Item>
        <ItemContent>
          <ItemTitle>
            <Label htmlFor={id}>{title}</Label>
          </ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          {pending && <Spinner />}
          <Switch id={id} checked={on} onCheckedChange={choose} disabled={pending} />
        </ItemActions>
      </Item>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  )
}

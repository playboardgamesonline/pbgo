"use client"

import { useCallback, useState, type FormEvent } from "react"
import { useProfileOf } from "@pbgo/core/lib/profile"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Field, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"

// What it takes to sit down at a table of a game from the hub's page (PLT-106). A visitor who is signed in sits down as their account: the server takes its name and its picture, and the page tells it nothing. A guest sits down under a
// nickname, which they are asked once and the device remembers for the game (`<slug>:profile`, the key the game's own screens used, so a player keeps the nickname they had). `sitDown` answers who sits down, or null when the guest gave up.

/** What is told of the person who sits down: nothing for an account, the nickname for a guest. */
export type SitDownProfile = { nickname?: string }

function NicknameDialog({ open, onSubmit, onCancel }: { open: boolean; onSubmit: (nickname: string) => void; onCancel: () => void }) {
  const [nickname, setNickname] = useState("")
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (nickname.trim()) onSubmit(nickname.trim())
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Choose a nickname</DialogTitle>
            <DialogDescription>The other players see it at the table.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="sit-down-nickname">Nickname</FieldLabel>
            <Input id="sit-down-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} autoComplete="nickname" autoFocus />
          </Field>
          <DialogFooter>
            <Button type="submit" size="lg" disabled={!nickname.trim()}>
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** `sitDown()` for the button that opens, joins or sits a visitor at a table of `slug`, and the `dialog` to render beside it (the guest's nickname). */
export function useSitDown(slug: string, signedIn: boolean) {
  const { profile, setProfile } = useProfileOf(slug)
  const [asking, setAsking] = useState<((nickname: string | null) => void) | null>(null)

  const sitDown = useCallback((): Promise<SitDownProfile | null> => {
    if (signedIn) return Promise.resolve({})
    const nickname = profile.nickname.trim()
    if (nickname) return Promise.resolve({ nickname })
    return new Promise((resolve) => setAsking(() => (answer: string | null) => resolve(answer === null ? null : { nickname: answer })))
  }, [signedIn, profile.nickname])

  const dialog = (
    <NicknameDialog
      open={asking !== null}
      onSubmit={(nickname) => {
        setProfile({ nickname })
        asking?.(nickname)
        setAsking(null)
      }}
      onCancel={() => {
        asking?.(null)
        setAsking(null)
      }}
    />
  )
  return { sitDown, dialog }
}

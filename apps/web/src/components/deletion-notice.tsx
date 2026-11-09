"use client"

import { useState } from "react"
import Link from "next/link"
import { deletionDate } from "@pbgo/accounts"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { SettingsDialog } from "@/components/settings-dialog"
import { leaveTo, postDeletion } from "@/lib/account-deletion"

/**
 * What the sign-in page shows, in place of its form, to someone who is signed in to an account that is on hold (PLT-36): the account will be deleted on `deletionAt`, and they can keep it or delete it now. Everything else on the site takes
 * such an account for a visitor (`getAccount`), so this is where it is looked after. "Keep my account" is `POST /api/hub/account/deletion`, intent `keep`, and a whole page load takes the member on to `next`, now that their cookies are those of
 * an account that is not on hold. "Delete it now" asks once more, then deletes the account with the feedback sent with its address (intent `now`), and the card says goodbye. "Sign out" is the site's own sign-out. The demo account
 * (`demo`) is in no database: its buttons send it to the demo routes of development.
 */
export function DeletionNotice({ deletionAt, next, demo }: { deletionAt: string; next: string; demo: boolean }) {
  const [pending, setPending] = useState<"keep" | "now" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [gone, setGone] = useState(false)

  async function keep() {
    setError(null)
    if (demo) {
      leaveTo(`/auth/demo?next=${encodeURIComponent(next)}`)
      return
    }
    setPending("keep")
    const result = await postDeletion({ intent: "keep" })
    if (!result.ok) {
      setPending(null)
      setError(result.message)
      return
    }
    leaveTo(next)
  }

  async function deleteNow() {
    setError(null)
    if (demo) {
      leaveTo("/auth/demo?off=1")
      return
    }
    setPending("now")
    const result = await postDeletion({ intent: "now" })
    setPending(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setAsking(false)
    setGone(true)
  }

  const frame = "w-full max-w-md rounded-4xl border glass p-8 shadow-float"

  if (gone) {
    return (
      <section aria-labelledby="deletion-title" className={frame}>
        <h1 id="deletion-title" className="font-heading text-3xl">
          Your account is deleted
        </h1>
        <p className="mt-2 text-muted-foreground">Your profile, your totals and your ranks are gone, and you are signed out. The games you played stay, without your name or your picture. Thank you for playing.</p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/">Back to the home</Link>
        </Button>
      </section>
    )
  }

  return (
    <>
      <section aria-labelledby="deletion-title" className={frame}>
        <h1 id="deletion-title" className="font-heading text-3xl">
          Your account is waiting to be deleted
        </h1>
        <p className="mt-2 text-muted-foreground">
          It will be deleted on {deletionDate(deletionAt)}, with your profile, your totals and your ranks. The games you played stay, without your name or your picture. Until then you can keep it.
        </p>
        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <Button type="button" size="lg" className="w-full" disabled={pending !== null} onClick={keep}>
            {pending === "keep" && <Spinner data-icon="inline-start" />}
            Keep my account
          </Button>
          <Button type="button" variant="outline" size="lg" className="w-full" disabled={pending !== null} onClick={() => setAsking(true)}>
            Delete it now
          </Button>
        </div>
        <form action="/logout" method="post" className="mt-3">
          <Button type="submit" variant="ghost" size="lg" className="w-full" disabled={pending !== null}>
            Sign out
          </Button>
        </form>
      </section>
      <SettingsDialog
        open={asking}
        onOpenChange={setAsking}
        title="Delete your account now?"
        description="Your account is deleted at once, with your profile, your totals and your ranks. This cannot be undone."
        submitLabel="Delete my account"
        destructive
        pending={pending === "now"}
        error={error}
        onSubmit={deleteNow}
      />
    </>
  )
}

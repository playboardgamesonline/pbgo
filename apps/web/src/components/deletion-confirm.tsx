"use client"

import { useState } from "react"
import Link from "next/link"
import { deletionDate } from "@pbgo/accounts"
import { ACCOUNT_DELETION_GRACE_DAYS } from "@pbgo/core/lib/retention"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { leaveTo, postDeletion } from "@/lib/account-deletion"

/** What the page found out about the link before anything was confirmed: it is the one awaited (`to` is the address of the account, masked), it is not, or the database could not be asked. */
export type LinkState = { status: "good"; to: string } | { status: "invalid" } | { status: "unreadable" }

/**
 * The card of the page the link of the e-mail opens (PLT-36, `app/(hub)/auth/delete-account/page.tsx`): the last question before the account goes on hold. "Yes, delete my account" is `POST /api/hub/account/deletion`, intent `confirm`,
 * with the account and the token of the link (`link`), which the page read from its address; once it worked the card says the day the account will be deleted. A link that is not good says so, and where to ask for a new one.
 * The demo account's link (`demo`) is in no database: its button sends it to the demo account on hold, to see the sign-in page it would find.
 */
export function DeletionConfirm({ state, link, demo }: { state: LinkState; link: { user: string; token: string } | null; demo: boolean }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)

  async function confirm() {
    setError(null)
    if (demo) {
      leaveTo("/auth/demo?held=1&next=/me")
      return
    }
    if (!link) return
    setPending(true)
    const result = await postDeletion({ intent: "confirm", user: link.user, token: link.token })
    if (!result.ok) {
      setPending(false)
      setError(result.message)
      return
    }
    setDay(result.answer.scheduledFor ?? null)
    setPending(false)
  }

  const frame = "w-full max-w-md rounded-4xl border glass p-8 shadow-float"

  if (state.status !== "good") {
    return (
      <section aria-labelledby="deletion-title" className={frame}>
        <h1 id="deletion-title" className="font-heading text-3xl">
          {state.status === "invalid" ? "This link no longer works" : "We could not check this link"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {state.status === "invalid"
            ? "It has expired, it was already used, or a newer one replaced it. Nothing was deleted. To delete your account, ask for a new link in your settings."
            : "Nothing was deleted. Try again in a few minutes."}
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/me/settings/account">Open my settings</Link>
        </Button>
      </section>
    )
  }

  if (day) {
    return (
      <section aria-labelledby="deletion-title" className={frame}>
        <h1 id="deletion-title" className="font-heading text-3xl">
          Your account will be deleted
        </h1>
        <p className="mt-2 text-muted-foreground">
          It is deleted on {deletionDate(day)}, and you are signed out everywhere. Until then it is kept: sign in again if you change your mind, and you can keep it.
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/">Back to the home</Link>
        </Button>
      </section>
    )
  }

  return (
    <section aria-labelledby="deletion-title" className={frame}>
      <h1 id="deletion-title" className="font-heading text-3xl">
        Delete your account?
      </h1>
      <p className="mt-2 text-muted-foreground">
        You asked to delete the account of <span className="text-foreground">{state.to}</span>. If you confirm, it is kept for {ACCOUNT_DELETION_GRACE_DAYS} days and you are signed out everywhere. Sign in again during that time to keep it. After that it is
        deleted for good, with your profile, your totals and your ranks. The games you played stay, without your name or your picture.
      </p>
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="mt-6 flex flex-col gap-3">
        <Button type="button" variant="destructive" size="lg" className="w-full" disabled={pending} onClick={confirm}>
          {pending && <Spinner data-icon="inline-start" />}
          Yes, delete my account
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full">
          <Link href="/">No, keep it</Link>
        </Button>
      </div>
    </section>
  )
}

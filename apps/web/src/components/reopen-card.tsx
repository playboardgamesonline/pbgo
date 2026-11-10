"use client"

import { useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { postDeletion } from "@/lib/account-deletion"

/** What the page found out about the link before anything was done: it is good (`to` is the address of the account, masked, and `until` the day it works until), it is not, or the database could not be asked. */
export type LinkState = { status: "good"; to: string; until: string } | { status: "invalid" } | { status: "unreadable" }

const frame = "w-full max-w-md rounded-4xl border glass p-8 shadow-float"

/**
 * The card of the page the link of the e-mail opens (PLT-36, `app/(hub)/auth/reopen-account/page.tsx`): the account was closed by its member, and here they reopen it (`POST /api/hub/account/deletion`, intent `reopen`) or, not waiting for the
 * clean-up, delete it now (intent `now`, after a second question). Both carry the account and the token of the link (`link`), which the page read from its address. A link that is not good says so. The demo account's link (`demo`) is in no
 * database: its buttons only show the screens that follow.
 */
export function ReopenCard({ state, link, demo }: { state: LinkState; link: { user: string; token: string } | null; demo: boolean }) {
  const [step, setStep] = useState<"ask" | "reopened" | "deleted">("ask")
  const [pending, setPending] = useState<"reopen" | "now" | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(intent: "reopen" | "now") {
    setError(null)
    if (demo) {
      setConfirming(false)
      setStep(intent === "reopen" ? "reopened" : "deleted")
      return
    }
    if (!link) return
    setPending(intent)
    const result = await postDeletion({ intent, user: link.user, token: link.token })
    setPending(null)
    setConfirming(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setStep(intent === "reopen" ? "reopened" : "deleted")
  }

  if (state.status !== "good") {
    return (
      <section aria-labelledby="reopen-title" className={frame}>
        <h1 id="reopen-title" className="font-heading text-3xl">
          {state.status === "invalid" ? "This link no longer works" : "We could not check this link"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {state.status === "invalid" ? "Your account was already reopened or deleted, or the time to reopen it is over." : "Nothing changed. Try again in a few minutes."}
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </section>
    )
  }

  if (step === "reopened") {
    return (
      <section aria-labelledby="reopen-title" className={frame}>
        <h1 id="reopen-title" className="font-heading text-3xl">
          Your account is open again
        </h1>
        <p className="mt-2 text-muted-foreground">You can sign in as before.</p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </section>
    )
  }

  if (step === "deleted") {
    return (
      <section aria-labelledby="reopen-title" className={frame}>
        <h1 id="reopen-title" className="font-heading text-3xl">
          Your account is deleted
        </h1>
        <p className="mt-2 text-muted-foreground">Your profile and your personal data are erased. You can always create a new account.</p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/">Back to the home</Link>
        </Button>
      </section>
    )
  }

  return (
    <section aria-labelledby="reopen-title" className={frame}>
      <h1 id="reopen-title" className="font-heading text-3xl">
        Reopen your account?
      </h1>
      <p className="mt-2 text-muted-foreground">
        The account of <span className="text-foreground">{state.to}</span> is closed. You can reopen it until {state.until}. After that it is deleted for good, with your profile, your totals and your ranks.
      </p>
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="mt-6 flex flex-col gap-3">
        <Button type="button" size="lg" className="w-full" disabled={pending !== null} onClick={() => act("reopen")}>
          {pending === "reopen" && <Spinner data-icon="inline-start" />}
          Reopen my account
        </Button>
        <Button type="button" variant="outline" size="lg" className="w-full" disabled={pending !== null} onClick={() => setConfirming(true)}>
          Delete it now
        </Button>
      </div>
      <Dialog open={confirming} onOpenChange={(next) => pending === null && setConfirming(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account now?</DialogTitle>
            <DialogDescription>
              Your profile, your totals and your ranks are erased right away, without waiting for {state.until}. This cannot be undone. The games you played stay, without your name or your picture.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending !== null} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending !== null} onClick={() => act("now")}>
              {pending === "now" && <Spinner data-icon="inline-start" />}
              Delete it now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

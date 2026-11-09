"use client"

import { useState } from "react"
import Link from "next/link"
import { REOPEN_PATH, deletionDate, hasMailbox, maskEmail } from "@pbgo/accounts"
import { ACCOUNT_DELETION_GRACE_DAYS, accountDeletionDate } from "@pbgo/core/lib/retention"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { leaveTo, postDeletion } from "@/lib/account-deletion"
import { CONTACT } from "@/site"

/**
 * The Delete account row of the settings (PLT-36). A red button opens a window that says what deleting means, and its button deletes the account (`POST /api/hub/account/deletion`, intent `close`): the account is closed at once, the member is signed
 * out everywhere, and an e-mail holds the link that reopens it for `ACCOUNT_DELETION_GRACE_DAYS` days, then it is deleted for good (`docs/accounts.md`, "Deleting an account"). The window then says to look in the mailbox, and whatever closes it takes the
 * member to the home: they are signed out, and the page they were on is not theirs any more.
 * An account without an address that mail can reach (`hasMailbox`) cannot be closed from here, since it would have no way back: the window says so and offers to write to us instead, as the Privacy Policy keeps saying. So does a site where no
 * e-mail can leave (`available` is false: production with no key for the mail provider). The demo account of development is in no database: it is shown the same windows, nothing is closed, and the link it would receive is a page it can open.
 */
export function DeleteAccountRow({ email, demo, available }: { email: string | null; demo: boolean; available: boolean }) {
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState<{ to: string; until: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reachable = hasMailbox(email)

  function toggle(next: boolean) {
    if (pending) return
    // Once the account is closed the member is signed out: whatever closes the window leaves the page
    if (!next && closed) {
      leaveTo("/")
      return
    }
    setOpen(next)
    if (next) setError(null)
  }

  async function close() {
    if (!reachable) return
    setPending(true)
    setError(null)
    if (demo) {
      setClosed({ to: maskEmail(email), until: deletionDate(accountDeletionDate().toISOString()) })
      setPending(false)
      return
    }
    const result = await postDeletion({ intent: "close" })
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setClosed({ to: result.answer.to ?? maskEmail(email), until: deletionDate(result.answer.scheduledFor ?? accountDeletionDate().toISOString()) })
  }

  const writeToUs = (
    <Button asChild variant="default">
      <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("Delete my account")}`}>Write to us</a>
    </Button>
  )

  return (
    <>
      <Item className="border-destructive/30">
        <ItemContent>
          <ItemTitle>Delete your account</ItemTitle>
          <ItemDescription className="line-clamp-none">Erases your profile and your personal data. You have {ACCOUNT_DELETION_GRACE_DAYS} days to change your mind.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="destructive" onClick={() => toggle(true)}>
            Delete account
          </Button>
        </ItemActions>
      </Item>
      <Dialog open={open} onOpenChange={toggle}>
        <DialogContent>
          {!reachable || !available ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete your account</DialogTitle>
                <DialogDescription>
                  {!reachable
                    ? "When you delete your account we e-mail you a link to reopen it, and yours has no e-mail address. Write to us and we delete it, with what it holds: your profile and your personal data. This cannot be undone."
                    : "Deleting an account is not available right now. Try again later, or write to us and we delete it, with what it holds: your profile and your personal data."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => toggle(false)}>
                  Cancel
                </Button>
                {writeToUs}
              </DialogFooter>
            </>
          ) : closed === null ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete your account</DialogTitle>
                <DialogDescription>
                  Your account is closed right away and you are signed out everywhere. We e-mail a link to <span className="text-foreground">{maskEmail(email)}</span>: use it within {ACCOUNT_DELETION_GRACE_DAYS} days to reopen your account.
                </DialogDescription>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
                <li>After {ACCOUNT_DELETION_GRACE_DAYS} days the link stops working and your account is deleted for good: your profile, your totals and your ranks.</li>
                <li>The games you played stay, without your name or your picture.</li>
                <li>You can always create a new account.</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                What we keep, and for how long, is in the{" "}
                <Link href="/legal/privacy" className="text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </p>
              <DialogFooter>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => toggle(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" disabled={pending} onClick={close}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Delete my account
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Your account is closed</DialogTitle>
                <DialogDescription>
                  We sent a link to <span className="text-foreground">{closed.to}</span>. Use it before {closed.until} to reopen your account. After that it is deleted for good.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Nothing yet? Look in your spam folder.</p>
              {demo && (
                <p className="text-sm text-muted-foreground">
                  Development only: the demo account is in no database, so nothing was closed and no e-mail was sent.{" "}
                  <Link href={`${REOPEN_PATH}?u=demo&t=demo`} className="text-foreground underline underline-offset-4">
                    Open the page its link would open
                  </Link>
                  .
                </p>
              )}
              <DialogFooter>
                <Button type="button" onClick={() => toggle(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

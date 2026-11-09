"use client"

import { useState } from "react"
import Link from "next/link"
import { DELETION_PATH, RESEND_SECONDS, hasMailbox, maskEmail } from "@pbgo/accounts"
import { ACCOUNT_DELETION_GRACE_DAYS, ACCOUNT_DELETION_LINK_MINUTES } from "@pbgo/core/lib/retention"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { postDeletion } from "@/lib/account-deletion"
import { useCountdown } from "@/lib/use-countdown"
import { CONTACT } from "@/site"

/**
 * The Delete account row of the settings (PLT-36). A red button opens a window that says what deleting means, and its button sends the member an e-mail with a link (`POST /api/hub/account/deletion`, intent `request`): the member is
 * who holds the mailbox, which is the proof, and the page the link opens asks for a last confirmation, then the account is kept for `ACCOUNT_DELETION_GRACE_DAYS` days, signed out everywhere, before it is deleted
 * (`docs/accounts.md`, "Deleting an account"). The window then says to look in the mailbox, and offers the link again after a minute, which is as often as an address is mailed.
 * An account without an address that mail can reach (`hasMailbox`) cannot ask from here: the window says so and offers to write to us instead, as the Privacy Policy keeps saying. So does a site where no e-mail can leave
 * (`available` is false: production with no key for the mail provider). The demo account of development is in no database: it is shown the same windows, and the link it would receive is a page it can open.
 */
export function DeleteAccountRow({ email, demo, available }: { email: string | null; demo: boolean; available: boolean }) {
  const [open, setOpen] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [left, startWaiting] = useCountdown()
  const reachable = hasMailbox(email)

  function toggle(next: boolean) {
    if (pending) return
    setOpen(next)
    if (next) {
      setSentTo(null)
      setError(null)
    }
  }

  async function send() {
    setPending(true)
    setError(null)
    if (demo) {
      setSentTo(maskEmail(email ?? "ore@example.com"))
      startWaiting(RESEND_SECONDS)
      setPending(false)
      return
    }
    const result = await postDeletion({ intent: "request" })
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      if (result.code === "WAIT") startWaiting(RESEND_SECONDS)
      return
    }
    setSentTo(result.answer.to ?? (reachable ? maskEmail(email) : ""))
    startWaiting(RESEND_SECONDS)
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
          <ItemDescription className="line-clamp-none">
            Erases your profile and your personal data. We confirm it by e-mail, then keep your account for {ACCOUNT_DELETION_GRACE_DAYS} days in case you change your mind.
          </ItemDescription>
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
                    ? "Deleting an account is confirmed by e-mail, and yours has no e-mail address. Write to us and we delete it, with what it holds: your profile and your personal data. This cannot be undone."
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
          ) : sentTo === null ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete your account</DialogTitle>
                <DialogDescription>
                  We will e-mail a confirmation link to <span className="text-foreground">{maskEmail(email)}</span>. Nothing is deleted until you open it and confirm.
                </DialogDescription>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
                <li>Your account is then kept for {ACCOUNT_DELETION_GRACE_DAYS} days, and you are signed out everywhere.</li>
                <li>Sign in again during that time to keep it, or to delete it right away.</li>
                <li>After that it is deleted for good: your profile, your totals and your ranks.</li>
                <li>The games you played stay, without your name or your picture.</li>
              </ul>
              <DialogFooter>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => toggle(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={pending || left > 0} onClick={send}>
                  {pending && <Spinner data-icon="inline-start" />}
                  {left > 0 ? `Wait ${left} s` : "Send me the link"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Check your e-mail</DialogTitle>
                <DialogDescription>
                  We sent a link to <span className="text-foreground">{sentTo}</span>. It works once, for {ACCOUNT_DELETION_LINK_MINUTES === 60 ? "1 hour" : `${ACCOUNT_DELETION_LINK_MINUTES} minutes`}. Nothing is deleted until you open it and confirm.
                </DialogDescription>
              </DialogHeader>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">Nothing yet? Look in your spam folder.</p>
              {demo && (
                <p className="text-sm text-muted-foreground">
                  Development only: the demo account receives no e-mail.{" "}
                  <Link href={`${DELETION_PATH}?u=demo&t=demo`} className="text-foreground underline underline-offset-4">
                    Open the page its link would open
                  </Link>
                  .
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => toggle(false)}>
                  Close
                </Button>
                <Button type="button" variant="outline" disabled={pending || left > 0} onClick={send}>
                  {pending && <Spinner data-icon="inline-start" />}
                  {left > 0 ? `Send it again in ${left} s` : "Send it again"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

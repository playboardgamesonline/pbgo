"use client"

import type { FormEvent, ReactNode } from "react"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Spinner } from "@pbgo/ui/platform/spinner"

/**
 * The window that a change of the settings opens: a title, a line that says what is asked, the fields (`children`), what went wrong if something did, and two buttons, Cancel and the one that makes the change, which shows a spinner while the
 * change is on its way. While it is, nothing closes the window and nothing can be pressed twice. A form: Enter makes the change. `destructive` dresses the button of a change that cannot be taken back.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pending,
  error,
  destructive = false,
  submitDisabled = false,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  submitLabel: string
  pending: boolean
  error: string | null
  destructive?: boolean
  submitDisabled?: boolean
  onSubmit: () => void
  children?: ReactNode
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending) onSubmit()
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {children && <div className="grid gap-4">{children}</div>}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || submitDisabled}>
              {pending && <Spinner />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

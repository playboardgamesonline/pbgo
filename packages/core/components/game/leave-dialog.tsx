"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Spinner } from "@pbgo/ui/platform/spinner"

/** What the player leaves: a game in progress, or a table in its ready check (the only two places a table that has begun can be left from; a lobby is left from the platform's page, and a game that is over has nothing to leave). */
export type LeavePhase = "starting" | "playing"

const WORDS: Record<LeavePhase, { title: string; description: string; confirm: string }> = {
  playing: {
    title: "Leave this game?",
    description: "The others carry on without you and you cannot come back to this game. You can open or join another one right away.",
    confirm: "Leave game",
  },
  starting: {
    title: "Leave this table?",
    description: "The start is cancelled for everyone: the table goes back to the lobby without you.",
    confirm: "Leave table",
  },
}

/**
 * The window that asks a player to confirm that they leave their table, from the "Leave" row of the menu of the game (PLT-120). Leaving a game in progress cannot be undone, so it is asked; `onConfirm` does it (the leave route) and throws when
 * it fails, which the window says and stays open for. When it works the window stays as it is, busy, until the page is gone: the page that asked takes the player away.
 */
export function LeaveDialog({ open, phase, onOpenChange, onConfirm }: { open: boolean; phase: LeavePhase; onOpenChange: (open: boolean) => void; onConfirm: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const words = WORDS[phase]

  function toggle(next: boolean) {
    if (pending) return
    setError(null)
    onOpenChange(next)
  }

  async function confirm() {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
    } catch (failure) {
      setPending(false)
      setError(failure instanceof Error && failure.message ? failure.message : "Something went wrong.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{words.title}</DialogTitle>
          <DialogDescription>{words.description}</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => toggle(false)}>
            Stay
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
            {pending && <Spinner data-icon="inline-start" />}
            {words.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

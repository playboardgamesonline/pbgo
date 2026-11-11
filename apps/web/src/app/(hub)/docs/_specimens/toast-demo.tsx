"use client"

import { useState } from "react"
import { DEMO_AVATARS } from "@pbgo/accounts/demo-avatars"
import { Button } from "@pbgo/ui/platform/button"
import {
  FriendRequestReceivedToast,
  FriendRequestSentToast,
  GameInvitationToast,
  showFriendRequestReceived,
  showGameInvitation,
  type ToastPerson,
} from "@pbgo/ui/platform/person-toast"
import { toast } from "@pbgo/ui/platform/sonner"
import { TOAST_DURATION } from "@pbgo/ui/toasts"

// The live specimens of the toast page of the design docs (`docs/design`). The hub's layout mounts the toaster once, docs included: a specimen only raises toasts into it. A toast about a person is shown twice, as the card it is (its buttons answer and say so under it, one
// of them after a moment, so that the buttons are seen off while an answer is awaited) and as the toast it raises.

const NOLAN: ToastPerson = { nickname: "Nolan", tag: "6150", avatarUrl: DEMO_AVATARS.nolan }
const GAME = { name: "Courtisans", iconUrl: "/api/catalog/courtisans/icon" }

const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The width of a toast, for a card shown on the page rather than in the corner. */
const CARD = "w-96 max-w-full"

/** The plain kinds, each raised by its button, and the two things a plain toast can carry besides its message: a second line and a button. */
export function ToastKindsDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast.success("Invitation link copied")}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.info("The table opens in a minute")}>
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Your search ends in a minute")}>
        Warning
      </Button>
      <Button variant="outline" onClick={() => toast.error("The table could not be saved")}>
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          const id = toast.loading("Opening the table")
          setTimeout(() => toast.success("The table is open", { id }), 2500)
        }}
      >
        Loading
      </Button>
      <Button variant="outline" onClick={() => toast.success("Check your e-mail", { description: "We sent a link to confirm your new address." })}>
        With a second line
      </Button>
      <Button variant="outline" onClick={() => toast.error("The date of birth is needed", { action: { label: "Sign in", onClick: () => toast.dismiss() } })}>
        With a button
      </Button>
    </div>
  )
}

/** Toasts that stay until they are closed. */
export function ToastFixedDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast.info("A new version of the site is out", { fixed: true })}>
        Fixed
      </Button>
      <Button variant="outline" onClick={() => toast.warning("The tables close for maintenance", { fixed: true, description: "Games in progress finish first." })}>
        Fixed, with a second line
      </Button>
    </div>
  )
}

/** What a card says under it: the answer that was given. */
function Said({ said }: { said: string | null }) {
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {said ?? "Press a button."}
    </p>
  )
}

export function FriendRequestSentDemo() {
  const [said, setSaid] = useState<string | null>(null)
  const cancel = async () => {
    await later(600)
    setSaid("Request taken back.")
  }
  return (
    <div className="flex flex-col gap-4">
      <div className={CARD}>
        <FriendRequestSentToast person={NOLAN} onCancel={cancel} />
      </div>
      <Said said={said} />
      <div>
        <Button
          variant="outline"
          onClick={() =>
            toast.custom(
              (id) => (
                <FriendRequestSentToast
                  person={NOLAN}
                  onCancel={async () => {
                    await later(600)
                    toast.success("Request cancelled")
                  }}
                  onDone={() => toast.dismiss(id)}
                />
              ),
              { duration: TOAST_DURATION.request },
            )
          }
        >
          Raise the toast
        </Button>
      </div>
    </div>
  )
}

export function FriendRequestReceivedDemo() {
  const [said, setSaid] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <div className={CARD}>
        <FriendRequestReceivedToast
          person={NOLAN}
          onAccept={async () => {
            await later(600)
            setSaid("Accepted.")
          }}
          onDecline={async () => {
            await later(600)
            setSaid("Declined.")
          }}
        />
      </div>
      <Said said={said} />
      <div>
        <Button
          variant="outline"
          onClick={() =>
            showFriendRequestReceived({
              person: NOLAN,
              onAccept: () => void toast.success("You and Nolan#6150 are now friends."),
              onDecline: () => {},
            })
          }
        >
          Raise the toast
        </Button>
      </div>
    </div>
  )
}

export function GameInvitationDemo() {
  const [said, setSaid] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <div className={CARD}>
        <GameInvitationToast
          person={NOLAN}
          game={GAME}
          onAccept={async () => {
            await later(600)
            setSaid("Accepted.")
          }}
          onDecline={async () => {
            await later(600)
            setSaid("Declined.")
          }}
          onDismiss={() => setSaid("Dismissed, with no answer.")}
        />
      </div>
      <Said said={said} />
      <div>
        <Button
          variant="outline"
          onClick={() =>
            showGameInvitation({
              from: NOLAN,
              game: GAME,
              onAccept: () => void toast.success("Joining the table"),
              onDecline: () => {},
              onDismiss: () => void toast.info("Invitation dismissed"),
            })
          }
        >
          Raise the toast
        </Button>
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials } from "../friends"
import { timeLeft, type TableInvitation } from "../social"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { GameIcon } from "./friends-panel"

// The invitations to a table that wait for the visitor (PLT-109), at the top of the social panel over the tabs, whatever tab is open, as the search for a game is (`QueueCard`): the friend's picture, who invited them and to which game (its picture, its name) and how long it has
// left, a white button to accept (it takes them to the table) and a grey one to decline. It is drawn from what it is given and decides nothing: `onAnswer` does the work and may answer `false` (or a promise of it) when it was refused; the buttons of that row are off while
// it is answered. Nothing at all with no invitation. An invitation that is past its time says so and can only be declined.

type InvitationsCardProps = Omit<React.ComponentProps<"section">, "children"> & {
  invitations: readonly TableInvitation[]
  /** The picture of a game, from its slug. */
  gameIcon?: (slug: string) => string | undefined
  /** What the buttons do. The card has none without it. */
  onAnswer?: (invitation: TableInvitation, answer: "accept" | "decline") => void | boolean | Promise<boolean | void>
  /** The time the card counts down from, for the specimens and the tests. */
  now?: number
}

function InvitationRow({ invitation, gameIcon, onAnswer, now }: { invitation: TableInvitation; gameIcon?: (slug: string) => string | undefined; onAnswer?: InvitationsCardProps["onAnswer"]; now?: number }) {
  const [busy, setBusy] = React.useState(false)
  const left = timeLeft(invitation.expiresAt, now)
  const expired = left === "expired"
  const answer = async (which: "accept" | "decline") => {
    if (!onAnswer || busy) return
    setBusy(true)
    try {
      await onAnswer(invitation, which)
    } finally {
      setBusy(false)
    }
  }
  return (
    <li data-slot="table-invitation" className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
      <Avatar>
        {invitation.avatarUrl && <AvatarImage src={invitation.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(invitation.nickname)}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">
          <span className="ph-mask">{invitation.nickname}</span> invites you
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GameIcon name={invitation.game.name} src={gameIcon?.(invitation.game.slug)} className="size-4 shrink-0" />
          <span className="truncate">{invitation.game.name}</span>
          <span className="shrink-0">· {left}</span>
        </span>
      </p>
      {onAnswer && (
        <>
          {!expired && (
            <Button type="button" size="icon-sm" disabled={busy} aria-label={`Accept the invitation of ${invitation.nickname} to ${invitation.game.name}`} title="Accept and join the table" onClick={() => void answer("accept")}>
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            disabled={busy}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Decline the invitation of ${invitation.nickname}`}
            title="Decline"
            onClick={() => void answer("decline")}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </>
      )}
    </li>
  )
}

function InvitationsCard({ invitations, gameIcon, onAnswer, now, className, ...props }: InvitationsCardProps) {
  if (invitations.length === 0) return null
  return (
    <section data-slot="invitations-card" aria-label="Invitations to a table" className={cn("flex flex-col gap-1 rounded-2xl bg-input/50 p-1.5", className)} {...props}>
      <ul className="flex flex-col">
        {invitations.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} gameIcon={gameIcon} onAnswer={onAnswer} now={now} />
        ))}
      </ul>
    </section>
  )
}

export { InvitationsCard }
export type { InvitationsCardProps }

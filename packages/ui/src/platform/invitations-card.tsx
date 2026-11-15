"use client"

import * as React from "react"
import { Cancel01Icon, Tick02Icon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials } from "../friends"
import { timeLeft, type Invitation } from "../social"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { GameIcon } from "./friends-panel"

// What waits for the visitor's answer (PLT-109, PLT-23), at the top of the social panel over the tabs, whatever tab is open, as the search for a game is (`QueueCard`): the friend's picture, who invites them and to what, and how long it has left, a white button to accept
// and a grey one to decline. An invitation to a table says its game (its picture and its name) and takes the visitor to the table; an invitation to a group says "To join their group"; a request to join the visitor's own group says "Your group" and lets the one who asks in
// (any member of the group can answer it: the first answer is everybody's). It is drawn from what it is given and decides nothing: `onAnswer` does the work and may answer `false` (or a promise of it) when it was refused; the buttons of that row are off while
// it is answered. Nothing at all with no invitation. One that is past its time says so and can only be declined.

type InvitationsCardProps = Omit<React.ComponentProps<"section">, "children"> & {
  invitations: readonly Invitation[]
  /** The picture of a game, from its slug. */
  gameIcon?: (slug: string) => string | undefined
  /** What the buttons do. The card has none without it. */
  onAnswer?: (invitation: Invitation, answer: "accept" | "decline") => void | boolean | Promise<boolean | void>
  /** The time the card counts down from, for the specimens and the tests. */
  now?: number
}

/** What a row says and how its buttons are named, for each kind: a table, a group, or a request to join the visitor's group. */
function wordsOf(invitation: Invitation) {
  const name = invitation.nickname
  if (invitation.kind === "table") {
    return {
      lead: "invites you",
      acceptTitle: "Accept and join the table",
      accept: `Accept the invitation of ${name} to ${invitation.game.name}`,
      decline: `Decline the invitation of ${name}`,
    }
  }
  if (invitation.kind === "group") {
    return {
      lead: "invites you",
      acceptTitle: "Accept and join the group",
      accept: `Accept the invitation of ${name} to join their group`,
      decline: `Decline the invitation of ${name} to join their group`,
    }
  }
  return {
    lead: "asks to join",
    acceptTitle: "Let them join",
    accept: `Let ${name} join your group`,
    decline: `Decline the request of ${name} to join your group`,
  }
}

/** What an invitation is about, under the name of the one who sends it: the game of a table with its picture, or the group, with the icon of a group. */
function Subject({ invitation, gameIcon }: { invitation: Invitation; gameIcon?: (slug: string) => string | undefined }) {
  if (invitation.kind === "table") {
    return (
      <>
        <GameIcon name={invitation.game.name} src={gameIcon?.(invitation.game.slug)} className="size-4 shrink-0" />
        <span className="truncate">{invitation.game.name}</span>
      </>
    )
  }
  return (
    <>
      <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{invitation.kind === "group" ? "To join their group" : "Your group"}</span>
    </>
  )
}

function InvitationRow({ invitation, gameIcon, onAnswer, now }: { invitation: Invitation; gameIcon?: (slug: string) => string | undefined; onAnswer?: InvitationsCardProps["onAnswer"]; now?: number }) {
  const [busy, setBusy] = React.useState(false)
  const left = timeLeft(invitation.expiresAt, now)
  const expired = left === "expired"
  const words = wordsOf(invitation)
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
    <li data-slot="invitation" data-kind={invitation.kind} className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
      <Avatar>
        {invitation.avatarUrl && <AvatarImage src={invitation.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(invitation.nickname)}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">
          <span className="ph-mask">{invitation.nickname}</span> {words.lead}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <Subject invitation={invitation} gameIcon={gameIcon} />
          </span>
          <span className="shrink-0">{left}</span>
        </span>
      </p>
      {onAnswer && (
        <>
          {!expired && (
            <Button type="button" size="icon-sm" disabled={busy} aria-label={words.accept} title={words.acceptTitle} onClick={() => void answer("accept")}>
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            disabled={busy}
            className="text-muted-foreground hover:text-foreground"
            aria-label={words.decline}
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
    <section data-slot="invitations-card" aria-label="Invitations" className={cn("flex flex-col gap-1 rounded-2xl bg-input/50 p-1.5", className)} {...props}>
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

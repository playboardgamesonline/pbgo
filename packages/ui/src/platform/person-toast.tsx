"use client"

import * as React from "react"
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials } from "../friends"
import { TOAST_DURATION } from "../toasts"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { TOAST_SURFACE, toast } from "./sonner"

// The toasts about a person, in the platform's look: a friend request that the member sent (the button takes it back), one that came in (accept it or decline it in one press) and an invitation to a game (the one toast that stays, with the cross that dismisses it).
// Each is a group named by who it is about and what it says, so that a screen reader reads it as one thing and finds its buttons in it, and none of them takes the focus: they are reached with the pointer, with Tab, or with sonner's hotkey for the toasts (Alt+T), which also
// keeps them from going while they are read. The toast draws its own surface (`TOAST_SURFACE`) and carries the platform's variables (`platform`), so that it looks the same in the hub's toaster and in a game's, whose own theme is not the platform's.
//
// A toast does nothing itself: what a button does is the page's (`onAccept`, `onDecline`, `onCancel`), and may answer `false`, or a promise of it, for a change that was refused, which keeps the toast so that the answer can be given again; any other answer
// closes it. The buttons are off while the answer is awaited. The names are masked in a recording, as everywhere.

/** Who a toast is about: the name and the tag the platform writes everywhere (the four digits after the `#`), and their picture, or their initials when there is none. A `FriendRequest` is one. */
type ToastPerson = { nickname: string; tag: string; avatarUrl?: string | null }

/** What a button of a toast does. It may answer `false`, or a promise of it, for a change that was refused: the toast stays. Any other answer closes it. */
type ToastAnswer = () => void | boolean | Promise<boolean | void>

/** The game an invitation is to: its name, and its icon when the page has one. */
type ToastGame = { name: string; iconUrl?: string | null }

type PersonToastProps = Omit<React.ComponentProps<"div">, "children"> & {
  person: ToastPerson
  /** What happened, under the name: "Friend request sent", "wants to be your friend". */
  message: React.ReactNode
  /** A line under the message, muted: the game of an invitation. */
  detail?: React.ReactNode
  /** One button at the end of the row of the person (the Cancel of a request that was sent). */
  aside?: React.ReactNode
  /** The buttons that answer, in a row of their own under the person, the width of the toast. */
  actions?: React.ReactNode
  /** The cross at the top right corner of a toast that stays: it takes the toast away without an answer. Only a fixed toast has one. */
  onDismiss?: () => void
}

/**
 * The frame the toasts about a person share: the picture, the name with its tag, what it says and, when there is one, a line under it, then the button at the end of the row or the buttons in a row under it, and the cross at the corner of a toast that stays.
 * A group named by the name and the message. The toaster gives the toast its width: the frame fills it.
 */
function PersonToast({ person, message, detail, aside, actions, onDismiss, className, ...props }: PersonToastProps) {
  const id = React.useId()
  return (
    <div
      role="group"
      aria-labelledby={`${id}-person ${id}-message`}
      data-slot="person-toast"
      className={cn("platform relative flex w-full flex-col gap-3 group-focus-visible/toast:ring-3 group-focus-visible/toast:ring-ring/30", TOAST_SURFACE, className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{initials(person.nickname)}</AvatarFallback>
        </Avatar>
        <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", onDismiss && "pr-8")}>
          <p id={`${id}-person`} className="ph-mask truncate text-base text-foreground">
            {person.nickname}
            <span className="text-muted-foreground">#{person.tag}</span>
          </p>
          <p id={`${id}-message`} className="text-sm text-muted-foreground">
            {message}
          </p>
          {detail && <div className="text-sm text-muted-foreground">{detail}</div>}
        </div>
        {aside}
      </div>
      {actions && <div className="grid grid-cols-2 gap-2">{actions}</div>}
      {onDismiss && (
        <Button type="button" variant="ghost" size="icon-xs" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" aria-label="Dismiss" onClick={onDismiss}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      )}
    </div>
  )
}

/** The buttons of a toast that asks for an answer: one at a time is awaited, and none is pressed twice. `onDone` runs once an answer went through. */
function useAnswers(onDone?: () => void) {
  const [busy, setBusy] = React.useState(false)
  // A second press in the same frame, before the buttons are drawn off, is not an answer either
  const running = React.useRef(false)
  const answer = async (handler?: ToastAnswer) => {
    if (!handler || running.current) return
    running.current = true
    setBusy(true)
    let kept = false
    try {
      kept = (await handler()) === false
    } catch {
      // What went wrong is for the page to tell, in a toast of its own; this one stays
      kept = true
    } finally {
      running.current = false
      setBusy(false)
    }
    if (!kept) onDone?.()
  }
  return { busy, answer }
}

/** The buttons of a toast sit in its padding: they take its corner less that padding (`rounded-nested`). The one that declines or cancels is the quiet one. */
const INSIDE = "rounded-nested"
const QUIET = cn(INSIDE, "text-muted-foreground hover:text-foreground")

type AnswerProps = {
  /** Runs once an answer went through: the raiser closes the toast with it. */
  onDone?: () => void
}

/** A friend request that the member sent: the person, "Friend request sent", and the button that takes it back. `onCancel` takes the request back (and says so itself); without it the toast has no button. */
function FriendRequestSentToast({ person, onCancel, onDone, ...props }: Omit<PersonToastProps, "message" | "aside" | "actions" | "onDismiss"> & AnswerProps & { onCancel?: ToastAnswer }) {
  const { busy, answer } = useAnswers(onDone)
  return (
    <PersonToast
      person={person}
      message="Friend request sent"
      aside={
        onCancel && (
          <Button type="button" variant="secondary" size="lg" className={QUIET} aria-label={`Cancel the request to ${person.nickname}`} disabled={busy} aria-busy={busy || undefined} onClick={() => answer(onCancel)}>
            Cancel
          </Button>
        )
      }
      {...props}
    />
  )
}

/** A friend request that came in: the person, "wants to be your friend", and the two answers in one press, the check that accepts it and the cross that declines it. */
function FriendRequestReceivedToast({
  person,
  onAccept,
  onDecline,
  onDone,
  ...props
}: Omit<PersonToastProps, "message" | "aside" | "actions" | "onDismiss"> & AnswerProps & { onAccept?: ToastAnswer; onDecline?: ToastAnswer }) {
  const { busy, answer } = useAnswers(onDone)
  return (
    <PersonToast
      person={person}
      message="Wants to be your friend"
      actions={
        <>
          <Button type="button" size="lg" className={INSIDE} aria-label={`Accept ${person.nickname}`} disabled={busy} aria-busy={busy || undefined} onClick={() => answer(onAccept)}>
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} data-icon="inline-start" />
            Accept
          </Button>
          <Button type="button" variant="secondary" size="lg" className={QUIET} aria-label={`Decline ${person.nickname}`} disabled={busy} aria-busy={busy || undefined} onClick={() => answer(onDecline)}>
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} data-icon="inline-start" />
            Decline
          </Button>
        </>
      }
      {...props}
    />
  )
}

/**
 * An invitation to a game, the toast that stays: who invites, "invited you to play" and the game (with its icon when there is one), the two answers, and the cross at the top right corner, which takes the toast away without an answer (`onDismiss`).
 * The invitations to a table are PLT-109's: this is the toast they will raise, and a page gives it the person, the game and what each button does.
 */
function GameInvitationToast({
  person,
  game,
  onAccept,
  onDecline,
  onDone,
  onDismiss,
  ...props
}: Omit<PersonToastProps, "message" | "detail" | "aside" | "actions"> & AnswerProps & { game: ToastGame; onAccept?: ToastAnswer; onDecline?: ToastAnswer }) {
  const { busy, answer } = useAnswers(onDone)
  return (
    <PersonToast
      person={person}
      message="Invited you to play"
      detail={
        <span className="flex items-center gap-1.5 text-foreground">
          {/* A plain <img>: the package is framework-free, and the icon is an address of the hub's catalog */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {game.iconUrl && <img src={game.iconUrl} alt="" decoding="async" className="size-5 rounded-tile object-cover" />}
          {game.name}
        </span>
      }
      actions={
        <>
          <Button type="button" size="lg" className={INSIDE} aria-label={`Accept the invitation of ${person.nickname} to ${game.name}`} disabled={busy} aria-busy={busy || undefined} onClick={() => answer(onAccept)}>
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} data-icon="inline-start" />
            Accept
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className={QUIET}
            aria-label={`Decline the invitation of ${person.nickname} to ${game.name}`}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => answer(onDecline)}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} data-icon="inline-start" />
            Decline
          </Button>
        </>
      }
      onDismiss={onDismiss}
      {...props}
    />
  )
}

/**
 * Raises the toast of a friend request that came in, which goes by itself after a time that leaves the buttons within reach (`TOAST_DURATION.request`). An `id` makes it one toast per request: raised again, it is updated where it is. Returns the id.
 * `onAccept` and `onDecline` do the answer and say what became of it themselves (the page's toast); the toast closes once one went through.
 */
function showFriendRequestReceived({ person, onAccept, onDecline, id }: { person: ToastPerson; onAccept: ToastAnswer; onDecline: ToastAnswer; id?: string }): string | number {
  return toast.custom(
    (toastId) => <FriendRequestReceivedToast person={person} onAccept={onAccept} onDecline={onDecline} onDone={() => toast.dismiss(toastId)} />,
    { id, duration: TOAST_DURATION.request },
  )
}

/**
 * Raises the toast of an invitation to a game: it stays until the member answers it or closes it with the cross (it is `fixed`). `onAccept` and `onDecline` do the answer and say what became of it themselves; the toast closes once one went through. `onDismiss` runs when
 * it goes without an answer (the cross, a swipe, or `toast.dismiss(id)` from the page, say when the invitation was taken back), never after an answer. An `id` makes it one toast per invitation. Returns the id.
 */
function showGameInvitation({
  from,
  game,
  onAccept,
  onDecline,
  onDismiss,
  id,
}: {
  from: ToastPerson
  game: ToastGame
  onAccept: ToastAnswer
  onDecline: ToastAnswer
  onDismiss?: () => void
  id?: string
}): string | number {
  let answered = false
  return toast.custom(
    (toastId) => (
      <GameInvitationToast
        person={from}
        game={game}
        onAccept={onAccept}
        onDecline={onDecline}
        onDone={() => {
          answered = true
          toast.dismiss(toastId)
        }}
        onDismiss={() => toast.dismiss(toastId)}
      />
    ),
    {
      id,
      fixed: true,
      onDismiss: () => {
        if (!answered) onDismiss?.()
      },
    },
  )
}

export { FriendRequestReceivedToast, FriendRequestSentToast, GameInvitationToast, PersonToast, showFriendRequestReceived, showGameInvitation }
export type { ToastAnswer, ToastGame, ToastPerson }

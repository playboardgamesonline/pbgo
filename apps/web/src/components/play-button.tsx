"use client"

import { useState } from "react"
import { DiceIcon, PlayIcon, TrophyIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { AgeRefusal } from "@pbgo/accounts"
import { useAccount } from "@pbgo/accounts/client"
import { QueueButton } from "@pbgo/ui/platform/queue"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { QUEUE_MODE_HINTS, QUEUE_MODE_LABELS, type QueueMode } from "@pbgo/ui/queue"
import { leaveQueue, startSearch, useQueue, useQueueSeconds } from "@/lib/matchmaking"
import { useAgeGate } from "./age-gate"
import { useSitDown } from "./sit-down"

// The main control of a game's page: a drop-down, Normal or Ranked (each with a line that says what it is), and the button that makes the visitor look for a table of that game in the mode it shows, with a play icon at its left, "Play normal" or "Play ranked". A press sits the visitor at
// a table of the game, a public lobby that waits or one they open (`startSearch` of `lib/matchmaking.ts`, where the search is kept for every page of the hub), and the button becomes a counter of the time they wait with a cross that stops it (`QueueButton`). A visitor looks for tables
// through one search at a time: the button counts when that search has this game among its games, whichever page began it (the signed-in home searches several games at once), and the drop-down then shows the kind of that search and keeps it until it is stopped; on any other search the
// button starts a search of this game, in place of the first. The social panel shows the same wait. Normal is the one it starts on, for anybody; a ranked table is for members, and the server says so to a guest, who is offered the way to sign in, with no nickname asked for it.
// A game for adults (PLT-125) asks the visitor first: `refusal` is what the page knows of the visitor's age for this game (`AgeStates`), and a press tells a guest to sign in, a visitor who is too young that they are not old enough, and asks a member for their date of birth before
// the search begins (the server decides all the same: `guard` asks again when it says the date is missing). A guest who looks for a normal table sits down under a nickname that is asked once. A game that cannot be played yet has the drop-down and the button disabled.

/** The kinds of table, in the order the drop-down has them: the one it starts on first. */
const KINDS: readonly QueueMode[] = ["normal", "ranked"]

const ICONS: Record<QueueMode, IconSvgElement> = { normal: DiceIcon, ranked: TrophyIcon }

export function PlayButton({ slug, name, disabled, refusal = null }: { slug: string; name: string; disabled?: boolean; refusal?: AgeRefusal | null }) {
  const [mode, setMode] = useState<QueueMode>("normal")
  const queue = useQueue()
  const account = useAccount()
  const { guard, demand, fail, dialog: ageDialog } = useAgeGate()
  const { sitDown, dialog: nicknameDialog } = useSitDown(slug, account.status === "signed-in")
  const waiting = queue?.games.some((game) => game.slug === slug) ? queue : null
  const shown = waiting ? waiting.mode : mode
  const seconds = useQueueSeconds(waiting)

  async function search() {
    if (!(await demand(refusal))) return
    // A member sits down as their account and a guest under a nickname, asked once; a guest is not asked one for a ranked table, which the server refuses them
    const who = mode === "normal" ? await sitDown() : {}
    if (who === null) return
    try {
      await guard(() => startSearch([{ slug, name }], mode, who))
    } catch (error) {
      fail(error)
    }
  }

  return (
    <>
      <Select value={shown} onValueChange={(next) => setMode(next as QueueMode)} disabled={disabled || waiting !== null}>
        <SelectTrigger aria-label="Kind of table" className="w-44 text-base data-[size=default]:h-12 data-[size=default]:px-4">
          <SelectValue>
            <HugeiconsIcon icon={ICONS[shown]} strokeWidth={2} aria-hidden="true" />
            {QUEUE_MODE_LABELS[shown]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="min-w-72">
          {KINDS.map((kind) => (
            <SelectItem key={kind} value={kind} className="items-start py-2.5">
              <HugeiconsIcon icon={ICONS[kind]} strokeWidth={2} aria-hidden="true" className="mt-0.5" />
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-base">{QUEUE_MODE_LABELS[kind]}</span>
                <span className="text-sm text-muted-foreground">{QUEUE_MODE_HINTS[kind]}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <QueueButton searching={waiting !== null} seconds={seconds} disabled={disabled} onSearch={search} onCancel={leaveQueue}>
        <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
        Play {QUEUE_MODE_LABELS[shown].toLowerCase()}
      </QueueButton>
      {ageDialog}
      {nicknameDialog}
    </>
  )
}

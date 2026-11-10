"use client"

import { ArrowDown01Icon, DiceIcon, PlayIcon, TrophyIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { AgeRefusal } from "@pbgo/accounts"
import { useAccount } from "@pbgo/accounts/client"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@pbgo/ui/platform/dropdown-menu"
import { QueueButton } from "@pbgo/ui/platform/queue"
import { QUEUE_MODE_HINTS, QUEUE_MODE_LABELS, type QueueMode } from "@pbgo/ui/queue"
import { leaveQueue, startSearch, useQueue, useQueueSeconds } from "@/lib/matchmaking"
import { useAgeGate } from "./age-gate"
import { useSitDown } from "./sit-down"

// The one button of a game's page that makes the visitor look for a table of that game, "Play", with a play icon at its left and an arrow at its right. A press unrolls the two kinds of table, Normal and Ranked, each with a line that says what it is, and the one picked starts the search: it sits the visitor
// at a table of the game, a public lobby that waits or one they open (`startSearch` of `lib/matchmaking.ts`, where the search is kept for every page of the hub), and the button becomes a counter of the time they wait with a cross that stops it (`QueueButton`). A visitor looks for tables through one
// search at a time: the button counts when that search has this game among its games, whichever page and kind began it (the signed-in home searches several games at once), and on any other search the button starts a search of this game, in place of the first. The social panel shows the same wait
// and says which kind it is. Normal is for anybody; a ranked table is for members, and the server says so to a guest, who is offered the way to sign in, with no nickname asked for it. A game for adults (PLT-125) asks the visitor first: `refusal` is what the page knows of the visitor's age for this game
// (`AgeStates`), and a press tells a guest to sign in, a visitor who is too young that they are not old enough, and asks a member for their date of birth before the search begins (the server decides all the same: `guard` asks again when it says the date is missing). A guest who looks for a normal
// table sits down under a nickname that is asked once. A game that cannot be played yet has the button disabled.

/** The kinds of table, in the order the menu has them. */
const KINDS: readonly QueueMode[] = ["normal", "ranked"]

const ICONS: Record<QueueMode, IconSvgElement> = { normal: DiceIcon, ranked: TrophyIcon }

export function PlayButton({ slug, name, disabled, refusal = null }: { slug: string; name: string; disabled?: boolean; refusal?: AgeRefusal | null }) {
  const queue = useQueue()
  const account = useAccount()
  const { guard, demand, fail, dialog: ageDialog } = useAgeGate()
  const { sitDown, dialog: nicknameDialog } = useSitDown(slug, account.status === "signed-in")
  const waiting = queue?.games.some((game) => game.slug === slug) ? queue : null
  const seconds = useQueueSeconds(waiting)

  async function search(mode: QueueMode) {
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
      <QueueButton
        searching={waiting !== null}
        seconds={seconds}
        disabled={disabled}
        // A press opens the menu: it is the item picked that starts the search
        onSearch={() => {}}
        onCancel={leaveQueue}
        around={(button) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {KINDS.map((kind) => (
                <DropdownMenuItem key={kind} onSelect={() => void search(kind)} className="items-start py-2.5">
                  <HugeiconsIcon icon={ICONS[kind]} strokeWidth={2} aria-hidden="true" className="mt-0.5" />
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-base">{QUEUE_MODE_LABELS[kind]}</span>
                    <span className="text-sm text-muted-foreground">{QUEUE_MODE_HINTS[kind]}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      >
        <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
        Play
        <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
      </QueueButton>
      {ageDialog}
      {nicknameDialog}
    </>
  )
}

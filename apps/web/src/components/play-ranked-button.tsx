"use client"

import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { AgeRefusal } from "@pbgo/accounts"
import { useAccount } from "@pbgo/accounts/client"
import { QueueButton } from "@pbgo/ui/platform/queue"
import type { QueueMode } from "@pbgo/ui/queue"
import { startSearch, leaveQueue, useQueue, useQueueSeconds } from "@/lib/matchmaking"
import { useAgeGate } from "./age-gate"
import { useSitDown } from "./sit-down"

// The two buttons of a game's page that make the visitor look for a table of that game, "Play ranked", the main one, and "Play normal", beside it, each with a play icon at its left. A press sits the visitor at a table of the game, a public lobby that waits or one they open, in the mode of the
// button (`startSearch` of `lib/matchmaking.ts`, where the search is kept for every page of the hub), and the button becomes a counter of the time they wait with a cross that stops it (`QueueButton`). A visitor looks for tables through one search at a time: a button counts when
// that search is of its mode and has this game among its games, whichever page began it (the signed-in home searches several games at once), and on any other search it is the one that starts a search of this game, in place of the first. The social panel shows the same wait.
// A game for adults (PLT-125) asks the visitor first: `refusal` is what the page knows of the visitor's age for this game (`AgeStates`), and a press tells a guest to sign in, a visitor who is too young that they are not old enough, and asks a member for their date of birth before
// the search begins (the server decides all the same: `guard` asks again when it says the date is missing). A guest may look for a normal table, under a nickname that is asked once; a ranked table is for members, and the server says so to a guest, who is offered the way to sign in.
// A game that cannot be played yet has the buttons disabled.

type PlayButtonProps = { slug: string; name: string; disabled?: boolean; refusal?: AgeRefusal | null }

/** What a button of a game's page does for `mode`: the search it counts, the press that starts it and the windows it may open (the date of birth, the nickname of a guest). */
function usePlay(mode: QueueMode, { slug, name, refusal = null }: Pick<PlayButtonProps, "slug" | "name" | "refusal">) {
  const queue = useQueue()
  const account = useAccount()
  const { guard, demand, fail, dialog: ageDialog } = useAgeGate()
  const { sitDown, dialog: nicknameDialog } = useSitDown(slug, account.status === "signed-in")
  const waiting = queue?.mode === mode && queue.games.some((game) => game.slug === slug) ? queue : null
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

  return {
    waiting,
    seconds,
    search,
    dialogs: (
      <>
        {ageDialog}
        {nicknameDialog}
      </>
    ),
  }
}

/** The main button of a game's page, "Play ranked": a table that counts for the visitor's rank, with no helpers, for members. */
export function PlayRankedButton({ slug, name, disabled, refusal }: PlayButtonProps) {
  const { waiting, seconds, search, dialogs } = usePlay("ranked", { slug, name, refusal })
  return (
    <>
      <QueueButton searching={waiting !== null} seconds={seconds} disabled={disabled} onSearch={search} onCancel={leaveQueue}>
        <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
        Play ranked
      </QueueButton>
      {dialogs}
    </>
  )
}

/** The second button of a game's page, "Play normal": a table that does not change the visitor's rank, for anybody. */
export function PlayNormalButton({ slug, name, disabled, refusal }: PlayButtonProps) {
  const { waiting, seconds, search, dialogs } = usePlay("normal", { slug, name, refusal })
  return (
    <>
      <QueueButton variant="secondary" searching={waiting !== null} seconds={seconds} disabled={disabled} onSearch={search} onCancel={leaveQueue}>
        <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
        Play normal
      </QueueButton>
      {dialogs}
    </>
  )
}

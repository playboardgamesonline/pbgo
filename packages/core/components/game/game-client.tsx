"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useIdentifyPlayer } from "@pbgo/analytics/client"
import { Button } from "@pbgo/ui/platform/button"
import { PrimaryButton, Screen, Paragraph } from "../home/screen"
import { useApi, useBinding } from "../../lib/binding-context"
import { gamePath, tablePath } from "../../lib/site-url"
import { useLiveGame } from "../../lib/use-live-game"
import { useText } from "../skin-provider"
import { LeaveDialog } from "./leave-dialog"
import { BoardEntry } from "./ready-screen"
import { StartScreen } from "./start-screen"

/** How long the words of a ready check that fell through stay on the screen before the page goes back to the table, in milliseconds */
const FAILED_MS = 3500

/**
 * A table of the game, `/<slug>/game/<code>`: its board once it is started, behind the platform's start screen while the boards load and the players get ready (`BoardEntry`, PLT-107). A table is opened, joined and started on the platform's page of the game (PLT-106), so this
 * page has no lobby: the server sends the link of a table that waits to the platform (`GamePage`), and a table that is read as waiting here, a moment after it was not (the page was drawn from an older read), is sent there too, after a few words when it
 * was in its ready check (the players who were not ready are unseated, the others are back at the table). What is left is the board, a spinner while it loads, and the two screens of a table that has no board for the visitor: one that does not exist,
 * and one that started without them.
 *
 * "Leave" in the menu of the game really leaves (PLT-120): a table in its ready check or a game in progress asks first (`LeaveDialog`), then tells the server (the leave route: the seat is played from then on, and the player may open another
 * game at once), then takes the player to the platform's page of the game; a game that is over has nothing to leave, so the player is taken there at once.
 */
export function GameClient({ code, data }: { code: string; data?: unknown }) {
  const router = useRouter()
  const t = useText()
  const { SLUG, Game } = useBinding()
  const api = useApi()
  const { game, receivedAt, error, apply, reload } = useLiveGame(code)
  const [asking, setAsking] = useState(false)
  // The player has left: the screen goes on saying so until the page is gone, instead of showing the table as one they do not sit at
  const [left, setLeft] = useState(false)
  useIdentifyPlayer(game?.meId ?? null)
  const waiting = game?.status === "lobby"
  // The table was in its ready check when this page saw it: if it is back in the lobby, the check fell through
  const [sawCheck, setSawCheck] = useState(false)
  if (!sawCheck && game?.status === "starting") setSawCheck(true)
  const fellThrough = waiting && sawCheck

  useEffect(() => {
    if (!waiting) return
    if (!fellThrough) {
      router.replace(tablePath(SLUG, code))
      return
    }
    const timer = setTimeout(() => router.replace(tablePath(SLUG, code)), FAILED_MS)
    return () => clearTimeout(timer)
  }, [waiting, fellThrough, router, SLUG, code])

  if (left) return <StartScreen title="Leaving the table" busy />

  if (Game && game && game.meId && game.status !== "lobby" && game.view) {
    const phase = game.status === "starting" ? "starting" : "playing"
    return (
      <>
        <BoardEntry game={game} receivedAt={receivedAt} reload={reload} data={data} onUpdate={apply} onLeave={() => (game.status === "over" ? router.push(gamePath(SLUG)) : setAsking(true))} />
        <LeaveDialog
          open={asking}
          phase={phase}
          onOpenChange={setAsking}
          onConfirm={async () => {
            await api.leave(code)
            setLeft(true)
            router.push(gamePath(SLUG))
          }}
        />
      </>
    )
  }

  const backButton = <PrimaryButton onClick={() => router.push(gamePath(SLUG))}>{t("backHome")}</PrimaryButton>

  if (error)
    return (
      <Screen cta={backButton}>
        <Paragraph>{t("gameNotFound", { code })}</Paragraph>
      </Screen>
    )

  if (fellThrough)
    return (
      <StartScreen title="The game did not start" subtitle="Not everyone was ready in time. Back to the table in a moment.">
        <Button onClick={() => router.replace(tablePath(SLUG, code))}>Back to the table</Button>
      </StartScreen>
    )

  // A game that ended a while ago has no board: the table lets go of its state a day after its last write (`FINISHED_STATE_RETENTION_HOURS`), and what the game was stays as a result
  if (game?.status === "over" && !game.view)
    return (
      <StartScreen title="This game is over" subtitle="The table is closed.">
        <Button onClick={() => router.replace(gamePath(SLUG))}>Back to the game</Button>
      </StartScreen>
    )

  // The table is being read, it is on its way to the platform's page, or the visitor sits at it and its board is about to be drawn: the platform's screen, which the start screen goes on with
  if (!game || waiting || game.meId) return <StartScreen title="Loading the table" busy />

  return (
    <Screen cta={backButton}>
      <Paragraph>{t("alreadyStarted")}</Paragraph>
    </Screen>
  )
}

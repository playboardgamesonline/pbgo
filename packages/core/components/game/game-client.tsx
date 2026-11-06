"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useIdentifyPlayer } from "@pbgo/analytics/client"
import { Button } from "@pbgo/ui/platform/button"
import { PrimaryButton, Screen, Paragraph } from "../home/screen"
import { useBinding } from "../../lib/binding-context"
import { gamePath, tablePath } from "../../lib/site-url"
import { useLiveGame } from "../../lib/use-live-game"
import { useText } from "../skin-provider"
import { BoardEntry } from "./ready-screen"
import { StartScreen } from "./start-screen"

/** How long the words of a ready check that fell through stay on the screen before the page goes back to the table, in milliseconds */
const FAILED_MS = 3500

/**
 * A table of the game, `/<slug>/game/<code>`: its board once it is started, behind the platform's start screen while the boards load and the players get ready (`BoardEntry`, PLT-107). A table is opened, joined and started on the platform's page of the game (PLT-106), so this
 * page has no lobby: the server sends the link of a table that waits to the platform (`GamePage`), and a table that is read as waiting here, a moment after it was not (the page was drawn from an older read), is sent there too, after a few words when it
 * was in its ready check (the players who were not ready are unseated, the others are back at the table). What is left is the board, a spinner while it loads, and the two screens of a table that has no board for the visitor: one that does not exist,
 * and one that started without them.
 */
export function GameClient({ code, data }: { code: string; data?: unknown }) {
  const router = useRouter()
  const t = useText()
  const { SLUG, Game } = useBinding()
  const { game, receivedAt, error, apply, reload } = useLiveGame(code)
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

  if (Game && game && game.meId && game.status !== "lobby" && game.view) {
    return <BoardEntry game={game} receivedAt={receivedAt} reload={reload} data={data} onUpdate={apply} onLeave={() => router.push(gamePath(SLUG))} />
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

  // The table is being read, it is on its way to the platform's page, or the visitor sits at it and its board is about to be drawn: the platform's screen, which the start screen goes on with
  if (!game || waiting || game.meId) return <StartScreen title="Loading the table" busy />

  return (
    <Screen cta={backButton}>
      <Paragraph>{t("alreadyStarted")}</Paragraph>
    </Screen>
  )
}

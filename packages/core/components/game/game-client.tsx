"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useIdentifyPlayer } from "@pbgo/analytics/client"
import { PrimaryButton, CodeField, Screen, Paragraph } from "../home/screen"
import { useBinding } from "../../lib/binding-context"
import { gamePath, tablePath } from "../../lib/site-url"
import { useLiveGame } from "../../lib/use-live-game"
import { useText } from "../skin-provider"

/**
 * A table of the game, `/<slug>/game/<code>`: its board once it is started. A table is opened, joined and started on the platform's page of the game (PLT-106), so this page has no lobby: the server sends the link of a table that waits to the
 * platform (`GamePage`), and a table that is read as waiting here, a moment after it was not (the page was drawn from an older read), is sent there too. What is left is the board, a spinner while it loads, and the two screens of a
 * table that has no board for the visitor: one that does not exist, and one that started without them.
 */
export function GameClient({ code, data }: { code: string; data?: unknown }) {
  const router = useRouter()
  const t = useText()
  const { SLUG, Game } = useBinding()
  const { game, error, apply } = useLiveGame(code)
  useIdentifyPlayer(game?.meId ?? null)
  const waiting = game?.status === "lobby"

  useEffect(() => {
    if (waiting) router.replace(tablePath(SLUG, code))
  }, [waiting, router, SLUG, code])

  if (Game && game && game.meId && game.status !== "lobby" && game.view) {
    return <Game game={game} data={data} onUpdate={apply} onLeave={() => router.push(gamePath(SLUG))} />
  }

  const backButton = <PrimaryButton onClick={() => router.push(gamePath(SLUG))}>{t("backHome")}</PrimaryButton>

  if (error)
    return (
      <Screen cta={backButton}>
        <Paragraph>{t("gameNotFound", { code })}</Paragraph>
      </Screen>
    )

  // The table is being read, it is on its way to the platform's page, or the visitor sits at it and its board is about to be drawn
  if (!game || waiting || game.meId)
    return (
      <Screen below={<CodeField value={code} />}>
        <Loader2Icon className="mt-[6vh] size-8 animate-spin text-accent-game" />
      </Screen>
    )

  return (
    <Screen cta={backButton}>
      <Paragraph>{t("alreadyStarted")}</Paragraph>
    </Screen>
  )
}

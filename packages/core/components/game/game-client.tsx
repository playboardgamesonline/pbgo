"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PrimaryButton, CodeField, NicknameField, Screen, Paragraph } from "../home/screen"
import { Game } from "@pbgo/binding-ui"
import { api, gameLink } from "../../lib/api"
import { useProfile } from "../../lib/profile"
import { useLiveGame } from "../../lib/use-live-game"
import { LobbyButton, PlayerList } from "../lobby/lobby"
import { GameOptions } from "../lobby/game-options"
import { useText } from "../skin-provider"

export function GameClient({ code, data }: { code: string; data?: unknown }) {
  const router = useRouter()
  const t = useText()
  const { game, error, apply } = useLiveGame(code)
  const { profile, setProfile, ready, valid } = useProfile()
  const [autoJoin, setAutoJoin] = useState<"idle" | "pending" | "failed" | "manual">("idle")
  const isGuest = !!game && ready && game.meId === null && game.status === "lobby"
  if (isGuest && !valid && autoJoin === "idle") setAutoJoin("manual")
  const shouldAutoJoin = isGuest && valid && (autoJoin === "idle" || autoJoin === "pending")

  async function join() {
    try {
      apply(await api.join(code, profile))
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  }

  useEffect(() => {
    if (!shouldAutoJoin || autoJoin !== "idle") return
    void Promise.resolve()
      .then(() => setAutoJoin("pending"))
      .then(join)
      .then((ok) => !ok && setAutoJoin("failed"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoJoin, autoJoin])

  async function leave() {
    if (game?.status === "lobby" && game.meId) await api.leave(code).catch(() => null)
    router.push("/")
  }

  if (game && game.meId && game.status !== "lobby" && game.view) {
    return <Game game={game} data={data} onUpdate={apply} onLeave={() => router.push("/")} />
  }

  const link = typeof window === "undefined" ? "" : gameLink(code)
  const backButton = <PrimaryButton onClick={leave}>{t("backHome")}</PrimaryButton>

  if (error)
    return (
      <Screen cta={backButton}>
        <Paragraph>{t("gameNotFound", { code })}</Paragraph>
      </Screen>
    )

  if (!game || !ready || shouldAutoJoin || (game.status !== "lobby" && game.meId))
    return (
      <Screen below={<CodeField value={code} />}>
        <Loader2Icon className="mt-[6vh] size-8 animate-spin text-accent-game" />
      </Screen>
    )

  if (game.meId === null && game.status !== "lobby")
    return (
      <Screen cta={backButton}>
        <Paragraph>{t("alreadyStarted")}</Paragraph>
      </Screen>
    )

  if (game.meId === null)
    return (
      <Screen
       
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valid) {
            toast.error(t("chooseNickname"))
            return
          }
          setAutoJoin("pending")
          if (!(await join())) setAutoJoin("failed")
        }}
        cta={<PrimaryButton busy={autoJoin === "pending"}>{t("joinGameButton")}</PrimaryButton>}
        below={<CodeField value={code} copyable={link} />}
      >
        <PlayerList game={game} />
        <NicknameField value={profile.nickname} onChange={(nickname) => setProfile({ nickname })} />
      </Screen>
    )

  return (
    <Screen cta={<LobbyButton game={game} onUpdate={apply} />} below={<CodeField value={code} copyable={link} />}>
      <Paragraph>{t("shareInvite")}</Paragraph>
      <PlayerList game={game} />
      <GameOptions game={game} onUpdate={apply} />
    </Screen>
  )
}

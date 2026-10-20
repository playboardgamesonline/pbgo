"use client"

import { CrownIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { SeatLabel } from "../game/seat-label"
import { PrimaryButton } from "../home/screen"
import { usePlayerColor, useSkin, useText } from "../skin-provider"
import { useApi } from "../../lib/binding-context"
import { useSiteSettings } from "../settings-provider"
import type { PublicGame } from "../../lib/game-types"

/**
 * Host pictogram: the skin's image (a mask tinted with the current color), else a crown. `className` replaces the default
 * classes; `size` only swaps the default size (a `size-*` class).
 */
export function HostIcon({ className, size }: { className?: string; size?: string }) {
  const { hostIcon } = useSkin()
  const t = useText()
  if (!hostIcon) return <CrownIcon aria-label={t("host")} className={className ?? size ?? "size-6"} />
  return (
    <span
      aria-label={t("host")}
      role="img"
      className={className ?? `inline-block ${size ?? "size-7"} shrink-0 bg-current`}
      style={{ maskImage: `url(${hostIcon})`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }}
    />
  )
}

export function PlayerList({ game }: { game: PublicGame }) {
  const { maxPlayers } = useSiteSettings()
  const t = useText()
  const color = usePlayerColor()
  return (
    <div className="mt-[4vh] flex w-full max-w-md flex-col items-center">
      <p className="mb-2 text-sm text-foreground/50 tabular-nums">
        {t("playerCount", { count: game.players.length, max: maxPlayers })}
      </p>
      <ul className="flex w-full flex-col items-center gap-1.5">
        <AnimatePresence>
          {game.players.map((j, i) => (
            <motion.li
              key={j.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center font-display text-2xl font-black tracking-[0.12em] uppercase [text-shadow:0_1px_6px_rgb(0_0_0/50%)]"
            >
              <SeatLabel
                nickname={j.nickname}
                color={color(i)}
                imageUrl={j.avatarUrl}
                className="gap-2.5"
                corner={
                  j.id === game.hostId ? (
                    <span className="text-accent-game drop-shadow-[0_1px_2px_rgb(0_0_0/70%)]">
                      <HostIcon size="size-4" />
                    </span>
                  ) : undefined
                }
              >
                {j.id === game.meId && <span className="shrink-0 text-sm font-semibold tracking-normal text-foreground/60 normal-case">{t("you")}</span>}
              </SeatLabel>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

export function LobbyButton({ game, onUpdate }: { game: PublicGame; onUpdate: (p: PublicGame) => void }) {
  const api = useApi()
  const { minPlayers } = useSiteSettings()
  const t = useText()
  const [launching, setLaunching] = useState(false)
  const isHost = game.meId === game.hostId
  const enoughPlayers = game.players.length >= minPlayers

  async function start() {
    setLaunching(true)
    try {
      onUpdate(await api.start(game.code))
    } catch (e) {
      toast.error((e as Error).message)
      setLaunching(false)
    }
  }

  if (!isHost)
    return (
      <PrimaryButton disabled busy>
        {t("waitingHost")}
      </PrimaryButton>
    )
  return (
    <PrimaryButton onClick={start} disabled={!enoughPlayers} busy={launching}>
      {enoughPlayers ? t("startButton") : t("waitingPlayers")}
    </PrimaryButton>
  )
}

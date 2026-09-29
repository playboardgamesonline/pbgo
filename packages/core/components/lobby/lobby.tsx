"use client"

import { CrownIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { PrimaryButton } from "../home/screen"
import { PLAYER_COLORS } from "../game/context"
import { api } from "../../lib/api"
import { useSiteSettings } from "../settings-provider"
import type { PublicGame } from "../../lib/game-types"

export function PlayerList({ game }: { game: PublicGame }) {
  const { maxPlayers } = useSiteSettings()
  return (
    <div className="mt-[4vh] flex w-full max-w-md flex-col items-center">
      <p className="mb-2 text-sm text-foreground/50 tabular-nums">
        {game.players.length}/{maxPlayers} joueurs
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
              className="flex items-center gap-2.5 font-display text-2xl font-black tracking-[0.12em] uppercase"
              style={{ color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
            >
              {j.id === game.hostId && <CrownIcon aria-label="Hôte" className="size-6" />}
              <span>{j.nickname}</span>
              {j.id === game.meId && <span className="text-sm font-semibold tracking-normal text-foreground/60 normal-case">(vous)</span>}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}

export function LobbyButton({ game, onUpdate }: { game: PublicGame; onUpdate: (p: PublicGame) => void }) {
  const { minPlayers } = useSiteSettings()
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
        En attente de l&apos;hôte
      </PrimaryButton>
    )
  return (
    <PrimaryButton onClick={start} disabled={!enoughPlayers} busy={launching}>
      {enoughPlayers ? "Lancer la partie" : "En attente de joueurs…"}
    </PrimaryButton>
  )
}

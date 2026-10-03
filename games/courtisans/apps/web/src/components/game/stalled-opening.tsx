"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useGame } from "@pbgo/core/components/game/context"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { useText } from "@pbgo/core/components/skin-provider"
import { api } from "@pbgo/core/lib/api"
import type { PublicGame } from "@pbgo/core/lib/game-types"

/**
 * Ouverture : si la partie n'a pas bougé depuis le délai réglé dans l'admin (60 s par défaut, comme pour un joueur absent) et que des joueurs
 * n'ont toujours pas validé leurs missions, ceux qui sont déjà prêts peuvent lancer le banquet sans eux. Il faut l'accord de TOUS les joueurs
 * prêts (compteur n/N) ; la route /banquet revérifie tout côté serveur.
 */
export function StalledOpening({ onUpdate }: { onUpdate: (g: PublicGame) => void }) {
  const t = useText()
  const { game, view, nickname } = useGame()
  const { turnTimeout } = useSiteSettings()
  const [elapsed, setElapsed] = useState(false)
  const [sending, setSending] = useState(false)

  // chaque écriture (la lecture d'un joueur) relance le compte à rebours ; les votes ne bougent pas `updatedAt`
  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), turnTimeout * 1000)
    return () => {
      clearTimeout(timer)
      setElapsed(false)
    }
  }, [game.updatedAt, turnTimeout])

  const ready = view.players.filter((p) => p.missionsRead)
  const missing = view.players.filter((p) => !p.missionsRead)
  const votes = game.takeoverVotes ?? []
  const voted = !!view.me && votes.includes(view.me.id)
  const show = elapsed && game.status === "playing" && view.phase === "missions" && !!view.me && ready.some((p) => p.id === view.me?.id) && missing.length > 0

  async function vote() {
    setSending(true)
    try {
      onUpdate(await api.custom(game.code, "banquet"))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 py-2 pr-2 pl-5 text-sm whitespace-nowrap text-foreground shadow-lg backdrop-blur"
        >
          <span>{t("missionsSkipPrompt", { names: missing.map((p) => nickname(p.id)).join(", ") })}</span>
          <button
            type="button"
            disabled={sending || voted}
            onClick={vote}
            className="h-9 cursor-pointer rounded-full bg-foreground px-4 font-display text-background transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
          >
            {voted ? t("missionsWaiting", { read: votes.length, total: ready.length }) : `${t("missionsSkipButton")} (${votes.length}/${ready.length})`}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

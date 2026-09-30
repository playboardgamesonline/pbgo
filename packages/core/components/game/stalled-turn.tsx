"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "../../lib/api"
import type { PublicGame } from "../../lib/game-types"
import { useSiteSettings } from "../settings-provider"
import { useText } from "../skin-provider"
import { useGame } from "./context"

/**
 * Joueur absent : si la partie n'a pas bougé depuis le délai réglé dans l'admin et que ce n'est pas mon tour,
 * propose aux autres de jouer à sa place (route /takeover, qui revérifie tout côté serveur).
 */
export function StalledTurn({ activePlayerId, onUpdate }: { activePlayerId: string | null; onUpdate: (g: PublicGame) => void }) {
  const t = useText()
  const { game, view, nickname } = useGame()
  const { turnTimeout } = useSiteSettings()
  const [since, setSince] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [sending, setSending] = useState(false)

  // chaque nouvelle version relance le compte à rebours
  useEffect(() => setSince(Date.now()), [game.version])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  const stalled =
    game.status === "playing" && !!activePlayerId && activePlayerId !== view.me?.id && !!view.me && now - since >= turnTimeout * 1000

  async function takeover() {
    setSending(true)
    try {
      onUpdate(await api.takeover(game.code))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {stalled && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 py-2 pr-2 pl-5 text-sm text-foreground shadow-lg backdrop-blur"
        >
          <span>{t("takeoverPrompt", { name: nickname(activePlayerId!) })}</span>
          <button
            type="button"
            disabled={sending}
            onClick={takeover}
            className="h-9 cursor-pointer rounded-full bg-foreground px-4 font-display text-background transition-transform hover:scale-105 disabled:opacity-60"
          >
            {t("takeoverButton")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

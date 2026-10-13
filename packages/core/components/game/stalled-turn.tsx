"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@pbgo/ui/utils"
import { useApi } from "../../lib/binding-context"
import type { PublicGame } from "../../lib/game-types"
import { EASE_STANDARD, fade, travel } from "../../lib/motion-preference"
import { fill } from "../../lib/skin"
import { useMotion } from "../../lib/use-motion"
import { useSiteSettings } from "../settings-provider"
import { useText } from "../skin-provider"
import { useGame } from "./context"

/**
 * Absent players: when the game has not moved for the delay set in the admin and it waits for players other than me, offers to
 * play in their place (route /takeover, which checks everything again on the server). The players are the ones the game waits
 * for (`game.takeovers`, from `GAME.waitingFor`): one button votes for all of them at once, and they are played for as soon as
 * every PRESENT player has voted, an absent one never blocks.
 *
 * `labels` replaces the default texts of a phase that needs its own wording (Courtisans' opening: "start without waiting").
 * `{names}` (everybody the game waits for) and `{name}` (the first one) are filled in.
 *
 * A pill at the top of the screen, centred; on a short viewport it moves next to the logo, clear of the ticker. It cannot grow
 * wider than that gap, so there the button sits under the prompt (two lines at most) instead of beside it.
 */
export function StalledTurn({
  onUpdate,
  labels,
}: {
  onUpdate: (g: PublicGame) => void
  /** @deprecated ignored: the players come from `game.takeovers`, which the server computes from `GAME.waitingFor` */
  activePlayerId?: string | null
  labels?: { prompt?: string; button?: string }
}) {
  const t = useText()
  const api = useApi()
  const motionMode = useMotion()
  const { game, view, nickname } = useGame()
  const { turnTimeout } = useSiteSettings()
  const [since, setSince] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [sending, setSending] = useState(false)
  const retried = useRef(false)

  const me = view.me?.id
  // the players the game waits for and that I take part in playing for: I am one of the voters required for them (never myself)
  const targets = me && game.status === "playing" ? (game.takeovers ?? []).filter((target) => target.voters.includes(me)) : []
  const first = targets[0]
  const ids = targets.map((target) => target.playerId)
  const voted = !!me && targets.length > 0 && targets.every((target) => target.votes.includes(me))
  // everyone required has voted and the game still did not move: a voter has left since (the server only plays when a vote comes in)
  const complete = voted && targets.every((target) => target.votes.length >= target.voters.length)

  // every move restarts the countdown (votes do not change `updatedAt`)
  useEffect(() => setSince(Date.now()), [game.updatedAt])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  const stalled = targets.length > 0 && now - since >= turnTimeout * 1000

  async function vote() {
    setSending(true)
    try {
      onUpdate(await api.takeover(game.code, ids))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  // Votes complete but nothing played: send mine again, once per such period, so the server counts the voters present now.
  // Silent: losing the race against a move or another voter has nothing to say, the table is up to date at the next read.
  const idsKey = ids.join(",")
  useEffect(() => {
    if (!stalled || !complete) {
      retried.current = false
      return
    }
    if (retried.current) return
    retried.current = true
    api.takeover(game.code, idsKey.split(",")).then(onUpdate, () => {})
  }, [api, game.code, idsKey, complete, onUpdate, stalled])

  const names = targets.map((target) => nickname(target.playerId)).join(", ")
  const prompt = fill(labels?.prompt ?? (targets.length > 1 ? t("waitingFor") : t("takeoverPrompt")), { names, name: first ? nickname(first.playerId) : "" })
  const label = labels?.button ?? t("takeoverButton")
  const votes = first?.votes.length ?? 0
  const total = first?.voters.length ?? 0

  return (
    <AnimatePresence>
      {stalled && (
        <motion.div
          data-hud="takeover"
          role="group"
          aria-label={prompt}
          initial={{ opacity: 0, y: -travel(motionMode, 20) }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -travel(motionMode, 20) }}
          transition={{ duration: fade(motionMode, 0.3), ease: EASE_STANDARD }}
          className={cn(
            "absolute top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 z-30 flex max-w-[calc(100vw-3rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 py-2 pr-2 pl-5 text-sm whitespace-nowrap text-foreground shadow-lg backdrop-blur",
            "short:top-[max(0.75rem,env(safe-area-inset-top))] short:left-[8.5rem] short:max-w-[calc(100vw-30rem)] short:translate-x-0 short:flex-col short:items-stretch short:gap-1.5 short:rounded-2xl short:p-2 short:text-xs",
          )}
        >
          <span className="ph-mask min-w-0 truncate short:line-clamp-2 short:px-1 short:whitespace-normal" title={prompt}>
            {prompt}
          </span>
          <button
            type="button"
            disabled={sending || voted}
            onClick={vote}
            className="h-9 shrink-0 cursor-pointer rounded-full bg-foreground px-4 font-display text-background transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 motion-reduce:transition-none motion-reduce:hover:scale-100 short:h-auto short:min-h-8 short:px-3 short:py-1 short:text-center short:text-xs short:leading-tight short:whitespace-normal"
          >
            {voted ? t("missionsWaiting", { read: votes, total }) : total > 1 ? `${label} (${votes}/${total})` : label}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

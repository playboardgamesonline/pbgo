"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import type { PublicGame } from "../../lib/game-types"
import { rematchToastId, watchRematch, type RematchWatch } from "../../lib/rematch"

/** How long a request for a rematch stays up, in milliseconds: long enough to reach its button. */
const REQUEST_MS = 12_000

/**
 * Tells the visitor when another player asks for a rematch, in a toast of the game (its toaster, in its look) with the button that agrees (`vote` is what the card's own button does, and answers whether it went through). The first read of the table tells
 * nothing: the votes that are there when the end screen opens are on the card. A visitor who agreed is told nothing, and the toasts that are up go once they have, and with the screen. Nobody who left the table is asked for anything.
 */
export function useRematchToasts(game: PublicGame, mine: boolean, vote: () => Promise<boolean>) {
  const { code, replay, players, meId } = game
  const voteRef = useRef(vote)
  const seen = useRef<RematchWatch>(null)
  const raised = useRef(new Set<string>())

  useEffect(() => {
    voteRef.current = vote
  }, [vote])

  useEffect(() => {
    const news = watchRematch(seen.current, replay, meId)
    seen.current = news.seen
    if (mine) return
    for (const id of news.tell) {
      const player = players.find((candidate) => candidate.id === id)
      if (!player || player.left) continue
      const toastId = rematchToastId(code, id)
      raised.current.add(toastId)
      toast(
        <span>
          <span className="ph-mask font-semibold">{player.nickname}</span> wants a rematch
        </span>,
        { id: toastId, duration: REQUEST_MS, action: { label: "Rematch", onClick: () => void voteRef.current() } },
      )
    }
  }, [code, replay, players, meId, mine])

  useEffect(() => {
    if (!mine) return
    for (const id of raised.current) toast.dismiss(id)
    raised.current.clear()
  }, [mine])

  useEffect(() => {
    const ids = raised.current
    return () => {
      for (const id of ids) toast.dismiss(id)
      ids.clear()
    }
  }, [])
}

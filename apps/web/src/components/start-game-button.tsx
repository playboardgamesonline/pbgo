"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LobbyMainButton } from "@pbgo/ui/platform/lobby-panel"

// The main button at the bottom of the lobby that the visitor opened: it starts the game. The game's own route does it (`POST /api/<slug>/games/<code>/start`, which the in-game lobby uses too: only the host may, once the game has its minimum of players,
// and only a table that waits), then the visitor goes into the table's page, where the game is played (another root layout, which the router loads whole). If the route refuses, because somebody left meanwhile or the table
// was started from somewhere else, the page asks again what the table is and the panel says what it now is. Until the game has its minimum of players (`needed`, the figure of the game's page; the server decides in the end) it cannot be pressed.

export function StartGameButton({ slug, code, joined, needed }: { slug: string; code: string; joined: number; needed: number | null }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const short = needed !== null && joined < needed
  return (
    <LobbyMainButton
      type="button"
      disabled={short || starting}
      title={short ? `At least ${needed} players are needed to start` : undefined}
      onClick={async () => {
        setStarting(true)
        let started = false
        try {
          started = (await fetch(`/api/${slug}/games/${code}/start`, { method: "POST" })).ok
        } catch {
          // a network failure is a refusal: the page asks again below
        }
        if (started) {
          // the game is another root layout, so the router loads the page whole, like a link from the hub to a game
          router.push(`/${slug}/game/${code}`)
          return
        }
        setStarting(false)
        router.refresh()
      }}
    >
      Start game
    </LobbyMainButton>
  )
}

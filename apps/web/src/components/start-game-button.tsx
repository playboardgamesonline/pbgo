"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createApi } from "@pbgo/core/lib/api"
import { LobbyMainButton } from "@pbgo/ui/platform/lobby-panel"
import { enterBoard } from "@/lib/table-door"
import { useAgeGate } from "./age-gate"

// The main button at the bottom of the lobby that the visitor opened: it starts the game. The game's own route does it (`POST /api/<slug>/games/<code>/start`: only the host may, once the game has its minimum of players, and only a table
// that waits), then the visitor is taken to the table's board (`enterBoard`), where the game is played; the other seats are taken there by the watcher of the table (`TableSync`). If the route refuses, because somebody left meanwhile or the
// table was started from somewhere else, the page says why and asks again what the table is. Until the game has its minimum of players (`needed`, the figure of the game's page; the server decides in the end) it cannot be pressed.

export function StartGameButton({ slug, code, joined, needed }: { slug: string; code: string; joined: number; needed: number | null }) {
  const router = useRouter()
  const { fail } = useAgeGate()
  const [starting, setStarting] = useState(false)
  const short = needed !== null && joined < needed
  return (
    <LobbyMainButton
      type="button"
      disabled={short || starting}
      title={short ? `At least ${needed} players are needed to start` : undefined}
      onClick={async () => {
        setStarting(true)
        try {
          await createApi(slug).start(code)
          enterBoard(router, slug, code)
        } catch (error) {
          fail(error)
          setStarting(false)
          router.refresh()
        }
      }}
    >
      Start game
    </LobbyMainButton>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createApi } from "@pbgo/core/lib/api"
import { engineOptionsOf } from "@pbgo/core/lib/table-options"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { LobbyAccess, type LanguageOption } from "@pbgo/ui/platform/lobby-access"
import { LobbyPlayers } from "@pbgo/ui/platform/lobby-players"
import { LobbySettings, type ExpansionOption, type HelperOption, type LobbySettingsValue } from "@pbgo/ui/platform/lobby-settings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { toast } from "@pbgo/ui/platform/sonner"
import type { Pace } from "@pbgo/ui/tables"
import { cn } from "@pbgo/ui/utils"
import { messageOf } from "@/lib/table-door"

/** A game a table can be opened for, with what its settings offer: how many may play, its expansions and its helpers (the game page's own, `GamePage`). */
export type CreatableGame = {
  slug: string
  name: string
  /** How many players a table may be set for: from the game's least to its most. */
  range: { min: number; max: number }
  expansions: readonly ExpansionOption[]
  helpers: readonly HelperOption[]
}

/**
 * Create a table, on the signed-in home, the smaller of the two cards that open the play zone (a third of the row from `xl`, two fifths from `lg`): the way to play with friends, which is a game's lobby set up before it exists. It has, in this order, the game to play, how fast
 * it is played and how many may play (`LobbyPlayers`, which waits for the game: its numbers are the game's), and, once a game is chosen, what that game offers (`LobbySettings`: its expansions and its helpers), which come with the game: another game has its own, so they start again.
 * Who may join is the button at the top right, as in the lobby of a game's page (`LobbyAccess`). The one button opens the table with the game's own route (`POST /api/<slug>/games`, which sits the member down as their account) and takes them to its page
 * (`/game/<slug>/<code>`), where they share its link. The engine keeps its own options only, so the choices whose id is one of them are sent right after the table exists (`engineOptionsOf`, as `TableCreator` does), and the number of players, the speed and who may join
 * stay in the page until PLT-13's tables. The games are the ones that can be played. With none, the button says it is coming.
 */
export function HomeCreateTable({ games, languages, className }: { games: readonly CreatableGame[]; languages: readonly LanguageOption[]; className?: string }) {
  const router = useRouter()
  const [slug, setSlug] = useState("")
  // The speed is the visitor's whichever game they pick, so it is kept here; the rest of the settings start again with the game
  const [pace, setPace] = useState<Pace>("normal")
  const [settings, setSettings] = useState<LobbySettingsValue | null>(null)
  const [opening, setOpening] = useState(false)
  const game = games.find((candidate) => candidate.slug === slug)

  async function open() {
    if (!game) return
    setOpening(true)
    try {
      const api = createApi(game.slug)
      const table = await api.create({})
      // What the table was set to before it existed: the engine keeps its own options, the rest of the settings stay in the page
      const options = settings ? engineOptionsOf(settings, { expansions: game.expansions.map(({ id }) => id), helpers: game.helpers.map(({ id }) => id) }, Object.keys(table.options)) : {}
      if (Object.keys(options).length > 0) await api.options(table.code, options).catch((error) => toast.error(messageOf(error)))
      router.push(`/game/${game.slug}/${table.code}`)
    } catch (error) {
      toast.error(messageOf(error))
      setOpening(false)
    }
  }

  return (
    <Card className={cn("h-full gap-6 md:[--card-spacing:--spacing(8)]", className)}>
      <CardHeader>
        <CardTitle className="text-2xl xl:text-3xl">Create a table</CardTitle>
        <CardDescription className="text-base">Open a table, share its link and play with your friends.</CardDescription>
        {games.length > 0 && (
          <CardAction>
            <LobbyAccess languages={languages} />
          </CardAction>
        )}
      </CardHeader>
      {games.length > 0 && (
        <CardContent className="flex flex-col gap-6">
          <Select
            value={slug}
            onValueChange={(next) => {
              setSlug(next)
              setSettings(null)
            }}
            disabled={opening}
          >
            <SelectTrigger aria-label="Game" className="w-full">
              <SelectValue placeholder="Choose a game" />
            </SelectTrigger>
            <SelectContent>
              {games.map((candidate) => (
                <SelectItem key={candidate.slug} value={candidate.slug}>
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <LobbySettings
            // The settings of a game are that game's: another one starts them again, with its expansions off and its helpers on
            key={slug}
            className="border-t pt-6"
            pace={pace}
            expansions={game?.expansions}
            helpers={game?.helpers}
            afterSpeed={<LobbyPlayers range={game?.range} pending defaultCount={game?.range.max} />}
            editable
            onChange={(value) => {
              setSettings(value)
              setPace(value.pace)
            }}
          />
        </CardContent>
      )}
      <CardFooter className="mt-auto">
        {games.length > 0 ? (
          <Button size="xl" variant="secondary" className="w-full" disabled={opening || !game} onClick={open}>
            Open a table
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="xl" variant="secondary" className="w-full flex-col gap-0 disabled:opacity-100" disabled>
            <span className="flex items-center gap-2 leading-5">Open a table</span>
            <span className="text-xs leading-4 opacity-70">Coming soon</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

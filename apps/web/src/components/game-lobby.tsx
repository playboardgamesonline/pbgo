import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { LobbyDetail, LobbyPanel } from "@pbgo/ui/platform/lobby-panel"
import { LobbySettings } from "@pbgo/ui/platform/lobby-settings"
import { cn } from "@pbgo/ui/utils"
import type { Expansion, ViewerTable } from "@/lib/game-activity"
import { tableDetailProps } from "@/lib/game-activity-props"
import { LeaveLobbyButton } from "./leave-lobby-button"
import { StartGameButton } from "./start-game-button"

// The tall space on the right of a game's page, where a visitor plays: the lobby they are in, or, when they are in none, the space to open one. A lobby is a table that waits for players. Opening one is done in the game's own site (a plain <a> to
// `/<slug>`, another root layout, loaded whole): the hub knows nothing of what a game's table asks for beyond what the page reads (the expansions it has, `getExpansions`), and the choices made here are not carried to the table, since a lobby has no place
// to keep them yet. The settings of the game are at the bottom of the space, as they are in a lobby that exists (`LobbySettings`: the speed, who may find the table, the expansions as pictures with an outline for the ones chosen). A visitor's own lobby
// is the details of any table (`LobbyDetail`) with, under them, the button that starts the game for the one who opened the lobby (`StartGameButton`, which waits for enough players) or, for anybody else, one that cannot be pressed and says how many have joined of those expected, and, beside it, a secondary button to leave it (which only a lobby that waits has), with the plus of its free seats opening the menu that invites a friend or copies the link, and with settings that are theirs to set when they
// opened it (`ownTableDetail`). A game that is not live has the same space, half transparent and without a way in. A table picked in the list of the open tables takes the space's place for as long as it is picked (`OpenTables`).

const TITLE = "text-3xl md:text-4xl"

/**
 * What the panel says of the table the visitor sits at: its details as that visitor has them and, for a lobby that waits, the button that starts it (the one who opened it has it, and presses it once the game has its `minPlayers`; the others
 * have a button that cannot be pressed) and the one that leaves it. The page uses it for the space on the right and for the row of the list that is the same table.
 */
export function ownTableDetail(table: ViewerTable, slug: string, now: number | undefined, expansions: readonly Expansion[], minPlayers: number | null = null) {
  const waiting = table.status === "lobby"
  const host = waiting && table.viewerIsHost
  return {
    ...tableDetailProps(table, slug, now, true, expansions, host),
    start: host ? <StartGameButton slug={slug} code={table.code} joined={table.players.length} needed={minPlayers} /> : undefined,
    leave: waiting ? <LeaveLobbyButton slug={slug} code={table.code} /> : undefined,
  }
}

/** `expansions` are the ones the game has, which the settings offer. `minPlayers` is the least players the game needs, which the button that starts a lobby waits for. `now` is when the age of the visitor's table is counted from. */
export function GameLobby({
  slug,
  name,
  live,
  players,
  minPlayers = null,
  viewerTable,
  expansions = [],
  now,
  className,
}: {
  slug: string
  name: string
  live: boolean
  players: string | null
  minPlayers?: number | null
  viewerTable: ViewerTable | null
  expansions?: readonly Expansion[]
  now?: number
  className?: string
}) {
  if (!live) {
    return (
      <LobbyPanel aria-disabled="true" className={cn("opacity-50 lg:min-h-56", className)}>
        <CardHeader>
          <CardTitle className={TITLE}>Coming soon</CardTitle>
          <CardDescription className="text-base">You will be able to open a table of {name} here.</CardDescription>
        </CardHeader>
      </LobbyPanel>
    )
  }

  if (viewerTable) return <LobbyDetail key={viewerTable.id} {...ownTableDetail(viewerTable, slug, now, expansions, minPlayers)} className={className} />

  return (
    <LobbyPanel className={className}>
      <CardHeader>
        <CardTitle className={TITLE}>Create a game</CardTitle>
        <CardDescription className="text-base">Open a table, share its link and play with your friends.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        <LobbySettings expansions={expansions} pace="normal" visibility="public" editable className="mt-auto border-t pt-6" />
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        {players && <p className="text-sm text-muted-foreground">{players}</p>}
        <Button size="lg" className="h-12 w-full text-base" asChild>
          <a href={`/${slug}`}>
            Open a table
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
          </a>
        </Button>
      </CardFooter>
    </LobbyPanel>
  )
}

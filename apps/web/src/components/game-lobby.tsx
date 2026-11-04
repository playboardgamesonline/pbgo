import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { LobbyDetail, LobbyPanel } from "@pbgo/ui/platform/lobby-panel"
import { LobbyAccess } from "@pbgo/ui/platform/lobby-access"
import { LobbyPlayers } from "@pbgo/ui/platform/lobby-players"
import { LobbySettings, type HelperOption } from "@pbgo/ui/platform/lobby-settings"
import { playerRange } from "@pbgo/ui/tables"
import type { Expansion, ViewerTable } from "@/lib/game-activity"
import { expansionOption, LANGUAGE_OPTIONS, tableDetailProps } from "@/lib/game-activity-props"
import { LeaveLobbyButton } from "./leave-lobby-button"
import { StartGameButton } from "./start-game-button"

// The tall space on the right of a game's page, where a visitor plays: the lobby they are in, or, when they are in none, the space to open one. A lobby is a table that waits for players. Opening one is done in the game's own site (a plain <a> to
// `/<slug>`, another root layout, loaded whole): the hub knows nothing of what a game's table asks for beyond what the page reads (the expansions it has, `getExpansions`), and the choices made here are not carried to the table, since a lobby has no place
// to keep them yet. The number of players (between the game's least and most) and the settings of the game follow its head, with a hairline between, as they follow the seats in a lobby that exists (`LobbyPlayers`, `LobbySettings`: the speed, the expansions as pictures with an outline for the ones chosen, the helpers), and who may join the table is the one button at its top right (`LobbyAccess`: public or private and, for a public table, a minimum rank and a language). A visitor's own lobby
// is the details of any table (`LobbyDetail`) with, under them, the button that starts the game for the one who opened the lobby (`StartGameButton`, which waits for enough players) or, for anybody else, one that cannot be pressed and says how many have joined of those expected, and, beside it, a secondary button to leave it (which only a lobby that waits has), with the plus of its free seats opening the menu that invites a friend or copies the link, and with the number of players, the settings and the button of who may join, that are theirs to set when they
// opened it (`ownTableDetail`). A game that is not live has the same space, as it is for the others, with the settings that its game has and a button that does nothing and says "Coming soon" under its label (`live`). A table picked in the list of the open tables takes the space's place for as long as it is picked (`OpenTables`).

const TITLE = "text-3xl md:text-4xl"

/**
 * What the panel says of the table the visitor sits at: its details as that visitor has them and, for a lobby that waits, the button that starts it (the one who opened it has it, and presses it once the game has its `minPlayers`; the others
 * have a button that cannot be pressed) and the one that leaves it. The page uses it for the space on the right and for the row of the list that is the same table.
 */
export function ownTableDetail(table: ViewerTable, slug: string, expansions: readonly Expansion[], minPlayers: number | null = null, maxPlayers: number | null = null, helpers: readonly HelperOption[] = []) {
  const waiting = table.status === "lobby"
  const host = waiting && table.viewerIsHost
  return {
    ...tableDetailProps(table, slug, true, expansions, host, { min: minPlayers, max: maxPlayers }, helpers),
    start: host ? <StartGameButton slug={slug} code={table.code} joined={table.players.length} needed={minPlayers} /> : undefined,
    leave: waiting ? <LeaveLobbyButton slug={slug} code={table.code} /> : undefined,
  }
}

/** `expansions` are the ones the game has, which the settings offer. `minPlayers` is the least players the game needs, which the button that starts a lobby waits for, and `maxPlayers` the most it takes: a lobby may be set for any number between them. */
export function GameLobby({
  slug,
  live,
  minPlayers = null,
  maxPlayers = null,
  viewerTable,
  expansions = [],
  helpers = [],
  flat = false,
  className,
}: {
  slug: string
  live: boolean
  minPlayers?: number | null
  maxPlayers?: number | null
  viewerTable: ViewerTable | null
  expansions?: readonly Expansion[]
  /** The aids that a player may have while they play, which the game offers: a row each in the settings. */
  helpers?: readonly HelperOption[]
  /** The panel stands inside the container of the open tables and draws no surface of its own (`LobbyPanel`). */
  flat?: boolean
  className?: string
}) {
  // A game that is live has tables, and the visitor may sit at one: it is their lobby. A game that is not has none
  if (live && viewerTable) return <LobbyDetail key={viewerTable.id} {...ownTableDetail(viewerTable, slug, expansions, minPlayers, maxPlayers, helpers)} flat={flat} className={className} />

  const range = playerRange(minPlayers, maxPlayers)
  const open = (
    <>
      Open a table
      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
    </>
  )
  return (
    <LobbyPanel flat={flat} className={className}>
      <CardHeader>
        <CardTitle className={TITLE}>Create a table</CardTitle>
        <CardDescription className="text-base">Open a table, share its link and play with your friends.</CardDescription>
        <CardAction>
          <LobbyAccess languages={LANGUAGE_OPTIONS} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="flex flex-col gap-6 border-t pt-6">
          <LobbyPlayers range={range} defaultCount={range.max} />
          <LobbySettings expansions={expansions.map(expansionOption)} helpers={helpers} pace="normal" editable />
        </div>
      </CardContent>
      <CardFooter>
        {live ? (
          <Button size="xl" className="w-full" asChild>
            <a href={`/${slug}`}>{open}</a>
          </Button>
        ) : (
          // The way in of a game that is not live does nothing, and is lit like the others: what it would say, then, under it, that it is coming
          <Button size="xl" className="w-full flex-col gap-0 disabled:opacity-100" disabled>
            <span className="flex items-center gap-2 leading-5">{open}</span>
            <span className="text-xs leading-4 opacity-70">Coming soon</span>
          </Button>
        )}
      </CardFooter>
    </LobbyPanel>
  )
}

import type { TableSettingsInput } from "@pbgo/core/lib/table-settings"
import type { HelperOption } from "@pbgo/ui/platform/lobby-settings"
import { playerRange } from "@pbgo/ui/tables"
import type { Expansion, ViewerTable } from "@/lib/game-activity"
import { expansionOption, LANGUAGE_OPTIONS, tableDetailProps } from "@/lib/game-activity-props"
import { LeaveLobbyButton } from "./leave-lobby-button"
import { OwnLobby } from "./own-lobby"
import { StartGameButton } from "./start-game-button"
import { TableCreator } from "./table-creator"

// The tall space on the right of a game's page, where a visitor plays: the lobby they are in, or, when they are in none, the space to open one. A lobby is a table that waits for players. A table is opened and started here, on the platform (PLT-106): the space to open one is
// `TableCreator`, whose button creates the table with the game's own route, and the lobby the visitor sits at is `OwnLobby`, the details of any table (`LobbyDetail`) with, under them, the button that starts the game for the one who opened the lobby (`StartGameButton`, which waits for enough players) or, for anybody
// else, one that cannot be pressed and says how many have joined of those expected, and, beside it, a secondary button to leave it (which only a lobby that waits has), with the plus of its free seats opening the menu that invites a friend or copies the link, and with the number of players, the settings and the button of who may join,
// that are theirs to set when they opened it (`ownTableDetail`). The number of players (between the game's least and most) and the settings of the game follow the seats (`LobbyPlayers`, `LobbySettings`: the speed, the expansions as pictures with an outline for the ones chosen, the helpers), and who may join the table is the one button at its top right
// (`LobbyAccess`: public or private and, for a public table, a minimum rank and a language), all of them kept with the table (PLT-21, `OwnLobby`). A game that is not live has the same space, as it is for the others, with the settings that its game has and a button that does nothing and says "Coming soon" under its label (`live`). A table picked in the list of the
// open tables takes the space's place for as long as it is picked (`OpenTables`).

/**
 * What the panel says of the table the visitor sits at: its details as that visitor has them and, for a lobby that waits, the button that starts it (the one who opened it has it, and presses it once the game has its `minPlayers`; the others
 * have a button that cannot be pressed) and the one that leaves it. The page uses it for the space on the right and for the row of the list that is the same table.
 */
export function ownTableDetail(table: ViewerTable, slug: string, expansions: readonly Expansion[], minPlayers: number | null = null, maxPlayers: number | null = null, helpers: readonly HelperOption[] = []) {
  const waiting = table.status === "lobby"
  // The one who opened a lobby sets it and starts it, unless it is a ranked one: nothing in it is changed, and it begins when it is full
  const host = waiting && table.viewerIsHost && !table.ranked
  return {
    ...tableDetailProps(table, slug, true, expansions, host, { min: minPlayers, max: maxPlayers }, helpers),
    start: host ? <StartGameButton slug={slug} code={table.code} joined={table.players.length} needed={minPlayers} /> : undefined,
    leave: waiting ? <LeaveLobbyButton slug={slug} code={table.code} /> : undefined,
  }
}

/** `expansions` are the ones the game has, which the settings offer. `minPlayers` is the least players the game needs, which the button that starts a lobby waits for, and `maxPlayers` the most it takes: a lobby may be set for any number between them. `signedIn` is whether the visitor has an account: nobody is asked for a nickname then. */
export function GameLobby({
  slug,
  live,
  minPlayers = null,
  maxPlayers = null,
  viewerTable,
  expansions = [],
  helpers = [],
  signedIn = false,
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
  signedIn?: boolean
  /** The panel stands inside the container of the open tables and draws no surface of its own (`LobbyPanel`). */
  flat?: boolean
  className?: string
}) {
  // A game that is live has tables, and the visitor may sit at one: it is their lobby. A game that is not has none
  if (live && viewerTable) {
    const detail = ownTableDetail(viewerTable, slug, expansions, minPlayers, maxPlayers, helpers)
    const offered = { expansions: expansions.map(({ id }) => id), helpers: helpers.map(({ id }) => id) }
    // What the table is set to, as the panel starts from it: the speed is one the lobby offers, and the seats are the table's
    const table: TableSettingsInput = {
      visibility: viewerTable.visibility,
      minRank: viewerTable.minRank ?? null,
      language: viewerTable.language ?? null,
      pace: viewerTable.turnTimer === "async" ? "normal" : viewerTable.turnTimer,
      seats: viewerTable.seatsMax,
    }
    return <OwnLobby slug={slug} code={viewerTable.code} detail={detail} optionKeys={viewerTable.optionKeys ?? []} offered={offered} table={table} flat={flat} className={className} />
  }
  return (
    <TableCreator
      slug={slug}
      live={live}
      range={playerRange(minPlayers, maxPlayers)}
      expansions={expansions.map(expansionOption)}
      helpers={helpers}
      languages={LANGUAGE_OPTIONS}
      signedIn={signedIn}
      flat={flat}
      className={className}
    />
  )
}

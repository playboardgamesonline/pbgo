import { COMING_SOON } from "@/lib/coming-soon"
import type { Expansion, GameTable, ViewerTable } from "@/lib/game-activity"
import { tableDetailProps, tableEntryProps } from "@/lib/game-activity-props"
import { GameLobby, ownTableDetail } from "./game-lobby"
import { OpenTables } from "./open-tables"

// What a game's page offers right under its head, before anything else: on the left the tables that are open, the ones that wait for players, as the rows of a list (`OpenTables`, seven twelfths of the width from `lg`), and on the right a tall space
// (`GameLobby`, five twelfths): the lobby the visitor is in, or the space to open one, which gives way to the details of the row that the visitor picks. The tables being played are not listed: a visitor who sits at one finds it in the space
// (`viewerTable`). The row is as tall as the space needs on a wide screen, and no taller (the space never scrolls and has no height of its own beyond a floor of 32rem; the list of tables, which scrolls inside its card, takes the row's height and does not give it, `OpenTables`), and both cards start at the same height; on a narrow screen the space comes first, since opening a table is
// what most visitors came to do. A game that is not live has the space alone, half transparent, and no tables. On the page of a game the space is reached by name (`anchored`): the button of the head that creates a game leads to it.

/** The name by which the head of a game's page reaches the space to create a game (the `id` that `anchored` sets). */
export const CREATE_ANCHOR = "create-a-game"

/** `expansions` are the ones the game has: the settings of the space offer them, and a table says which it is played with. `minPlayers` and `maxPlayers` are the least players and the most the game takes: a lobby is set for a number between them, and `minPlayers` is the least the game needs, which the button that starts a lobby waits for. `now` is when the age of every table is counted from: the page's own (the default), or a fixed one for the docs' specimens, which are built once. */
export function GamePlay({
  slug,
  name,
  live,
  players,
  minPlayers = null,
  maxPlayers = null,
  tables,
  viewerTable,
  expansions = [],
  now,
  anchored = false,
}: {
  slug: string
  name: string
  live: boolean
  players: string | null
  minPlayers?: number | null
  maxPlayers?: number | null
  tables: readonly GameTable[]
  viewerTable: ViewerTable | null
  expansions?: readonly Expansion[]
  now?: number
  /** Give the space the name that the head's button leads to. Only the page does: a name is one per page, and the specimens show several. */
  anchored?: boolean
}) {
  const lobby = <GameLobby slug={slug} name={name} live={live} players={players} minPlayers={minPlayers} maxPlayers={maxPlayers} viewerTable={viewerTable} expansions={expansions} />

  if (!live) {
    return (
      <section aria-label={`Play ${name}`} className="grid">
        {lobby}
      </section>
    )
  }

  // What a visitor can still sit at: the tables that wait for players. The one they sit at, if it is listed, is theirs: its free seats invite, and its details are their lobby's
  const open = tables.filter((table) => table.status === "lobby")
  return (
    <section aria-label={`Play ${name}`} className="grid gap-x-4 gap-y-8 lg:grid-cols-12">
      <OpenTables
        rows={open.map((table) => {
          const mine = viewerTable !== null && viewerTable.id === table.id
          return {
            id: table.id,
            entry: tableEntryProps(table, slug, now, expansions, mine),
            detail: mine ? ownTableDetail(viewerTable, slug, expansions, minPlayers, maxPlayers) : tableDetailProps(table, slug, false, expansions),
          }
        })}
        summary={open.length > 0 ? `${open.length} waiting` : undefined}
        lobby={lobby}
        createHref={`/${slug}`}
        emptyTitle={COMING_SOON.tables.heading}
        emptyDescription={COMING_SOON.tables.description}
        lobbyId={anchored ? CREATE_ANCHOR : undefined}
      />
    </section>
  )
}

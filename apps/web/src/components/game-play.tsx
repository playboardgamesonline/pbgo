import { COMING_SOON } from "@/lib/coming-soon"
import type { Expansion, GameTable, ViewerTable } from "@/lib/game-activity"
import { tableDetailProps, tableEntryProps } from "@/lib/game-activity-props"
import { GameLobby, ownTableDetail } from "./game-lobby"
import { OpenTables } from "./open-tables"

// What a game's page offers right under its head, before anything else, in one container (`OpenTables`): on the left the tables that are open, the ones that wait for players, as the rows of a list (seven twelfths of the width from `lg`, eight from `xl`), and on the right a tall panel (`GameLobby`,
// five twelfths, four from `xl`): the lobby the visitor is in, or the space to open one, which gives way to the details of the row that the visitor picks. The visitor's own table is the first row of the list, whatever it is (a lobby they opened or joined, or a game they play), and the row that is selected is the one the
// panel shows. The other tables being played are not listed. The container is as tall as the panel needs on a wide screen, and no taller (the panel never scrolls and has no height of its own beyond a floor of 44rem; the list of tables, which scrolls inside, takes that height and does not give it); on a narrow
// screen the panel comes first, since opening a table is what most visitors came to do. A game that is not live has the panel alone, half transparent, and no tables. On the page of a game the panel is reached by name (`anchored`): the button of the head that creates a game leads to it.

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
  // In a game that is live the panel stands inside the container of the open tables, and draws no surface of its own
  const lobby = <GameLobby slug={slug} name={name} live={live} players={players} minPlayers={minPlayers} maxPlayers={maxPlayers} viewerTable={viewerTable} expansions={expansions} flat={live} />

  if (!live) {
    return (
      <section aria-label={`Play ${name}`} className="grid">
        {lobby}
      </section>
    )
  }

  // The visitor's own table, which is theirs whatever its state, then what they can still sit at: the tables that wait for players. A free seat of their own invites, and its details are their lobby's
  const own = viewerTable
    ? [
        {
          id: viewerTable.id,
          own: true,
          entry: { ...tableEntryProps(viewerTable, slug, now, expansions, true), hostedByYou: viewerTable.viewerIsHost },
          detail: ownTableDetail(viewerTable, slug, expansions, minPlayers, maxPlayers),
        },
      ]
    : []
  const open = tables.filter((table) => table.status === "lobby" && table.id !== viewerTable?.id)
  const rows = [
    ...own,
    ...open.map((table) => ({ id: table.id, entry: tableEntryProps(table, slug, now, expansions, false), detail: tableDetailProps(table, slug, false, expansions) })),
  ]
  return (
    <section aria-label={`Play ${name}`}>
      <OpenTables
        rows={rows}
        lobby={lobby}
        createHref={`/${slug}`}
        emptyTitle={COMING_SOON.tables.heading}
        emptyDescription={COMING_SOON.tables.description}
        lobbyId={anchored ? CREATE_ANCHOR : undefined}
      />
    </section>
  )
}

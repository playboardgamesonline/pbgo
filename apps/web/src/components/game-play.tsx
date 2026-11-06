import { COMING_SOON } from "@/lib/coming-soon"
import type { HelperOption } from "@pbgo/ui/platform/lobby-settings"
import { seatCount, tableAction } from "@pbgo/ui/tables"
import type { Expansion, GameTable, ViewerTable } from "@/lib/game-activity"
import { seatsOfTable, tableDetailProps, tableEntryProps } from "@/lib/game-activity-props"
import { GameLobby, ownTableDetail } from "./game-lobby"
import { OpenTables } from "./open-tables"
import { TableSync } from "./table-sync"

// What a game's page offers right under its head, before anything else, in one container (`OpenTables`): on the left the tables that are open, the ones that wait for players, as the rows of a list (seven twelfths of the width from `lg`, eight from `xl`), and on the right a tall panel (`GameLobby`,
// five twelfths, four from `xl`): the lobby the visitor is in, or the space to open one, which gives way to the details of the row that the visitor picks. The visitor's own table is the first row of the list, whatever it is (a lobby they opened or joined, or a game they play), and the row that is selected is the one the
// panel shows. The other tables being played are not listed. The container is as tall as the panel needs on a wide screen, and no taller (the panel never scrolls and has no height of its own beyond a floor of 44rem; the list of tables, which scrolls inside, takes that height and does not give it); on a narrow
// screen the panel comes first, since opening a table is what most visitors came to do. A game that is not live has the same container: its list says that the tables are coming, with no button, and its panel is the one of the others, with a button that does nothing and says "Coming soon" under its label. On the page of a game the panel is reached by name (`anchored`): the button of the head that creates a game leads to it.
// The platform is the door of the games (PLT-106): the visitor's lobby is a table of the game's own routes, opened, joined and started from the panel. The table of an invitation link (`linked`, the link `/<slug>/game/<code>` of a table that waits leads to the page of that table) is a row of the list that is picked, so the panel shows its
// details with the button that sits the visitor down at it. A table that waits, the visitor's or the invited one, is watched (`TableSync`): the people who come and go are drawn as they do, and the start takes whoever sits at it to the board.

/** The name by which the head of a game's page reaches the space to create a game (the `id` that `anchored` sets). */
export const CREATE_ANCHOR = "create-a-game"

/** `expansions` are the ones the game has: the settings of the space offer them, and a table says which it is played with. `minPlayers` and `maxPlayers` are the least players and the most the game takes: a lobby is set for a number between them, and `minPlayers` is the least the game needs, which the button that starts a lobby waits for. `now` is when the age of every table is counted from: the page's own (the default), or a fixed one for the docs' specimens, which are built once. */
export function GamePlay({
  slug,
  name,
  live,
  minPlayers = null,
  maxPlayers = null,
  tables,
  viewerTable,
  linked = null,
  expansions = [],
  helpers = [],
  signedIn = false,
  now,
  anchored = false,
}: {
  slug: string
  name: string
  live: boolean
  minPlayers?: number | null
  maxPlayers?: number | null
  tables: readonly GameTable[]
  viewerTable: ViewerTable | null
  /** The table of the invitation link the visitor opened, when it is not the one they sit at: a row that is picked, with the button that sits them down at it. */
  linked?: GameTable | null
  expansions?: readonly Expansion[]
  /** The aids that a player may have while they play, which the game offers: the settings of the lobby give each a row. */
  helpers?: readonly HelperOption[]
  /** Whether the visitor has an account: the server sits them down as it, and no nickname is asked. */
  signedIn?: boolean
  now?: number
  /** Give the space the name that the head's button leads to. Only the page does: a name is one per page, and the specimens show several. */
  anchored?: boolean
}) {
  // The panel stands inside the container of the open tables, and draws no surface of its own
  const lobby = <GameLobby slug={slug} live={live} minPlayers={minPlayers} maxPlayers={maxPlayers} viewerTable={viewerTable} expansions={expansions} helpers={helpers} signedIn={signedIn} flat />

  // The visitor's own table, which is theirs whatever its state, then what they can still sit at: the tables that wait for players. A free seat of their own invites, and its details are their lobby's. A game that is not live has no table, whoever asks
  const own = live && viewerTable
    ? [
        {
          id: viewerTable.id,
          code: viewerTable.code,
          own: true,
          entry: { ...tableEntryProps(viewerTable, slug, now, expansions, true), hostedByYou: viewerTable.viewerIsHost },
          detail: ownTableDetail(viewerTable, slug, expansions, minPlayers, maxPlayers, helpers),
        },
      ]
    : []
  const open = live ? tables.filter((table) => table.status === "lobby" && table.id !== viewerTable?.id) : []
  // The table of an invitation link, when it is not the visitor's own: a row that is picked, which the visitor may sit down at when it waits and has a seat free (`OpenTables` does it)
  const invited = live && linked && linked.id !== viewerTable?.id ? linked : null
  const joinable = (table: GameTable) => tableAction(table.status === "lobby" ? "waiting" : "playing", seatCount(seatsOfTable(table)).free) === "join"
  const rows = [
    ...own,
    ...open.map((table) => ({ id: table.id, code: table.code, joinable: joinable(table), entry: tableEntryProps(table, slug, now, expansions, false), detail: tableDetailProps(table, slug, false, expansions) })),
    ...(invited ? [{ id: invited.id, code: invited.code, joinable: joinable(invited), entry: tableEntryProps(invited, slug, now, expansions, false), detail: tableDetailProps(invited, slug, false, expansions) }] : []),
  ]
  // The tables that wait, the visitor's and the invited one, are watched
  const watched = live ? [viewerTable, invited].flatMap((table) => (table && table.status === "lobby" && table.version !== undefined ? [{ table, member: table === viewerTable }] : [])) : []
  return (
    <section aria-label={`Play ${name}`}>
      <OpenTables
        slug={slug}
        signedIn={signedIn}
        rows={rows}
        lobby={lobby}
        createHref={live && anchored ? `#${CREATE_ANCHOR}` : undefined}
        emptyTitle={live ? COMING_SOON.tables.heading : "Coming soon"}
        emptyDescription={live ? COMING_SOON.tables.description : `You will be able to open a table of ${name} here.`}
        lobbyId={anchored ? CREATE_ANCHOR : undefined}
        defaultPickedId={invited?.id}
      />
      {watched.map(({ table, member }) => (
        <TableSync key={table.code} slug={slug} code={table.code} version={table.version ?? 0} member={member} />
      ))}
    </section>
  )
}

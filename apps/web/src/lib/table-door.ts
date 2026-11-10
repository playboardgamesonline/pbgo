// The door between the platform's table and the game's board (PLT-106). A table is opened, joined and started on the hub's page of the game; when it is started everybody seated is taken to its board, `/<slug>/game/<code>`, in the game's own
// site (another root layout, which the router loads whole). Four things take them there: the Start button for the one who pressed it, the watcher of the table for the others (`TableSync`), the beat of a member who is playing, from any
// other page of the hub (`PresenceBeat`, PLT-120), and the search of a visitor who pressed Play, when a table of it has begun (`SearchSync`). All call `enterBoard` and nothing else does.
// Since PLT-107 the board is where the table is `starting`: the page there is the platform's start screen, which loads the board behind it while every board of the table loads (`@pbgo/core/components/game/ready-screen`). The jump takes about a second,
// well inside the minute they have, so nothing is warmed up before it; if it ever is not smooth enough this is the one function that changes.
// A player who goes to a board has no search any more: they are in a game, whichever door took them, and the server leaves their other lobbies when it begins. The door says so with an event (`ENTER_BOARD_EVENT`), which `SearchSync` hears, so that
// this file, which server components import too, holds nothing of the browser's.

/** The board of a table, in the game's own site. */
export const boardHref = (slug: string, code: string) => `/${slug}/game/${code}`

/** What the window is told when a player is taken to a board: their search, if they have one, is over. */
export const ENTER_BOARD_EVENT = "pbgo:enter-board"

/** Takes the player to the board of the table they sit at. `replace` puts the board in place of the page they were on in the history, for a page they were taken from and should not come back to with the back button. */
export function enterBoard(router: { push: (href: string) => void; replace: (href: string) => void }, slug: string, code: string, { replace = false }: { replace?: boolean } = {}) {
  window.dispatchEvent(new Event(ENTER_BOARD_EVENT))
  if (replace) router.replace(boardHref(slug, code))
  else router.push(boardHref(slug, code))
}

/** What to tell the visitor about an error of the game's routes: the platform's words for the code (`ApiClientError`), else a plain line. */
export const messageOf = (error: unknown): string => (error instanceof Error && error.message ? error.message : "Something went wrong.")

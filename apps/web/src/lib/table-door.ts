// The door between the platform's table and the game's board (PLT-106). A table is opened, joined and started on the hub's page of the game; when it is started everybody seated is taken to its board, `/<slug>/game/<code>`, in the game's own
// site (another root layout, which the router loads whole). Two things take them there: the Start button for the one who pressed it, and the watcher of the table for the others (`TableSync`). Both call `enterBoard` and nothing else does, so PLT-107
// (the ready screen and the loading curtain between the table and the board) changes this one function.

/** The board of a table, in the game's own site. */
export const boardHref = (slug: string, code: string) => `/${slug}/game/${code}`

/** Takes the player to the board of the table they sit at. */
export function enterBoard(router: { push: (href: string) => void }, slug: string, code: string) {
  router.push(boardHref(slug, code))
}

/** What to tell the visitor about an error of the game's routes: the platform's words for the code (`ApiClientError`), else a plain line. */
export const messageOf = (error: unknown): string => (error instanceof Error && error.message ? error.message : "Something went wrong.")

// What the "Expansions" tab of a game asks for. Plain TypeScript: the tab itself (`expansions-of-view.tsx`) is the part that needs the Studio.

/** What an expansion shows in the tab: its name. */
export type ExpansionOf = { _id: string; name: string | null }

// `$id` is the published id of the game, drafts and published expansions alike (the query runs on the drafts perspective). Only the
// `expansion` documents that name the game as their base game: a reimplementation of the game is a game, and has its own place in Games.
export const EXPANSIONS_OF_QUERY = `*[_type == "expansion" && baseGame._ref == $id] | order(name asc) { _id, name }`

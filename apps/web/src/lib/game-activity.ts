import "server-only"

// What is going on around a game, for its page on the hub: the tables that are waiting for players and its tournaments. Neither exists yet, so both are empty: the page draws its sections with an empty state, and the day there is a
// list of the open tables (PLT-21) and the tournaments (PLT-31) these two functions read them, and nothing else changes.

/** A table of a game that is waiting for players: who opened it, how many seats it has and how many are taken, and the code in its address (`/<slug>/game/<code>`). */
export type OpenTable = { code: string; host: string; seats: number; taken: number }

/** A tournament of a game: when it starts (an ISO date), how many may sign up (`places`) and how many have (`registered`). */
export type GameTournament = { id: string; name: string; status: "upcoming" | "live" | "finished"; startsAt: string; places: number; registered: number }

/** The tables of the game that wait for players, the ones a visitor may join. Tables are reached by their link for now, so there is no list to read. */
export async function getOpenTables(slug: string): Promise<OpenTable[]> {
  void slug
  return []
}

/** The tournaments of the game, upcoming, in progress and finished. There are none yet. */
export async function getTournaments(slug: string): Promise<GameTournament[]> {
  void slug
  return []
}

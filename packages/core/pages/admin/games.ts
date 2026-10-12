import type { SwitcherGame } from "../../components/admin/game-switcher"
import type { GameEntry } from "../../lib/binding"

/** The registry as the game switcher lists it (name, live, cover art): plain data, so every gamemaster page can send all of it to the client. */
export const switcherGames = (games: readonly GameEntry[]): SwitcherGame[] => games.map(({ slug, name, live, visual }) => ({ slug, name, live, visual: visual ?? null }))

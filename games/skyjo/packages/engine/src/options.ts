import type { OptionDefinitions } from "@pbgo/engine-kit"

/** The score that ends the game: a player who reaches it or goes past it at the end of a round (EN p.4-5, FR p.2 and p.4). The rules fix it; no option moves it. */
export const TARGET_SCORE = 100

/** Skyjo has no option: the base game as the booklets have it. */
export const OPTIONS: OptionDefinitions = {}

import type { OptionDefinitions } from "@pbgo/engine-kit"

/** The score that ends the game: a player who reaches it or goes past it at the end of a round (rulebook, page 4). The rules fix it; no option moves it. */
export const TARGET_SCORE = 100

/** Skyjo has no option: the base game as the rulebook has it. */
export const OPTIONS: OptionDefinitions = {}

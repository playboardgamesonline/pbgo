import type { OptionDefinitions } from "@pbgo/engine-kit"

/** The score that wins the game in the rules. */
export const DEFAULT_TARGET = 200

/**
 * The options of a table. Texts are player-facing, in French (like the rest of the lobby).
 *
 * `targetScore` is the only one: the rules say 200, which is the default. A lower one makes a shorter game.
 */
export const OPTIONS: OptionDefinitions = {
  targetScore: {
    type: "number",
    defaultValue: DEFAULT_TARGET,
    min: 50,
    max: 500,
    step: 50,
    label: "Score à atteindre",
    help: "À la fin d’une manche, le premier à atteindre ce total remporte la partie : 200 points dans les règles, moins pour une partie plus courte.",
    group: "parameter",
  },
}

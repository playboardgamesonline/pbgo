import type { OptionDefinitions } from "@pbgo/engine-kit"

/** The score that wins the game in the rules. */
export const DEFAULT_TARGET = 200

/**
 * The options of a table. They name no text: the words of `targetScore`, `option.targetScore.label` and `option.targetScore.help`, are written in the game's Sanity (Copy, Options and scores; the seed of `content/data/texts.ts` holds them).
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
    group: "parameter",
  },
}

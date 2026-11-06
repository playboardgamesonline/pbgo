import type { OptionValues } from "@pbgo/engine-kit"

/**
 * What the settings of a lobby on the platform's page choose (the ones it offers and the ones that are ticked), turned into engine options (PLT-106). The page's settings are the expansions of the game and
 * its helpers, each with an id; the current backend keeps only the engine's options (`games.options`, whose keys are the `OPTIONS` of the game's engine), so a choice is kept when its id is the key of one and is
 * left in the page when it is not (the server would drop it all the same: `normalizeOptions` keeps what the engine declares). Every id the page offers that the engine knows is in the answer, on or off, so that
 * unticking an expansion turns its option off. Nothing to keep is `{}`, and the page then sends nothing.
 */
export function engineOptionsOf(
  chosen: { expansions: readonly string[]; helpers: readonly string[] },
  offered: { expansions: readonly string[]; helpers: readonly string[] },
  keys: readonly string[],
): OptionValues {
  const options: OptionValues = {}
  for (const id of offered.expansions) if (keys.includes(id)) options[id] = chosen.expansions.includes(id)
  for (const id of offered.helpers) if (keys.includes(id)) options[id] = chosen.helpers.includes(id)
  return options
}

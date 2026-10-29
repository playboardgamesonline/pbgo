/**
 * The figures the home's hero says about the platform, under its title (`Stats`). The games are the games of the catalog, counted by the page; the players are a PLACEHOLDER: the
 * platform counts nobody yet (no `profiles`, PLT-16, PLT-23, and no table keeps who played: PLT-13), so this is a made-up figure to be replaced by a count, never read as a real one
 * (`docs/accounts.md`, "What is a placeholder").
 */
export const PLAYERS_PLACEHOLDER = 12_480

/** A figure as it is written on the page: `12,480`. */
export const figure = (value: number) => new Intl.NumberFormat("en").format(value)

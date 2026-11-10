/**
 * The settings' own address: the page itself when an address is typed, a link of an e-mail opens it or the page is reloaded, and, when a link of the hub leads to it, the window drawn over the page the visitor is on
 * (`app/(hub)/@modal/(.)me/settings`).
 */
export const SETTINGS_PATH = "/me/settings"

/**
 * The address that the settings have on the screen of a game, where they open as a window over the board (`app/[game]/@modal/(...)settings`). It is an alias of the settings' own address and not that address: the games have a root layout of
 * their own, which a soft navigation cannot cross, so the window over a board is drawn by the game's layout, and the hub's window, which answers a link to `/me/settings/**` wherever it is followed from, would take the visitor off the board. Typed, or
 * reloaded, the alias leads to the settings' own page (`app/(hub)/settings`). The sections keep to the address the window was opened at (`SettingsNav`), so a window opened over a board never leaves it.
 */
export const GAME_SETTINGS_PATH = "/settings"

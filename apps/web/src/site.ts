export { SITE_URL } from "@pbgo/core/lib/site-url"

/** The name of the site, in words: the title of its pages, its share cards, its legal notice and the line of the footer. */
export const SITE_NAME = "Play Board Games Online"

/** The year of the copyright line of the footer: the one the site opened in. */
export const COPYRIGHT_YEAR = 2026

/** Who built the site, and the page that credits them in the footer. */
export const AUTHOR = { name: "oré ˖ ࣪⊹)", url: "https://aurelienlouvel.space" }

export const SITE_DESCRIPTION = "Play board and card games online, with friends or against rivals, right in your browser. Pick a game, open a table, share the link."

/** Publisher of the site (legal notice); each game's own notice (toolbar menu) names it too. */
export const PUBLISHER = { name: "oré", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

/**
 * Whether the Billing section of the settings exists. There is nothing to bill (no paid plan is on sale), so for now it has no entry in the settings and its address shows the 404 page. The section is kept, with its empty states: set this
 * to true the day a plan is on sale, and say so in `CLAUDE.md` and `docs/accounts.md`.
 */
export const BILLING_OPEN = false

/**
 * Whether the Notifications section of the settings exists. Nothing shows a notification yet (PLT-24), so its choices would change nothing: for now it has no entry in the settings and its address shows the 404 page. The section and its two
 * choices are kept: set this to true when the notifications are shown, and say so in `CLAUDE.md` and `docs/accounts.md`.
 */
export const NOTIFICATIONS_OPEN = false

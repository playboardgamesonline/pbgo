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
 * The sender of the e-mails that the site's own code sends (the link that reopens a deleted account, PLT-36): the name of the site and an address on the subdomain that Resend verified, the one Supabase Auth sends its
 * e-mails from too (`docs/accounts.md`, "Setting it up", 6). Nobody reads what is written to it: the replies go to `CONTACT`.
 */
export const MAIL_FROM = `${SITE_NAME} <no-reply@mail.playboardgamesonline.app>`

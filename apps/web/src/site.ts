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
 * Whether the Pricing page exists. There is no pricing to show yet (no paid plan is on sale, since the games are not licensed), so for now the page answers 404, the bar has no tab for it and the Billing settings have no way
 * to it. The page, its plans (`lib/plans.ts`) and the card (`PlanCard`) are kept: the day a plan is on sale, set this to true, rewrite the sentence of the Terms about the plans and the notes in `CLAUDE.md` and `docs/`.
 */
export const PRICING_OPEN = false

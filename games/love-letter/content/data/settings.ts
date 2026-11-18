import { localeString } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const SETTINGS_ID = "settings"

/** The publisher named on the booklet (p. 15): Z-Man Games. The web edition is not official. */
const PUBLISHER = { name: "Z-Man Games", url: "https://www.zmangames.com" }

const AUTHOR = "Seiji Kanai"

/**
 * The part of `settings` the content seed fills: the credits and the publisher. Everything else (identity, colors, fonts, options, the rules PDF) is set in the Studio and left alone. No illustrator line:
 * `settings` has no field for one (the booklet names Andrew Bosley for the character art). No description: the catalog's is English only, and its four languages come with go-live.
 */
export function buildSettings(): SeedDoc {
  return {
    _id: SETTINGS_ID,
    _type: "settings",
    // The footer reads `creditsAuthorsI18n` first and falls back to `creditsAuthors` in French only, so both are filled.
    creditsAuthors: AUTHOR,
    creditsAuthorsI18n: localeString({ fr: AUTHOR, en: AUTHOR, es: AUTHOR, de: AUTHOR }),
    publisher: PUBLISHER.name,
    publisherUrl: PUBLISHER.url,
  }
}

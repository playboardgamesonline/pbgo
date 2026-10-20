import { localeString } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const SETTINGS_ID = "settings"

/** The publisher named on the booklet: The OP Games (USAopoly, Inc.). The web edition is not official. */
const PUBLISHER = { name: "The OP Games", url: "https://www.theopgames.com" }

const AUTHOR = "Eric Olsen"

/**
 * The part of `settings` the content seed fills: the credits and the publisher. Everything else (identity, colors, fonts, options, the
 * rules PDF) is set in the Studio and left alone. No illustrator line: the booklet does not name one.
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

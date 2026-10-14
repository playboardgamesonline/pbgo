import { localeString } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const SETTINGS_ID = "settings"

const AUTHOR = "Antoine Bauza"
const PUBLISHER = { name: "Cocktail Games", url: "https://www.cocktailgames.com" }

/**
 * Official rulebooks, linked and never copied. They feed the Rules button of the toolbar.
 * The French one is the Grands Feux edition, which also covers the three extensions; the English one covers the base game.
 * There is no German or Spanish file from the publishers: those languages fall back to the English one.
 */
export const RULES_PDF = {
  fr: "https://www.cocktailgames.com/wp-content/uploads/2019/07/Hanabi_grands_feux_regles_0419_BD.pdf",
  en: "https://rnrgames.com/Content/RRGames/images/ProductRules/hanabiRules.PDF",
}

/**
 * The part of `settings` the content pilot fills: credits and rulebook links.
 * Everything else (identity, colors, fonts, options) is set in the Studio and left alone.
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
    rulesPdfFr: RULES_PDF.fr,
    rulesPdfEn: RULES_PDF.en,
  }
}

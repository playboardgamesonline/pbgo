import { localeString } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"

export const SETTINGS_ID = "settings"

const PUBLISHER = { name: "Exploding Kittens Inc.", url: "https://www.explodingkittens.com" }

/** The three designers; each language writes its own conjunction. */
const AUTHORS: Localized = {
  fr: "Elan Lee, Matthew Inman et Shane Small",
  en: "Elan Lee, Matthew Inman and Shane Small",
  es: "Elan Lee, Matthew Inman y Shane Small",
  de: "Elan Lee, Matthew Inman und Shane Small",
}

/**
 * Official rulebook, linked and never copied. It feeds the Rules button of the toolbar. The publisher's own site only hosts the English file:
 * French, Spanish and German fall back to it.
 */
export const RULES_PDF = {
  en: "https://cdn.shopify.com/s/files/1/0345/9180/1483/files/ekoe-instructions-english.pdf",
}

/**
 * The part of `settings` the content seed fills: credits and the rulebook link. Everything else (identity, colors, fonts, options) is set
 * in the Studio and left alone. No illustrator line until the art arrives.
 */
export function buildSettings(): SeedDoc {
  return {
    _id: SETTINGS_ID,
    _type: "settings",
    // The footer reads `creditsAuthorsI18n` first and falls back to `creditsAuthors` in French only, so both are filled.
    creditsAuthors: AUTHORS.fr,
    creditsAuthorsI18n: localeString(AUTHORS),
    publisher: PUBLISHER.name,
    publisherUrl: PUBLISHER.url,
    rulesPdfEn: RULES_PDF.en,
  }
}

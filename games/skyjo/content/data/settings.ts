import { localeString, localeText } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const SETTINGS_ID = "settings"

/**
 * What the game is, in a few lines, for the share card and the metadata of its pages: the description of the game in the platform's own Sanity project, the one the hub shows, word for word in each language (one text, kept in step by hand: change one,
 * change the other; the French one has the straight apostrophe the catalog has). Each is longer than the 80 characters the Launch list of the gamemaster asks for. The single-language `description` of `settings` held French before the localized one
 * existed: the localized one is read first and holds every language, so it is left empty.
 */
export const DESCRIPTIONS = {
  fr: "Faites le plus petit score en remplaçant et en retournant les cartes de votre grille. Une colonne de trois cartes identiques disparaît ! Quand un joueur a tout retourné, la manche s'arrête.",
  en: "Get the lowest score by swapping and flipping the cards in your grid. A column of three matching cards disappears! When one player has flipped everything, the round ends.",
  es: "Consigue la puntuación más baja cambiando y girando las cartas de tu cuadrícula. ¡Una columna de tres cartas iguales desaparece! Cuando un jugador lo ha girado todo, la ronda termina.",
  de: "Macht die wenigsten Punkte, indem ihr Karten in eurem Raster tauscht und aufdeckt. Eine Spalte aus drei gleichen Karten verschwindet! Hat jemand alles aufgedeckt, endet die Runde.",
}

/**
 * The publisher named on the booklet: Magilano (Alexander Bernhardt, Altenkirchen), distributed in French-speaking countries by Blackrock Games. The web edition is not official. The booklets give an e-mail address and no website: the link is the one of the
 * publisher in the platform's catalog (the French booklet's domain, magilano.eu, only redirects to it).
 */
const PUBLISHER = { name: "Magilano", url: "https://magilano.com/" }

const AUTHOR = "Alexander Bernhardt"

/**
 * The part of `settings` the content seed fills: the description, the credits and the publisher. Everything else (identity, colors, fonts, options, the rules PDF) is set in the Studio and left alone. No illustrator line: the booklet does not name one.
 */
export function buildSettings(): SeedDoc {
  return {
    _id: SETTINGS_ID,
    _type: "settings",
    descriptionI18n: localeText(DESCRIPTIONS),
    // The footer reads `creditsAuthorsI18n` first and falls back to `creditsAuthors` in French only, so both are filled.
    creditsAuthors: AUTHOR,
    creditsAuthorsI18n: localeString({ fr: AUTHOR, en: AUTHOR, es: AUTHOR, de: AUTHOR }),
    publisher: PUBLISHER.name,
    publisherUrl: PUBLISHER.url,
  }
}

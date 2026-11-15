import { localeString, localeText } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"

export const SETTINGS_ID = "settings"

/**
 * What the game is, in a few lines, for the share card and the metadata of its pages: the description of the game in the platform's own Sanity project, the one the hub shows, word for word in each language (one text, kept in step by hand: change one,
 * change the other). Each is longer than the 80 characters the Launch list of the gamemaster asks for. The single-language `description` of `settings` held French before the localized one existed: the localized one is read first and holds every language, so it is left empty.
 */
export const DESCRIPTIONS = {
  fr: "Retournez des cartes une à une pour marquer des points, mais gare au doublon qui vous fait tout perdre. Stop ou encore ? Réunissez sept numéros différents pour un gros bonus. Un jeu de prise de risque.",
  en: "Flip cards one by one to score points, but a duplicate number makes you bust. Stop or keep going? Collect seven different numbers for a big bonus. A push-your-luck card game.",
  es: "Da la vuelta a las cartas una a una para sumar puntos, pero un número repetido te hace perderlo todo. ¿Te plantas o sigues? Reúne siete números distintos para un gran bonus. Un juego de tentar la suerte.",
  de: "Deckt Karten einzeln auf und sammelt Punkte – doch eine doppelte Zahl kostet alles. Aufhören oder weiter? Sieben verschiedene Zahlen bringen einen dicken Bonus. Ein Zockerspiel.",
}

/** The publisher named on the booklet: The OP Games (USAopoly, Inc.). The web edition is not official. */
const PUBLISHER = { name: "The OP Games", url: "https://www.theopgames.com" }

const AUTHOR = "Eric Olsen"

/**
 * The part of `settings` the content seed fills: the description, the credits and the publisher. Everything else (the title, the logo, colors, fonts, options, the
 * rules PDF) is set in the Studio and left alone. No illustrator line: the booklet does not name one.
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

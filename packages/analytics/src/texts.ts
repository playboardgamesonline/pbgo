import type { Locale } from "./events"

/**
 * The cookie banner, in each language of the site. Drafts to be reviewed (the wording is the owner's call, and the German and
 * Spanish deserve a native reader). The voice is the site's: informal, as in the rest of the interface.
 *
 * The banner is one line, so the sentence says the two things that matter and the link leads to the rest (`/legal#cookies`):
 * - whatever the answer, visits and game statistics are counted (no name, no text, nothing more stored on the device);
 * - accepting adds an identifier stored on the device and session recordings (inputs, the chat and nicknames are masked).
 * Refusing stores nothing for statistics and records nothing: it is what the sentence leaves out, and `/legal#cookies` says it.
 * A longer sentence makes the banner tall again and brings back the problem of a banner over the game (`texts.test.ts` caps it).
 */
export type BannerTexts = {
  /** Accessible name of the banner. */
  label: string
  /** What is counted whatever the answer, and what Accept adds. One sentence pair, no more. */
  body: string
  accept: string
  refuse: string
  /** The word of the link to the detail, on `/legal`, that ends the sentence. */
  more: string
  /** Leaves the banner without changing the choice (only shown once a choice exists). */
  close: string
}

export const BANNER_TEXTS: Record<Locale, BannerTexts> = {
  fr: {
    label: "Cookies et statistiques",
    body: "Les visites et statistiques de jeu sont toujours comptées. Accepter ajoute un identifiant et des enregistrements de session masqués.",
    accept: "Accepter",
    refuse: "Refuser",
    more: "Détails",
    close: "Fermer",
  },
  en: {
    label: "Cookies and statistics",
    body: "Visits and game statistics are always counted. Accepting also stores an identifier and allows masked session recordings.",
    accept: "Accept",
    refuse: "Refuse",
    more: "Details",
    close: "Close",
  },
  es: {
    label: "Cookies y estadísticas",
    body: "Las visitas y estadísticas de juego siempre se cuentan. Aceptar añade un identificador y grabaciones de sesión enmascaradas.",
    accept: "Aceptar",
    refuse: "Rechazar",
    more: "Detalles",
    close: "Cerrar",
  },
  de: {
    label: "Cookies und Statistiken",
    body: "Besuche und Spielstatistiken werden immer gezählt. Akzeptieren fügt eine Kennung und maskierte Sitzungsaufzeichnungen hinzu.",
    accept: "Akzeptieren",
    refuse: "Ablehnen",
    more: "Details",
    close: "Schließen",
  },
}

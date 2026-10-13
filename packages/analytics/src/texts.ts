import type { Locale } from "./events"

/**
 * The cookie banner, in each language of the site. Drafts to be reviewed (the wording is the owner's call, and the German and
 * Spanish deserve a native reader). The voice is the site's: informal, as in the rest of the interface.
 *
 * What the text has to say, plainly:
 * - Accept stores an identifier on the device and allows session recordings (inputs, the chat and nicknames are masked);
 * - Refuse stores nothing for statistics and records nothing;
 * - whatever the answer, visits and game statistics are still counted, without any name or text, and nothing more is stored on the
 *   device for that (visits live in memory, the games use their own player cookie). `/legal#cookies` gives the detail.
 */
export type BannerTexts = {
  /** Accessible name of the banner. */
  label: string
  /** The question, and what Accept does. */
  body: string
  /** What is counted whatever the answer. */
  extra: string
  accept: string
  refuse: string
  /** Link to the detail, on `/legal`. */
  more: string
  /** Leaves the banner without changing the choice (only shown once a choice exists). */
  close: string
}

export const BANNER_TEXTS: Record<Locale, BannerTexts> = {
  fr: {
    label: "Cookies et statistiques",
    body: "Pouvons-nous mesurer l'usage du site pour l'améliorer ? Accepter enregistre un identifiant sur ton appareil et autorise des enregistrements de sessions (ce que tu saisis, le chat et les pseudos sont masqués).",
    extra:
      "Dans tous les cas, les visites et des statistiques de jeu (tables créées, parties terminées) sont comptées, sans nom ni texte et sans rien stocker de plus sur ton appareil.",
    accept: "Accepter",
    refuse: "Refuser",
    more: "En savoir plus",
    close: "Fermer",
  },
  en: {
    label: "Cookies and statistics",
    body: "Can we measure how you use the site to improve it? Accepting stores an identifier on your device and allows session recordings (what you type, the chat and nicknames are masked).",
    extra:
      "Either way, visits and game statistics (tables created, games finished) are counted, with no name or text in them and without storing anything more on your device.",
    accept: "Accept",
    refuse: "Refuse",
    more: "More",
    close: "Close",
  },
  es: {
    label: "Cookies y estadísticas",
    body: "¿Podemos medir cómo usas el sitio para mejorarlo? Aceptar guarda un identificador en tu dispositivo y permite grabaciones de sesión (lo que escribes, el chat y los apodos se ocultan).",
    extra:
      "En cualquier caso, se cuentan las visitas y estadísticas de juego (mesas creadas, partidas terminadas), sin nombres ni textos y sin guardar nada más en tu dispositivo.",
    accept: "Aceptar",
    refuse: "Rechazar",
    more: "Más información",
    close: "Cerrar",
  },
  de: {
    label: "Cookies und Statistiken",
    body: "Dürfen wir messen, wie du die Seite nutzt, um sie zu verbessern? Mit „Akzeptieren“ speichern wir eine Kennung auf deinem Gerät und erlauben Sitzungsaufzeichnungen (Eingaben, Chat und Spitznamen werden maskiert).",
    extra:
      "In jedem Fall werden Besuche und Spielstatistiken (erstellte Tische, beendete Partien) gezählt, ohne Namen oder Texte und ohne etwas Weiteres auf deinem Gerät zu speichern.",
    accept: "Akzeptieren",
    refuse: "Ablehnen",
    more: "Mehr erfahren",
    close: "Schließen",
  },
}

import type { Locale } from "./events"

/**
 * The cookie banner, in each language of the site. Drafts to be reviewed (the wording is the owner's call, and the German and
 * Spanish deserve a native reader). The voice is the site's: informal, as in the rest of the interface. The English is the owner's.
 *
 * The banner is a wide, short card, so the sentence says the two things that matter and the link leads to the rest (`/legal#cookies`):
 * - the site needs essential cookies to work;
 * - with the visitor's permission it also uses cookies for analytics (an identifier stored on the device) and session recordings
 *   (inputs, the chat and nicknames are masked).
 * What is counted either way (visits and game statistics, with nothing stored on the device) and what a refusal stores are in
 * `/legal#cookies`, not in the card. A longer sentence makes the card taller, and the page gives up that much of the screen until
 * the visitor answers (`texts.test.ts` caps it).
 */
export type BannerTexts = {
  /** The title of the card, which is also its accessible name. */
  label: string
  /** What the site needs and what the visitor's permission adds. One sentence pair, no more. */
  body: string
  /** Allows everything. */
  accept: string
  /** Refuses everything that is optional. */
  refuse: string
  /** The words of the link to the detail, on `/legal`, that ends the sentence. */
  more: string
  /** Leaves the banner without changing the choice (only shown once a choice exists). */
  close: string
}

export const BANNER_TEXTS: Record<Locale, BannerTexts> = {
  fr: {
    label: "Tes cookies. Ton choix.",
    body: "On utilise des cookies essentiels pour que le site fonctionne. Avec ton accord, on en utilise aussi pour les statistiques et les enregistrements de session.",
    accept: "Tout accepter",
    refuse: "Refuser le facultatif",
    more: "Politique de confidentialité",
    close: "Fermer",
  },
  en: {
    label: "Your cookies. Your choice.",
    body: "We use essential cookies to keep the site working. With your permission, we also use cookies for analytics and session recordings.",
    accept: "Accept all",
    refuse: "Reject optional",
    more: "Privacy policy",
    close: "Close",
  },
  es: {
    label: "Tus cookies. Tu elección.",
    body: "Usamos cookies esenciales para que el sitio funcione. Con tu permiso, también usamos cookies para estadísticas y grabaciones de sesión.",
    accept: "Aceptar todo",
    refuse: "Rechazar opcionales",
    more: "Política de privacidad",
    close: "Cerrar",
  },
  de: {
    label: "Deine Cookies. Deine Wahl.",
    body: "Wir verwenden notwendige Cookies, damit die Seite funktioniert. Mit deiner Zustimmung nutzen wir auch Cookies für Statistiken und Sitzungsaufzeichnungen.",
    accept: "Alle akzeptieren",
    refuse: "Optionale ablehnen",
    more: "Datenschutz",
    close: "Schließen",
  },
}

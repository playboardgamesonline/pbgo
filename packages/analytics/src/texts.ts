import type { Locale } from "./events"

/**
 * The cookie banner, in each language of the site. Drafts to be reviewed (the wording is the owner's call, and the German and
 * Spanish deserve a native reader). The voice is the site's: informal, as in the rest of the interface. The English is the owner's.
 *
 * The banner is a wide card with a title and one sentence that ends with a link to the cookie policy (`/legal/cookies`), and the
 * banner puts the full stop after the link:
 * - the site uses cookies to deliver and improve its services and to analyze how it is used;
 * - with the visitor's agreement it may also use them to customize the experience and to market its services.
 * The owner's sentence says more than the site does today (it customizes and markets nothing): what is really stored, the counts
 * that run either way (visits and game statistics, with nothing stored on the device) and what a refusal stores are in
 * `/legal/cookies`, not in the card. A longer sentence makes the card taller, and the page gives up that much of the screen until
 * the visitor answers (`texts.test.ts` caps it).
 */
export type BannerTexts = {
  /** The title of the card, which is also its accessible name. */
  label: string
  /** What the cookies are for, ending on the words that lead into the link. */
  body: string
  /** Allows everything. */
  accept: string
  /** Refuses everything that is optional. */
  refuse: string
  /** The words of the link, on `/legal/cookies`, that ends the sentence. */
  more: string
  /** Leaves the banner without changing the choice (only shown once a choice exists). */
  close: string
}

export const BANNER_TEXTS: Record<Locale, BannerTexts> = {
  fr: {
    label: "Réglages des cookies",
    body: "On utilise des cookies pour fournir et améliorer nos services, analyser l'usage du site et, si tu es d'accord, personnaliser ton expérience et te présenter nos services. Tu peux lire notre politique relative aux cookies",
    accept: "Tout accepter",
    refuse: "Refuser le facultatif",
    more: "ici",
    close: "Fermer",
  },
  en: {
    label: "Cookie settings",
    body: "We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy",
    accept: "Accept all",
    refuse: "Reject optional",
    more: "here",
    close: "Close",
  },
  es: {
    label: "Ajustes de cookies",
    body: "Usamos cookies para ofrecer y mejorar nuestros servicios, analizar el uso del sitio y, si estás de acuerdo, personalizar tu experiencia y promocionar nuestros servicios. Puedes leer nuestra política de cookies",
    accept: "Aceptar todo",
    refuse: "Rechazar opcionales",
    more: "aquí",
    close: "Cerrar",
  },
  de: {
    label: "Cookie-Einstellungen",
    body: "Wir verwenden Cookies, um unsere Dienste bereitzustellen und zu verbessern, die Nutzung der Seite zu analysieren und, wenn du zustimmst, dein Erlebnis zu personalisieren und dir unsere Dienste zu bewerben. Mehr dazu in unserer",
    accept: "Alle akzeptieren",
    refuse: "Optionale ablehnen",
    more: "Cookie-Richtlinie",
    close: "Schließen",
  },
}

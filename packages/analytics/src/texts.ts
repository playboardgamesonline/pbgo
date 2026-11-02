import type { Locale } from "./events"

/**
 * The cookie banner, in each language of the site. The site is in English only for now (the owner, 2026-11-01), so the banner speaks
 * English to everyone (`banner.tsx`): the French, Spanish and German below are drafts kept for the language pass (PLT-32), not shown, and
 * to be reviewed (the wording is the owner's call, and the German and Spanish deserve a native reader). The voice is the site's:
 * informal, as in the rest of the interface. The English of the card is the owner's.
 *
 * The banner is a wide card with a title and one sentence that ends with a link to the cookie policy (`/legal/cookies`), and the
 * banner puts the full stop after the link:
 * - the site uses cookies to deliver and improve its services and to analyze how it is used;
 * - with the visitor's agreement it may also use them to customize the experience and to market its services.
 * The owner's sentence says more than the site does today (it customizes and markets nothing): it is written for where the platform is
 * going. What is really stored, the counts that run either way (visits and game statistics, with nothing stored on the device) and what a
 * refusal stores are in `/legal/cookies`, not in the card. A longer sentence makes the card taller, and the page gives up that much of
 * the screen until the visitor answers (`texts.test.ts` caps it).
 *
 * "Customize" opens the choices one by one, modelled on Claude's: what the site needs (always on), the analytics (the identifier
 * kept on the device, and the recordings that hang on it) and the marketing, a switch like the other, off: the site has no marketing
 * cookie yet, but the owner wants the choice to be there for the day it has one (the cookie policy says so). The fields after `close`
 * are the words of that view.
 */
export type BannerTexts = {
  /** The title of the card, in both of its views, which is also its accessible name. */
  label: string
  /** What the cookies are for, ending on the words that lead into the link. */
  body: string
  /** Allows everything. */
  accept: string
  /** Refuses everything that is optional. */
  refuse: string
  /** Opens the choices one by one. */
  customize: string
  /** The words of the link, on `/legal/cookies`, that ends the sentence. */
  more: string
  /** Leaves the banner without changing the choice (only shown once a choice exists). */
  close: string
  /** The sentence of the choices, which ends on the words that lead into the same link. */
  intro: string
  necessary: string
  necessaryBody: string
  analytics: string
  analyticsBody: string
  marketing: string
  marketingBody: string
  /** What stands beside a switch: the word for what the site needs (always on), then the two a switch of the visitor can show. */
  required: string
  on: string
  off: string
  /** Keeps the choices as the switches are set. */
  save: string
  /** Back to the card, nothing kept. */
  back: string
}

export const BANNER_TEXTS: Record<Locale, BannerTexts> = {
  fr: {
    label: "Réglages des cookies",
    body: "On utilise des cookies pour fournir et améliorer nos services, analyser l'usage du site et, si tu es d'accord, personnaliser ton expérience et te présenter nos services. Tu peux lire notre politique relative aux cookies",
    accept: "Tout accepter",
    refuse: "Refuser le facultatif",
    customize: "Personnaliser les cookies",
    more: "ici",
    close: "Fermer",
    intro: "Choisis les cookies qu'on peut utiliser. Ceux dont le site a besoin sont toujours actifs, les autres restent désactivés tant que tu ne les autorises pas. Tu peux lire notre politique relative aux cookies",
    necessary: "Nécessaires",
    necessaryBody: "Te gardent à ta table, connecté et dans ta langue, et retiennent ce choix.",
    analytics: "Statistiques",
    analyticsBody: "Comptent les visites, les clics et les erreurs avec un identifiant gardé sur cet appareil, et peuvent enregistrer le déroulé d'une visite. Saisies, chat et pseudos sont masqués.",
    marketing: "Marketing",
    marketingBody: "Nous permet de personnaliser ton expérience et de te présenter nos services.",
    required: "Requis",
    on: "Activé",
    off: "Désactivé",
    save: "Enregistrer mes choix",
    back: "Retour",
  },
  en: {
    label: "Cookie settings",
    body: "We use cookies to deliver and improve our services, analyze site usage, and if you agree, to customize or personalize your experience and market our services to you. You can read our Cookie Policy",
    accept: "Accept all",
    refuse: "Reject optional",
    customize: "Customize cookie settings",
    more: "here",
    close: "Close",
    intro: "Choose which cookies we may use. The ones the site needs are always on, the others stay off until you allow them. You can read our Cookie Policy",
    necessary: "Necessary",
    necessaryBody: "Keeps you at your table, signed in and in your language, and remembers this choice.",
    analytics: "Analytics",
    analyticsBody: "Counts visits, clicks and errors with an identifier kept on this device, and may record how a visit goes. Inputs, chat and nicknames are masked.",
    marketing: "Marketing",
    marketingBody: "Lets us personalize your experience and market our services to you.",
    required: "Required",
    on: "On",
    off: "Off",
    save: "Save preferences",
    back: "Back",
  },
  es: {
    label: "Ajustes de cookies",
    body: "Usamos cookies para ofrecer y mejorar nuestros servicios, analizar el uso del sitio y, si estás de acuerdo, personalizar tu experiencia y promocionar nuestros servicios. Puedes leer nuestra política de cookies",
    accept: "Aceptar todo",
    refuse: "Rechazar opcionales",
    customize: "Personalizar cookies",
    more: "aquí",
    close: "Cerrar",
    intro: "Elige qué cookies podemos usar. Las que el sitio necesita están siempre activas, las demás siguen desactivadas hasta que las permitas. Puedes leer nuestra política de cookies",
    necessary: "Necesarias",
    necessaryBody: "Te mantienen en tu mesa, con la sesión iniciada y en tu idioma, y recuerdan esta elección.",
    analytics: "Estadísticas",
    analyticsBody: "Cuentan visitas, clics y errores con un identificador guardado en este dispositivo, y pueden grabar cómo va una visita. Entradas, chat y apodos se enmascaran.",
    marketing: "Marketing",
    marketingBody: "Nos permite personalizar tu experiencia y promocionar nuestros servicios.",
    required: "Obligatorio",
    on: "Activado",
    off: "Desactivado",
    save: "Guardar preferencias",
    back: "Volver",
  },
  de: {
    label: "Cookie-Einstellungen",
    body: "Wir verwenden Cookies, um unsere Dienste bereitzustellen und zu verbessern, die Nutzung der Seite zu analysieren und, wenn du zustimmst, dein Erlebnis zu personalisieren und dir unsere Dienste zu bewerben. Mehr dazu in unserer",
    accept: "Alle akzeptieren",
    refuse: "Optionale ablehnen",
    customize: "Cookies anpassen",
    more: "Cookie-Richtlinie",
    close: "Schließen",
    intro: "Wähle, welche Cookies wir nutzen dürfen. Die, die die Seite braucht, sind immer aktiv, die anderen bleiben aus, bis du sie erlaubst. Mehr dazu in unserer",
    necessary: "Notwendig",
    necessaryBody: "Halten dich an deinem Tisch, angemeldet und in deiner Sprache, und merken sich diese Wahl.",
    analytics: "Statistiken",
    analyticsBody: "Zählen Besuche, Klicks und Fehler mit einer Kennung auf diesem Gerät und können den Ablauf eines Besuchs aufzeichnen. Eingaben, Chat und Spitznamen sind maskiert.",
    marketing: "Marketing",
    marketingBody: "Erlaubt uns, dein Erlebnis zu personalisieren und dir unsere Dienste zu bewerben.",
    required: "Erforderlich",
    on: "An",
    off: "Aus",
    save: "Auswahl speichern",
    back: "Zurück",
  },
}

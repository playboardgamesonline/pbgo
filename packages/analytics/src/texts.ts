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
 *
 * "Manage preferences" opens the choices one by one: the essential cookies (always on), the analytics, and the recordings, which
 * need the analytics. The fields after `close` are the words of that view.
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
  /** Opens the choices one by one, and is the title of that view. */
  customize: string
  /** The words of the link to the detail, on `/legal`, that ends the sentence. */
  more: string
  /** Leaves the banner without changing the choice (only shown once a choice exists). */
  close: string
  essential: string
  essentialBody: string
  analytics: string
  analyticsBody: string
  recordings: string
  recordingsBody: string
  /** Keeps the choices as they are set. */
  save: string
  /** Back to the card, nothing kept. */
  back: string
}

export const BANNER_TEXTS: Record<Locale, BannerTexts> = {
  fr: {
    label: "Tes cookies. Ton choix.",
    body: "On utilise des cookies essentiels pour que le site fonctionne. Avec ton accord, on en utilise aussi pour les statistiques et les enregistrements de session.",
    accept: "Tout accepter",
    refuse: "Refuser le facultatif",
    customize: "Personnaliser",
    more: "Politique de confidentialité",
    close: "Fermer",
    essential: "Essentiels",
    essentialBody: "Ils font fonctionner le site : ta langue, ta place à une table, ta connexion et ce choix. Toujours actifs.",
    analytics: "Statistiques",
    analyticsBody: "Un identifiant est gardé sur cet appareil : on sait quand tu reviens et on voit ce qu'il faut améliorer.",
    recordings: "Enregistrements de session",
    recordingsBody: "Le déroulé d'une visite est enregistré pour voir où les joueurs bloquent. Saisies, chat et pseudos sont masqués. Nécessite les statistiques.",
    save: "Enregistrer mes choix",
    back: "Retour",
  },
  en: {
    label: "Your cookies. Your choice.",
    body: "We use essential cookies to keep the site working. With your permission, we also use cookies for analytics and session recordings.",
    accept: "Accept all",
    refuse: "Reject optional",
    customize: "Manage preferences",
    more: "Privacy policy",
    close: "Close",
    essential: "Essential",
    essentialBody: "They keep the site working: your language, your seat at a table, your sign-in and this choice. Always on.",
    analytics: "Analytics",
    analyticsBody: "An identifier is kept on this device, so we can tell when you come back and see what to improve.",
    recordings: "Session recordings",
    recordingsBody: "How a visit goes is recorded to see where players get stuck. Inputs, chat and nicknames are masked. Needs analytics.",
    save: "Save preferences",
    back: "Back",
  },
  es: {
    label: "Tus cookies. Tu elección.",
    body: "Usamos cookies esenciales para que el sitio funcione. Con tu permiso, también usamos cookies para estadísticas y grabaciones de sesión.",
    accept: "Aceptar todo",
    refuse: "Rechazar opcionales",
    customize: "Personalizar",
    more: "Política de privacidad",
    close: "Cerrar",
    essential: "Esenciales",
    essentialBody: "Hacen funcionar el sitio: tu idioma, tu sitio en una mesa, tu sesión y esta elección. Siempre activas.",
    analytics: "Estadísticas",
    analyticsBody: "Se guarda un identificador en este dispositivo: sabemos cuándo vuelves y vemos qué mejorar.",
    recordings: "Grabaciones de sesión",
    recordingsBody: "Se graba cómo va una visita para ver dónde se atascan los jugadores. Entradas, chat y apodos se enmascaran. Requiere estadísticas.",
    save: "Guardar preferencias",
    back: "Volver",
  },
  de: {
    label: "Deine Cookies. Deine Wahl.",
    body: "Wir verwenden notwendige Cookies, damit die Seite funktioniert. Mit deiner Zustimmung nutzen wir auch Cookies für Statistiken und Sitzungsaufzeichnungen.",
    accept: "Alle akzeptieren",
    refuse: "Optionale ablehnen",
    customize: "Anpassen",
    more: "Datenschutz",
    close: "Schließen",
    essential: "Notwendig",
    essentialBody: "Sie halten die Seite am Laufen: deine Sprache, dein Platz an einem Tisch, deine Anmeldung und diese Wahl. Immer aktiv.",
    analytics: "Statistiken",
    analyticsBody: "Eine Kennung wird auf diesem Gerät gespeichert: wir sehen, wann du wiederkommst, und was wir verbessern können.",
    recordings: "Sitzungsaufzeichnungen",
    recordingsBody: "Der Ablauf eines Besuchs wird aufgezeichnet, um zu sehen, wo Spieler hängen bleiben. Eingaben, Chat und Spitznamen sind maskiert. Benötigt Statistiken.",
    save: "Auswahl speichern",
    back: "Zurück",
  },
}

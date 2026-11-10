export const LANGUAGES = [
  { id: "fr", title: "Français" },
  { id: "en", title: "English" },
  { id: "es", title: "Español" },
  { id: "de", title: "Deutsch" },
] as const

/**
 * Languages of the platform's content (the catalog), English (US) first: it is the default and the fallback of every text. English (UK) comes second and has a text only where the UK writes it
 * otherwise; every other text of it is the one of English (US). A regional form of a language has the id of the language and its region (`en-GB`).
 * `LANGUAGES` stays the four languages of the games until their Studios move to the same system.
 */
export const PLATFORM_LANGUAGES = [
  { id: "en", title: "English (US)" },
  { id: "en-GB", title: "English (UK)" },
  { id: "fr", title: "Français" },
  { id: "es", title: "Español" },
  { id: "de", title: "Deutsch" },
  { id: "zh", title: "中文 (简体)" },
  { id: "ja", title: "日本語" },
  { id: "ru", title: "Русский" },
  { id: "ar", title: "العربية" },
  { id: "bn", title: "বাংলা" },
  { id: "hi", title: "हिन्दी" },
  { id: "pt", title: "Português" },
  { id: "ko", title: "한국어" },
] as const

export const DEFAULT_PLATFORM_LANGUAGE = "en"

// Fonts offered in Admin › Visual and in the studio (single source, re-exported by @pbgo/core/lib/settings)
export const FONT_CHOICES = [
  "Inter",
  "Nunito",
  "Fredoka",
  "Baloo 2",
  "Poppins",
  "Outfit",
  "DM Sans",
  "Montserrat",
  "Space Grotesk",
  "Lilita One",
  "Bangers",
  "Bebas Neue",
  "Cinzel",
  "Playfair Display",
  "Alegreya",
  "Press Start 2P",
] as const

/**
 * The labels that exist in English only: the code holds English, and the other languages come with the language pass (thirteen languages, PLT-32), not typed one by one here.
 * Their entries of `UI_TEXTS` carry this English text where `fr` goes and `translations.ts` gives it to every language, so a visitor reads English until the pass.
 * To translate one: write it in each language of `UI_TRANSLATIONS`, give its entry a French `fr` and take it out of this list.
 */
export const ENGLISH_ONLY_TEXTS = {
  defeatTitle: "Defeat",
  shareHeadlineDefeat: "{points} points · Defeat",
  lostWith: "{names} lost the game with {points} points.",
  addFriend: "Add friend",
  reportPlayer: "Report",
  viewProfile: "View profile",
  guest: "Guest",
} as const

/**
 * Interface labels shared by every game, editable in Sanity (document "Texts", tab "Interface") and in Admin › Copy.
 * `fr` is the French text; the defaults of the other languages, English (the default language) first, are in `translations.ts`. Variables in braces: {code}, {name}, {count}, {max}.
 */
export const UI_TEXTS = [
  // Home
  { key: "codeLabel", group: "home", title: "Code field label", fr: "Code de la partie" },
  { key: "feedbackButton", group: "home", title: "Feedback: button", fr: "Envoyer un feedback" },
  { key: "feedbackTitle", group: "home", title: "Feedback: title", fr: "Votre feedback" },
  { key: "feedbackType", group: "home", title: "Feedback: type label", fr: "Type de retour" },
  { key: "feedbackTypeReview", group: "home", title: "Feedback: type Review", fr: "Envoyer un avis" },
  { key: "feedbackTypeBug", group: "home", title: "Feedback: type Bug", fr: "Signaler un bug" },
  { key: "feedbackTypeSuggestion", group: "home", title: "Feedback: type Suggestion", fr: "Suggestion d'amélioration" },
  { key: "feedbackTypeOther", group: "home", title: "Feedback: type Other", fr: "Autres" },
  { key: "feedbackPlaceholder", group: "home", title: "Feedback: message placeholder", fr: "Ce qui vous plaît, ce qui coince, une idée…" },
  { key: "feedbackEmail", group: "home", title: "Feedback: email placeholder", fr: "Votre e-mail (facultatif, pour vous répondre)" },
  { key: "feedbackScreenshotAdd", group: "home", title: "Feedback: add screenshot", fr: "Ajouter une capture d'écran" },
  { key: "feedbackScreenshotRemove", group: "home", title: "Feedback: remove screenshot", fr: "Retirer la capture" },
  { key: "feedbackSend", group: "home", title: "Feedback: send button", fr: "Envoyer" },
  { key: "feedbackThanks", group: "home", title: "Feedback: thanks", fr: "Merci, votre message est bien arrivé !" },
  { key: "homeLink", group: "home", title: "Logo link (screen readers)", fr: "Accueil" },
  { key: "pageNotFound", group: "home", title: "Page not found (404)", fr: "Cette page est introuvable." },
  // Invitation and lobby
  { key: "gameNotFound", group: "lobby", title: "Game not found", fr: "Cette partie est introuvable. Vérifiez le code {code} ou créez-en une nouvelle." },
  { key: "alreadyStarted", group: "lobby", title: "Game already started", fr: "Cette partie a déjà commencé." },
  { key: "backHome", group: "lobby", title: "Back home button", fr: "Retour à l'accueil" },
  { key: "you", group: "lobby", title: "Lobby: (you)", fr: "(vous)" },
  { key: "host", group: "lobby", title: "Lobby: host label", fr: "Hôte" },
  // In game
  { key: "yourTurn", group: "game", title: "Your turn", fr: "C'est votre tour" },
  { key: "turnOf", group: "game", title: "Turn of a player", fr: "Au tour de {name}" },
  { key: "yourTurnShort", group: "game", title: "History: your turn", fr: "Votre tour" },
  { key: "turnOfShort", group: "game", title: "History: turn of a player", fr: "Tour de {name}" },
  { key: "waiting", group: "game", title: "Waiting (no active player)", fr: "La partie se prépare…" },
  { key: "waitingFor", group: "game", title: "Waiting for several players", fr: "En attente de {names}" },
  { key: "gameOver", group: "game", title: "Game over (ticker)", fr: "Fin de la partie" },
  { key: "leave", group: "game", title: "Leave button", fr: "Quitter" },
  { key: "takeoverPrompt", group: "game", title: "Absent player: prompt", fr: "{name} ne répond plus ?" },
  { key: "takeoverButton", group: "game", title: "Absent player: button", fr: "Jouer à sa place" },
  { key: "replay", group: "game", title: "Replay button", fr: "Rejouer" },
  { key: "winnerTitle", group: "game", title: "Scoreboard: above the winner", fr: "Victoire de" },
  { key: "showScores", group: "game", title: "Scoreboard: show", fr: "Afficher le tableau des scores" },
  { key: "hideScores", group: "game", title: "Scoreboard: hide", fr: "Masquer le tableau des scores" },
  { key: "scoreboard", group: "game", title: "Scoreboard: name (screen readers)", fr: "Tableau des scores" },
  { key: "shareResult", group: "game", title: "Scoreboard: share", fr: "Partager le résultat" },
  { key: "desktopOnly", group: "game", title: "Desktop only message", fr: "Ce jeu se joue sur ordinateur : agrandissez la fenêtre ou revenez depuis un écran plus large." },
  { key: "creditsAdaptation", group: "home", title: "Footer: adaptation", fr: "Adaptation en ligne non officielle et gratuite de" },
  { key: "creditsBy", group: "home", title: "Footer: “a game by”", fr: "un jeu de" },
  { key: "creditsPublishedBy", group: "home", title: "Footer: “published by”", fr: "et édité par" },
  { key: "creditsRights", group: "home", title: "Footer: rights", fr: "Tous droits réservés à leurs auteurs." },
  { key: "creditsRightsPublisher", group: "home", title: "Footer: rights (with publisher)", fr: "Tous droits réservés à leurs auteurs et à l’éditeur." },
  { key: "developedBy", group: "home", title: "Footer: developed by", fr: "Développé par" },
  { key: "claims", group: "home", title: "Footer: claims", fr: "Pour toute réclamation :" },
  { key: "soundSettings", group: "home", title: "Sound menu: button", fr: "Réglages du son" },
  { key: "soundTitle", group: "home", title: "Sound menu: title", fr: "Son" },
  { key: "soundMusic", group: "home", title: "Sound menu: music", fr: "Musique" },
  { key: "soundAmbience", group: "home", title: "Sound menu: ambience", fr: "Ambiance" },
  { key: "soundEffects", group: "home", title: "Sound menu: effects", fr: "Effets sonores" },
  { key: "soundAlerts", group: "home", title: "Sound menu: alerts", fr: "Alertes" },
  { key: "soundReactions", group: "home", title: "Sound menu: reactions", fr: "Réactions" },
  { key: "soundTrack", group: "home", title: "Sound menu: music track", fr: "Morceau" },
  { key: "soundOn", group: "home", title: "Sound button: turn on", fr: "Activer le son" },
  { key: "soundOff", group: "home", title: "Sound button: turn off", fr: "Couper le son" },
  { key: "language", group: "home", title: "Language selector label", fr: "Langue" },
  { key: "menu", group: "home", title: "Settings menu: open", fr: "Menu" },
  { key: "closeMenu", group: "home", title: "Settings menu: close", fr: "Fermer le menu" },
  { key: "gameSettingsMenu", group: "home", title: "Menu: game settings entry", fr: "Configuration de la partie" },
  { key: "gameSettingsStandard", group: "home", title: "Game settings: default configuration", fr: "Partie standard" },
  { key: "gameSettingsNone", group: "home", title: "Game settings: nothing configurable", fr: "Cette partie n'a aucune option." },
  { key: "gameSettingsOn", group: "home", title: "Game settings: extension on", fr: "Activée" },
  { key: "gameSettingsOff", group: "home", title: "Game settings: extension off", fr: "Désactivée" },
  { key: "cookiesMenu", group: "home", title: "Menu: cookies entry", fr: "Cookies" },
  { key: "cookiesBody", group: "home", title: "Cookies: text (blank line = new paragraph)", fr: "Ce jeu n'utilise aucun cookie publicitaire et ne te suit pas d'un site à l'autre.\n\nSeuls des traceurs nécessaires au fonctionnement sont utilisés : un cookie d'identité de joueur pour te reconnaître dans ta partie, un cookie de langue, et le stockage local de ton navigateur (pseudo, préférences de son).\n\nLes éventuelles mesures d'audience sont anonymes et n'utilisent pas de cookie." },
  { key: "legalMenu", group: "home", title: "Menu: legal entry", fr: "Mentions légales" },
  { key: "legalBody", group: "home", title: "Legal: text ({publisher}, {authors}, {contact}; blank line = new paragraph)", fr: "Éditeur : {publisher}\nAuteur : {authors}\nContact : {contact}\n\nHébergement : Vercel Inc. (vercel.com).\n\nLes noms, marques et univers des jeux de société cités appartiennent à leurs ayants droit. Ce site est une adaptation en ligne sans but d'usurpation." },
  { key: "chat", group: "game", title: "Chat: title", fr: "Chat" },
  { key: "chatPlaceholder", group: "game", title: "Chat: input placeholder", fr: "Écrire un message…" },
  { key: "chatSend", group: "game", title: "Chat: send button", fr: "Envoyer" },
  { key: "chatReactions", group: "game", title: "Chat: reactions button", fr: "Réactions" },
  { key: "reactionClap", group: "game", title: "Reaction: clap", fr: "Bravo" },
  { key: "reactionLaugh", group: "game", title: "Reaction: laugh", fr: "Haha" },
  { key: "reactionWow", group: "game", title: "Reaction: wow", fr: "Oh !" },
  { key: "reactionParty", group: "game", title: "Reaction: party", fr: "Fête" },
  { key: "reactionEvil", group: "game", title: "Reaction: evil laugh", fr: "Muahaha" },
  { key: "reactionSad", group: "game", title: "Reaction: sad", fr: "Snif" },
  { key: "reactionFire", group: "game", title: "Reaction: fire", fr: "Feu" },
  { key: "reactionLove", group: "game", title: "Reaction: love", fr: "Love" },
  { key: "chatEmpty", group: "game", title: "Chat: no message yet", fr: "Aucun message pour l’instant" },
  { key: "rules", group: "home", title: "Rules: title", fr: "Règles" },
  { key: "rulesTitle", group: "home", title: "Rules: button label", fr: "Règles du jeu" },
  { key: "rulesVideo", group: "home", title: "Rules: video tab", fr: "Vidéo" },
  { key: "rulesPdf", group: "home", title: "Rules: PDF link", fr: "Règles PDF ({lang})" },
  { key: "rulesVideoTitle", group: "home", title: "Rules: video title", fr: "Règles en vidéo" },
  { key: "gameParameters", group: "lobby", title: "Lobby: parameters section", fr: "Paramètres" },
  { key: "gameExtensions", group: "lobby", title: "Lobby: extensions section", fr: "Extensions" },
  { key: "resultAlt", group: "game", title: "Share: image description", fr: "Résultat de la partie" },
  { key: "copyImage", group: "game", title: "Share: copy image", fr: "Copier l'image" },
  { key: "download", group: "game", title: "Share: download", fr: "Télécharger" },
  { key: "imageCopied", group: "game", title: "Share: toast copied", fr: "Image copiée, il ne reste plus qu'à la coller" },
  { key: "imageError", group: "game", title: "Share: toast error", fr: "Impossible de générer l'image du résultat" },
  { key: "share", group: "game", title: "Share: share button", fr: "Partager" },
  { key: "copyFailed", group: "game", title: "Share: copy failed", fr: "Impossible de copier l'image" },
  { key: "shareFailed", group: "game", title: "Share: share failed", fr: "Impossible de partager l'image" },
  { key: "missionsWaiting", group: "game", title: "Opening: waiting for other players", fr: "En attente des autres joueurs ({read}/{total})" },
  { key: "missionsSkipPrompt", group: "game", title: "Opening: players still reading (prompt, {names} = who)", fr: "En attente de {names}…" },
  { key: "missionsSkipButton", group: "game", title: "Opening: start without waiting (button)", fr: "Commencer sans attendre" },
  { key: "winsWith", group: "game", title: "Share: text", fr: "{names} remporte la partie avec {points} points !" },
  { key: "shareHeadline", group: "game", title: "Share: image headline under the winner's name ({points} = their score)", fr: "{points} points · Victoire" },
  { key: "defeatTitle", group: "game", title: "Scoreboard and announcement: a table that lost together", fr: ENGLISH_ONLY_TEXTS.defeatTitle },
  { key: "shareHeadlineDefeat", group: "game", title: "Share: image headline of a table that lost together ({points} = the table's score)", fr: ENGLISH_ONLY_TEXTS.shareHeadlineDefeat },
  { key: "lostWith", group: "game", title: "Share: text of a table that lost together ({names} = the players, {points} = the table's score)", fr: ENGLISH_ONLY_TEXTS.lostWith },
  { key: "pointsShort", group: "game", title: "Scoreboard and share image: points of a player, abbreviated ({points} = their score)", fr: "{points} pts" },
  { key: "players", group: "game", title: "Players strip: name (screen readers)", fr: "Joueurs" },
  { key: "playersReady", group: "game", title: "Players strip: seats that are done, when there are too many to list ({ready} of {total})", fr: "{ready}/{total} prêts" },
  { key: "seatDone", group: "game", title: "Players strip: this player is done", fr: "Prêt" },
  { key: "seatWaiting", group: "game", title: "Players strip: the game waits for this player", fr: "En attente" },
  { key: "seatAway", group: "game", title: "Players strip: this player has left the table for now", fr: "Absent" },
  { key: "history", group: "game", title: "Ticker: history toggle (small screens)", fr: "Historique" },
  { key: "addFriend", group: "game", title: "Players list: the card of a player, the button that asks them to be a friend", fr: ENGLISH_ONLY_TEXTS.addFriend },
  { key: "reportPlayer", group: "game", title: "Players list: the card of a player, the button that reports them", fr: ENGLISH_ONLY_TEXTS.reportPlayer },
  { key: "viewProfile", group: "game", title: "Players list: the card of a player, the button that leads to their profile (opens in another tab, so that the game is not left)", fr: ENGLISH_ONLY_TEXTS.viewProfile },
  { key: "guest", group: "game", title: "Menu of the picture: what a visitor who is not signed in is called", fr: ENGLISH_ONLY_TEXTS.guest },
] as const

export type UiTextKey = (typeof UI_TEXTS)[number]["key"]
export const UI_TEXT_GROUPS = [
  { name: "home", title: "Home" },
  { name: "lobby", title: "Invitation & lobby" },
  { name: "game", title: "In game" },
] as const

/**
 * What a person did on a game of the platform's catalog: the credits of BoardGameGeek, in its words (an "editor" there edits the text,
 * the rules or the cards; the publisher of a game is a `publisher`). A person can have several on one game, and is a designer of one
 * game and an artist of another: the roles belong to the line of the game, not to the person. The Studio of the platform lists them
 * (`platform/apps/studio`), and the hub words its credit lines from the same list (`@pbgo/catalog`).
 */
export const CREATOR_ROLES = [
  { title: "Designer", value: "designer" },
  { title: "Solo designer", value: "soloDesigner" },
  { title: "Developer", value: "developer" },
  { title: "Artist", value: "artist" },
  { title: "Graphic designer", value: "graphicDesigner" },
  { title: "Editor", value: "editor" },
  { title: "Sculptor", value: "sculptor" },
  { title: "Writer", value: "writer" },
  { title: "Insert designer", value: "insertDesigner" },
] as const

export type CreatorRole = (typeof CREATOR_ROLES)[number]["value"]

/** The title of a role as the Studio and the hub show it; a value the list does not have (a role removed since) is shown as it is. */
export const roleTitle = (role: string): string => CREATOR_ROLES.find((entry) => entry.value === role)?.title ?? role

/**
 * The most pictures and clips a game's gallery holds after its cover (PLT-56): the page shows the cover first, then what the Studio puts in the
 * `gallery` of the game, pictures and short clips of a game being played. The limit of that field in the Studio and of what the hub reads.
 */
export const GALLERY_MAX = 5

/**
 * The most helpers a game offers in its lobby (PLT-56): the aids that a player may have while they play ("Show the score calculation"), a row and a switch each. The limit of the
 * `helpers` field of a game in the Studio and of what the hub reads.
 */
export const HELPERS_MAX = 8

/**
 * The longest description of a game or of an expansion of the platform's catalog, in characters and in each language: what the page of a
 * game says under its figures, and its start is what a search result says of it. The limit of the `description` field in the Studio
 * (`checkDescriptions` of the platform's rules).
 */
export const DESCRIPTION_MAX = 240

/**
 * The name of the type that a translated field of this kind has (`sanity-plugin-internationalized-array` makes it; `field-translations.ts` sets the
 * plugin up): `translatedType("string")` is `internationalizedArrayString`, the one of a custom kind named `description` is
 * `internationalizedArrayDescription`. The plugin writes the first letter in capitals, so a kind is one word, or camelCase. A row of the
 * array is of the same type followed by `Value` (`translatedRowType`).
 */
export const translatedType = (kind: string): string => `internationalizedArray${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
export const translatedRowType = (kind: string): string => `${translatedType(kind)}Value`

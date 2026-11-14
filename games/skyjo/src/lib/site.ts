export const SLUG = "skyjo"

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Skyjo"

export const KEYWORDS = ["Skyjo", "Skyjo en ligne", "jeu de cartes familial", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://skyjo.sanity.studio"

/**
 * The codes of the game's own refusals: the ones the engine throws that every game does not share (`SHARED_ERROR_CODES` of `@pbgo/engine-kit`, which the platform words: not your turn, invalid phase, game over…). Skyjo has three: a position
 * that is not a card of the grid, a card that is already face up, and a card taken from the discard that must be placed. Their messages are written in Sanity (Gamemaster › Copy › Errors; the seed in `content/data/texts.ts` drafts them).
 * `error-codes.test.ts` keeps this list and the engine in step.
 */
export const ERROR_CODES = ["INVALID_POSITION", "CARD_FACE_UP", "MUST_PLACE"]

export const SLUG = "love-letter"

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Love Letter"

export const KEYWORDS = ["Love Letter", "Love Letter en ligne", "jeu de déduction", "Seiji Kanai", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://love-letter.sanity.studio"

/**
 * The codes of the game's own refusals: the ones the engine throws that every game does not share (`SHARED_ERROR_CODES` of `@pbgo/engine-kit`, which the platform words: not your turn, invalid target, game over…). Love Letter has one, the Countess
 * played too late: a player who holds her with the King or a Prince must play her (booklet, p. 9).
 * Its message is written in Sanity (Gamemaster › Copy › Errors; the seed in `content/data/texts.ts` drafts it). `error-codes.test.ts` keeps this list and the engine in step.
 */
export const ERROR_CODES = ["MUST_PLAY_COUNTESS"]

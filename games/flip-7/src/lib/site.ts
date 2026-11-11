export const SLUG = "flip-7"

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Flip 7"

export const KEYWORDS = ["Flip 7", "Flip 7 en ligne", "jeu de stop ou encore", "push your luck", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://flip-7.sanity.studio"

/**
 * The codes of the game's own refusals: the ones the engine throws that every game does not share (`SHARED_ERROR_CODES` of `@pbgo/engine-kit`, which the platform words: not your turn, invalid target, game over…). Flip 7 has one, a stay with nothing in front of the player.
 * Its message is written in Sanity (Gamemaster › Copy › Errors; the seed in `content/data/texts.ts` drafts it). `error-codes.test.ts` keeps this list and the engine in step.
 */
export const ERROR_CODES = ["CANNOT_STAY"]

export const SLUG = "flip-7"

// Defaults, replaced by the /admin settings (Sanity document "settings")
export const NAME = "Flip 7"

export const KEYWORDS = ["Flip 7", "Flip 7 en ligne", "jeu de stop ou encore", "push your luck", "jeu de cartes en ligne", "jeu de société en ligne", "jeu entre amis", "jeu gratuit", "multijoueur"]

export const AUTHOR = { name: "oré", signature: "oré ˖ ࣪⊹", url: "https://ore.today" }

export const CONTACT = "hey@playboardgamesonline.app"

export const STUDIO_URL = "https://flip-7.sanity.studio"

/**
 * Codes the engine throws and core does not know (core has its own for the common ones, `NOT_YOUR_TURN` and `NOT_WAITING`).
 * Their messages are written in Sanity (Gamemaster › Copy › Errors).
 */
export const ERROR_CODES = ["INVALID_PLAYERS", "GAME_OVER", "INVALID_ACTION", "CANNOT_STAY", "INVALID_TARGET"] as const

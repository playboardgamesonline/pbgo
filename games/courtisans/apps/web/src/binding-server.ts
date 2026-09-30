// Côté serveur uniquement (alias "@pbgo/binding-server").
import { GAME } from "@courtisans/engine"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { loadMissions } from "./server/missions"
import { getClientCatalog } from "./sanity/catalog-client"

/** Missions (Sanity + complément par défaut) tirées au lancement de chaque partie. */
export const loadSetupData = () => loadMissions(GAME.maxPlayers)

/** Catalogue (images des cartes, familles, rôles, textes du jeu) passé au plateau. */
export const loadGameData = async () => getClientCatalog(await getLocale())

/** Règles propres à Courtisans (onglets illustrés, rôles, familles) à la place des règles communes. */
export const loadRules = async () => (await getClientCatalog(await getLocale())).rules

import { localeText } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"

// The source texts of the missions, as the game wrote them before its texts moved to Sanity; the drafts are made from them.
// Left out on purpose: `mission-dark-8`, `mission-dark-9` and `mission-dark-10`. The French text (and the condition) the Studio holds for them is
// not the one the game translated ("3 familles, au maximum, doivent être dans la lumière", "Une famille doit avoir au moins 5 cartes en dessous du
// tapis de jeu", "Au moins 1 carte de chaque famille doit être en dessous du tapis de jeu"), so copying its English, Spanish and German would
// give the players another mission than the one the engine checks. They need their own translations of the Studio's French.
const TEXTS: Record<string, Localized> = {
  "mission-light-1": {
    fr: "Vous devez posséder moins de carpes que votre voisin de gauche.",
    en: "You must own fewer carp than your left-hand neighbor.",
    es: "Debes poseer menos carpas que tu vecino de la izquierda.",
    de: "Du musst weniger Karpfen besitzen als dein linker Nachbar.",
  },
  "mission-light-2": {
    fr: "Vous devez posséder moins de cerfs que votre voisin de gauche.",
    en: "You must own fewer stags than your left-hand neighbor.",
    es: "Debes poseer menos ciervos que tu vecino de la izquierda.",
    de: "Du musst weniger Hirsche besitzen als dein linker Nachbar.",
  },
  "mission-light-3": {
    fr: "Vous devez posséder moins de crapauds que votre voisin de gauche.",
    en: "You must own fewer toads than your left-hand neighbor.",
    es: "Debes poseer menos sapos que tu vecino de la izquierda.",
    de: "Du musst weniger Kröten besitzen als dein linker Nachbar.",
  },
  "mission-light-4": {
    fr: "Vous devez posséder moins de lièvres que votre voisin de gauche.",
    en: "You must own fewer hares than your left-hand neighbor.",
    es: "Debes poseer menos liebres que tu vecino de la izquierda.",
    de: "Du musst weniger Hasen besitzen als dein linker Nachbar.",
  },
  "mission-light-5": {
    fr: "Vous devez posséder moins de papillons que votre voisin de gauche.",
    en: "You must own fewer butterflies than your left-hand neighbor.",
    es: "Debes poseer menos mariposas que tu vecino de la izquierda.",
    de: "Du musst weniger Schmetterlinge besitzen als dein linker Nachbar.",
  },
  "mission-light-6": {
    fr: "Vous devez posséder moins de rossignols que votre voisin de gauche.",
    en: "You must own fewer nightingales than your left-hand neighbor.",
    es: "Debes poseer menos ruiseñores que tu vecino de la izquierda.",
    de: "Du musst weniger Nachtigallen besitzen als dein linker Nachbar.",
  },
  "mission-light-7": {
    fr: "Vous devez posséder au moins 3 espions.",
    en: "You must own at least 3 spies.",
    es: "Debes poseer al menos 3 espías.",
    de: "Du musst mindestens 3 Spione besitzen.",
  },
  "mission-light-8": {
    fr: "Vous devez posséder au moins 3 nobles.",
    en: "You must own at least 3 nobles.",
    es: "Debes poseer al menos 3 nobles.",
    de: "Du musst mindestens 3 Adlige besitzen.",
  },
  "mission-light-9": {
    fr: "Vous devez posséder au moins 2 assassins.",
    en: "You must own at least 2 assassins.",
    es: "Debes poseer al menos 2 asesinos.",
    de: "Du musst mindestens 2 Attentäter besitzen.",
  },
  "mission-light-10": {
    fr: "Vous devez posséder au moins 4 gardes.",
    en: "You must own at least 4 guards.",
    es: "Debes poseer al menos 4 guardias.",
    de: "Du musst mindestens 4 Wachen besitzen.",
  },
  "mission-dark-1": {
    fr: "Les carpes doivent être en disgrâce à la cour.",
    en: "The carp must be in disgrace at court.",
    es: "Las carpas deben estar en desgracia en la corte.",
    de: "Die Karpfen müssen bei Hof in Ungnade sein.",
  },
  "mission-dark-2": {
    fr: "Les cerfs doivent être en disgrâce à la cour.",
    en: "The stags must be in disgrace at court.",
    es: "Los ciervos deben estar en desgracia en la corte.",
    de: "Die Hirsche müssen bei Hof in Ungnade sein.",
  },
  "mission-dark-3": {
    fr: "Les crapauds doivent être en disgrâce à la cour.",
    en: "The toads must be in disgrace at court.",
    es: "Los sapos deben estar en desgracia en la corte.",
    de: "Die Kröten müssen bei Hof in Ungnade sein.",
  },
  "mission-dark-4": {
    fr: "Les lièvres doivent être en disgrâce à la cour.",
    en: "The hares must be in disgrace at court.",
    es: "Las liebres deben estar en desgracia en la corte.",
    de: "Die Hasen müssen bei Hof in Ungnade sein.",
  },
  "mission-dark-5": {
    fr: "Les papillons doivent être en disgrâce à la cour.",
    en: "The butterflies must be in disgrace at court.",
    es: "Las mariposas deben estar en desgracia en la corte.",
    de: "Die Schmetterlinge müssen bei Hof in Ungnade sein.",
  },
  "mission-dark-6": {
    fr: "Les rossignols doivent être en disgrâce à la cour.",
    en: "The nightingales must be in disgrace at court.",
    es: "Los ruiseñores deben estar en desgracia en la corte.",
    de: "Die Nachtigallen müssen bei Hof in Ungnade sein.",
  },
  "mission-dark-7": {
    fr: "Au moins 2 familles doivent être en disgrâce à la cour.",
    en: "At least 2 families must be in disgrace at court.",
    es: "Al menos 2 familias deben estar en desgracia en la corte.",
    de: "Mindestens 2 Familien müssen bei Hof in Ungnade sein.",
  },
}

export const MISSION_IDS = Object.keys(TEXTS)

/** The texts of the missions the code translates correctly. The documents already exist in the Studio (colour, card, condition): only `text` is seeded. */
export function buildMissions(): SeedDoc[] {
  return Object.entries(TEXTS).map(([id, text]) => ({ _id: id, _type: "mission", text: localeText(text) }))
}

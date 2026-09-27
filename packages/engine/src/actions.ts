import { TAILLE_MAIN } from "./deck"
import { EngineError } from "./errors"
import type { Action, Cible, Courtisan, GameState, ZoneJeu } from "./types"

export function applyAction(state: GameState, action: Action): GameState {
  const next = structuredClone(state)
  switch (action.type) {
    case "lireMissions":
      lireMissions(next, action.joueurId)
      break
    case "jouerCarte":
      jouerCarte(next, action.joueurId, action.carteId, action.cible, action.cibleAssassinat)
      break
  }
  return next
}

function lireMissions(state: GameState, joueurId: string) {
  if (state.phase !== "missions") throw new EngineError("PHASE_INVALIDE")
  const joueur = state.joueurs.find((j) => j.id === joueurId)
  if (!joueur) throw new EngineError("JOUEUR_INCONNU")
  joueur.missionsLues = true
  if (state.joueurs.every((j) => j.missionsLues)) state.phase = "jeu"
}

export function zoneDeCible(state: GameState, joueurId: string, cible: Cible): ZoneJeu {
  if (cible.zone === "table") return "table"
  if (!state.joueurs.some((j) => j.id === cible.joueurId)) throw new EngineError("JOUEUR_INCONNU")
  return cible.joueurId === joueurId ? "domaine" : "domaineAdverse"
}

export function zonesDisponibles(state: GameState): ZoneJeu[] {
  return (["table", "domaine", "domaineAdverse"] as const).filter((z) => !state.zonesJouees.includes(z))
}

export function joueurActifId(state: GameState): string | null {
  return state.phase === "jeu" ? (state.joueurs[state.joueurActif]?.id ?? null) : null
}

function jouerCarte(state: GameState, joueurId: string, carteId: string, cible: Cible, cibleAssassinat?: string) {
  if (state.phase !== "jeu") throw new EngineError("PHASE_INVALIDE")
  const joueur = state.joueurs[state.joueurActif]
  if (!joueur || joueur.id !== joueurId) throw new EngineError("PAS_TON_TOUR")

  const index = joueur.main.findIndex((c) => c.id === carteId)
  const carte = joueur.main[index]
  if (!carte) throw new EngineError("CARTE_INCONNUE")

  const zone = zoneDeCible(state, joueurId, cible)
  if (state.zonesJouees.includes(zone)) throw new EngineError("ZONE_DEJA_JOUEE")
  if (cibleAssassinat && carte.role !== "assassin") throw new EngineError("ASSASSINAT_INVALIDE")

  joueur.main.splice(index, 1)
  if (cible.zone === "table") state.table.push({ carte, niveau: cible.niveau })
  else state.joueurs.find((j) => j.id === cible.joueurId)!.domaine.push(carte)
  state.journal.push({ type: "carteJouee", joueurId, carte, cible })

  if (cibleAssassinat) assassiner(state, joueurId, carte, cible, cibleAssassinat)

  state.zonesJouees.push(zone)
  if (state.zonesJouees.length === 3 || joueur.main.length === 0) finirTour(state)
}

function assassiner(state: GameState, joueurId: string, assassin: Courtisan, cible: Cible, victimeId: string) {
  if (victimeId === assassin.id) throw new EngineError("ASSASSINAT_INVALIDE")

  let victime: Courtisan | undefined
  let cibleVictime: Cible
  if (cible.zone === "table") {
    const i = state.table.findIndex((p) => p.carte.id === victimeId)
    const placement = state.table[i]
    if (!placement || placement.carte.role === "garde") throw new EngineError("ASSASSINAT_INVALIDE")
    state.table.splice(i, 1)
    victime = placement.carte
    cibleVictime = { zone: "table", niveau: placement.niveau }
  } else {
    const domaine = state.joueurs.find((j) => j.id === cible.joueurId)!.domaine
    const i = domaine.findIndex((c) => c.id === victimeId)
    victime = domaine[i]
    if (!victime || victime.role === "garde") throw new EngineError("ASSASSINAT_INVALIDE")
    domaine.splice(i, 1)
    cibleVictime = cible
  }

  state.eliminees.push(victime)
  state.journal.push({ type: "carteEliminee", joueurId, carte: victime, cible: cibleVictime })
}

function finirTour(state: GameState) {
  const joueur = state.joueurs[state.joueurActif]!
  const piochees = state.pioche.splice(0, TAILLE_MAIN)
  if (piochees.length > 0) {
    joueur.main.push(...piochees)
    state.journal.push({ type: "pioche", joueurId: joueur.id, nombre: piochees.length })
  }
  state.zonesJouees = []

  const total = state.joueurs.length
  for (let pas = 1; pas <= total; pas++) {
    const candidat = (state.joueurActif + pas) % total
    if (state.joueurs[candidat]!.main.length > 0) {
      state.joueurActif = candidat
      state.numeroTour++
      return
    }
  }
  state.phase = "fin"
  state.journal.push({ type: "finDePartie" })
}

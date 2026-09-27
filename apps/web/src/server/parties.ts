import "server-only"
import { type GameState, type JoueurInfo, vueJoueur } from "@courtisans/engine"
import { type PartiePublique, type StatutPartie, EVENEMENT_MAJ, canalPartie } from "@/lib/partie-types"
import { ApiError } from "./api"
import { codeValide, genererCode, normaliserCode } from "./code"
import { supabaseAdmin } from "./supabase"

export type PartieRow = {
  code: string
  hote_id: string
  statut: StatutPartie
  joueurs: JoueurInfo[]
  etat: GameState | null
  rejouer: string[]
  version: number
}

const COLONNES = "code, hote_id, statut, joueurs, etat, rejouer, version"

export async function lirePartie(codeBrut: string): Promise<PartieRow> {
  const code = normaliserCode(codeBrut)
  if (!codeValide(code)) throw new ApiError("CODE_INVALIDE")
  const { data, error } = await supabaseAdmin().from("parties").select(COLONNES).eq("code", code).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError("PARTIE_INTROUVABLE", 404)
  return data as PartieRow
}

export async function creerPartie(hote: JoueurInfo): Promise<PartieRow> {
  const db = supabaseAdmin()
  for (let essai = 0; essai < 5; essai++) {
    const row = { code: genererCode(), hote_id: hote.id, statut: "lobby" as const, joueurs: [hote], etat: null, rejouer: [], version: 0 }
    const { error } = await db.from("parties").insert(row)
    if (!error) return row
    if (error.code !== "23505") throw error
  }
  throw new ApiError("CODE_INDISPONIBLE", 500)
}

export async function modifierPartie(code: string, modifier: (row: PartieRow) => Partial<Omit<PartieRow, "code" | "version">> | null): Promise<PartieRow> {
  const db = supabaseAdmin()
  for (let essai = 0; essai < 5; essai++) {
    const row = await lirePartie(code)
    const patch = modifier(row)
    if (!patch) return row
    const next = { ...row, ...patch, version: row.version + 1 }
    const { data, error } = await db
      .from("parties")
      .update({ ...patch, version: next.version, updated_at: new Date().toISOString() })
      .eq("code", row.code)
      .eq("version", row.version)
      .select("code")
    if (error) throw error
    if (data.length === 1) {
      await notifier(row.code, next.version)
      return next
    }
  }
  throw new ApiError("CONFLIT", 409)
}

async function notifier(code: string, version: number) {
  try {
    await supabaseAdmin().channel(canalPartie(code)).httpSend(EVENEMENT_MAJ, { version })
  } catch (error) {
    console.error("Broadcast realtime impossible", error)
  }
}

export function partiePublique(row: PartieRow, joueurId: string | null): PartiePublique {
  const membre = row.joueurs.some((j) => j.id === joueurId)
  return {
    code: row.code,
    hoteId: row.hote_id,
    statut: row.statut,
    joueurs: row.joueurs,
    moiId: membre ? joueurId : null,
    rejouer: row.rejouer,
    version: row.version,
    vue: row.etat ? vueJoueur(row.etat, membre ? joueurId : null) : null,
  }
}

import "server-only"
import type { Famille, Role } from "@courtisans/engine"
import { CATALOGUE_PAR_DEFAUT, type CatalogueClient, cleCarte } from "@/lib/catalogue"
import { getCatalogue } from "./catalogue"
import { urlFor } from "./image"

type Source = Parameters<typeof urlFor>[0]
const url = (source: Source | null | undefined, width: number) => (source ? urlFor(source).width(width).url() : null)

export async function getCatalogueClient(): Promise<CatalogueClient> {
  try {
    const { reglages, chateaux, familles, roles, courtisans, missions } = await getCatalogue()
    const d = CATALOGUE_PAR_DEFAUT

    const famillesMap = { ...d.familles }
    for (const f of familles) {
      const cle = f.cle as Famille | undefined
      if (!cle || !famillesMap[cle]) continue
      famillesMap[cle] = { ...famillesMap[cle], nom: f.nom ?? famillesMap[cle].nom, couleur: f.couleur ?? famillesMap[cle].couleur, pictoUrl: url(f.picto, 128) }
    }
    const rolesMap = { ...d.roles }
    for (const r of roles) {
      const cle = r.cle as Role | undefined
      if (!cle || !rolesMap[cle]) continue
      rolesMap[cle] = { ...rolesMap[cle], nom: r.nom ?? rolesMap[cle].nom, pictoUrl: url(r.picto, 128) }
    }

    const cartes: Record<string, string> = {}
    for (const c of courtisans) {
      const imageUrl = url(c.carte, 360)
      if (c.famille && imageUrl) cartes[cleCarte(c.famille as Famille, (c.role as Role | null) ?? null)] = imageUrl
    }
    const missionsMap: Record<string, string> = {}
    for (const m of missions) {
      const imageUrl = url(m.carte, 520)
      if (imageUrl) missionsMap[m._id] = imageUrl
    }

    const depuisSanity = chateaux.flatMap((c) => (c.image ? [{ id: c._id, nom: c.nom ?? "Château", imageUrl: url(c.image, 240) }] : []))

    return {
      logoUrl: url(reglages?.logo, 1000) ?? d.logoUrl,
      chateaux: depuisSanity.length > 0 ? depuisSanity : d.chateaux,
      familles: famillesMap,
      roles: rolesMap,
      cartes,
      missions: missionsMap,
      tapisUrl: url(reglages?.tapis, 2400) ?? d.tapisUrl,
      dosCourtisanUrl: url(reglages?.dosCourtisan, 360),
      dosMissionBlancheUrl: url(reglages?.dosMissionBlanche, 520),
      dosMissionBleueUrl: url(reglages?.dosMissionBleue, 520),
      phrasesVainqueur: reglages?.phrasesVainqueur?.length ? reglages.phrasesVainqueur : d.phrasesVainqueur,
    }
  } catch (error) {
    console.error("Catalogue Sanity indisponible", error)
    return CATALOGUE_PAR_DEFAUT
  }
}

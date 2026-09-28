import "server-only"
import type { Famille, Role } from "@courtisans/engine"
import { CATALOGUE_PAR_DEFAUT, type CatalogueClient, cleCarte, type ImagesRegles } from "@/lib/catalogue"
import { getCatalogue } from "./catalogue"
import { urlFor } from "./image"

type Source = Parameters<typeof urlFor>[0]
const url = (source: Source | null | undefined, width: number) => (source ? urlFor(source).width(width).url() : null)

export async function getCatalogueClient(): Promise<CatalogueClient> {
  try {
    const { assets, board, rules, textes, familles, roles, courtisans, missions } = await getCatalogue()
    const d = CATALOGUE_PAR_DEFAUT

    const famillesMap = { ...d.familles }
    for (const f of familles) {
      const cle = f.cle as Famille | undefined
      if (!cle || !famillesMap[cle]) continue
      famillesMap[cle] = {
        ...famillesMap[cle],
        nom: f.nom ?? famillesMap[cle].nom,
        couleur: f.couleur ?? famillesMap[cle].couleur,
        pictoUrl: url(f.picto, 128) ?? famillesMap[cle].pictoUrl,
      }
    }
    const rolesMap = { ...d.roles }
    for (const r of roles) {
      const cle = r.cle as Role | undefined
      if (!cle || !rolesMap[cle]) continue
      rolesMap[cle] = { ...rolesMap[cle], nom: r.nom ?? rolesMap[cle].nom, pictoUrl: url(r.picto, 128) ?? rolesMap[cle].pictoUrl }
    }

    const cartes: Record<string, string> = { ...d.cartes }
    for (const c of courtisans) {
      const imageUrl = url(c.carte, 360)
      if (c.famille && imageUrl) cartes[cleCarte(c.famille as Famille, (c.role as Role | null) ?? null)] = imageUrl
    }
    const missionsMap: Record<string, string> = { ...d.missions }
    for (const m of missions) {
      const imageUrl = url(m.carte, 520)
      if (imageUrl) missionsMap[m._id] = imageUrl
    }

    return {
      logoUrl: url(assets?.logo, 1000) ?? d.logoUrl,
      chateaux: d.chateaux,
      familles: famillesMap,
      roles: rolesMap,
      cartes,
      missions: missionsMap,
      tapisUrl: url(board?.tapis, 2000) ?? d.tapisUrl,
      dosCourtisanUrl: url(assets?.dosCourtisan, 360) ?? d.dosCourtisanUrl,
      dosMissionBlancheUrl: url(assets?.dosMissionBlanche, 520) ?? d.dosMissionBlancheUrl,
      dosMissionBleueUrl: url(assets?.dosMissionBleue, 520) ?? d.dosMissionBleueUrl,
      banquetHautUrl: url(assets?.banquetHaut, 3000) ?? d.banquetHautUrl,
      banquetBasUrl: url(assets?.banquetBas, 3000) ?? d.banquetBasUrl,
      regles: Object.fromEntries(
        Object.entries(d.regles).map(([cle, defaut]) => [cle, url(rules?.[cle as keyof NonNullable<typeof rules>], 1400) ?? defaut]),
      ) as ImagesRegles,
      phrasesVainqueur: textes?.phrasesVainqueur?.length ? textes.phrasesVainqueur : d.phrasesVainqueur,
    }
  } catch (error) {
    console.error("Catalogue Sanity indisponible", error)
    return CATALOGUE_PAR_DEFAUT
  }
}

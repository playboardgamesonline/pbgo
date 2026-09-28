import "server-only"
import type { Famille, Role } from "@courtisans/engine"
import { CATALOGUE_PAR_DEFAUT, type CatalogueClient, cleCarte, FAMILLES_VISUEL_ROLE, MISSIONS_VISUEL_REGLES, type RoleRegles } from "@/lib/catalogue"
import { TEXTES_REGLES_DEFAUT, type TextesRegles } from "@/lib/regles-defaut"
import { type Localise, traduire } from "@/lib/i18n"
import { getCatalogue } from "./catalogue"
import { urlFor } from "./image"

type Source = Parameters<typeof urlFor>[0]
const url = (source: Source | null | undefined, width: number) => (source ? urlFor(source).width(width).url() : null)

export async function getCatalogueClient(): Promise<CatalogueClient> {
  try {
    const { interface: iface, game, rules, texts, families, roles, courtiers, missions } = await getCatalogue()
    const d = CATALOGUE_PAR_DEFAUT

    const famillesMap = { ...d.familles }
    for (const f of families) {
      const cle = f.key as Famille | undefined
      if (!cle || !famillesMap[cle]) continue
      famillesMap[cle] = {
        ...famillesMap[cle],
        nom: traduire(f.name) ?? famillesMap[cle].nom,
        couleur: f.color ?? famillesMap[cle].couleur,
        pictoUrl: url(f.pictogram, 128) ?? famillesMap[cle].pictoUrl,
      }
    }
    const rolesMap = { ...d.roles }
    const reglesRoles: Record<Role, RoleRegles> = { ...d.regles.roles }
    for (const r of roles) {
      const cle = r.key as Role | undefined
      if (!cle || !rolesMap[cle]) continue
      const nom = traduire(r.name) ?? rolesMap[cle].nom
      rolesMap[cle] = { ...rolesMap[cle], nom, pictoUrl: url(r.pictogram, 128) ?? rolesMap[cle].pictoUrl }
      reglesRoles[cle] = {
        ...reglesRoles[cle],
        nom,
        nombre: r.countPerFamily ?? reglesRoles[cle].nombre,
        texte: traduire(r.rule) || reglesRoles[cle].texte,
        letteringUrl: r.lettering ?? null,
        pictoUrl: rolesMap[cle].pictoUrl,
      }
    }

    const cartes: Record<string, string> = { ...d.cartes }
    for (const c of courtiers) {
      const imageUrl = url(c.card, 360)
      if (c.family && imageUrl) cartes[cleCarte(c.family as Famille, (c.role as Role | null) ?? null)] = imageUrl
    }
    for (const r of Object.keys(reglesRoles) as Role[])
      reglesRoles[r] = { ...reglesRoles[r], cartes: FAMILLES_VISUEL_ROLE[r].map((f) => cartes[cleCarte(f, r)]) as [string, string] }
    const missionsMap: Record<string, string> = { ...d.missions }
    for (const m of missions) {
      const imageUrl = url(m.card, 520)
      if (imageUrl) missionsMap[m._id] = imageUrl
    }

    return {
      logoUrl: url(iface?.logo, 1000) ?? d.logoUrl,
      chateaux: d.chateaux,
      familles: famillesMap,
      roles: rolesMap,
      cartes,
      missions: missionsMap,
      tapisUrl: url(game?.mat, 2000) ?? d.tapisUrl,
      tissuUrl: url(game?.matTexture, 1024) ?? d.tissuUrl,
      dosCourtisanUrl: url(game?.courtierBack, 360) ?? d.dosCourtisanUrl,
      dosMissionBlancheUrl: url(game?.whiteMissionBack, 520) ?? d.dosMissionBlancheUrl,
      dosMissionBleueUrl: url(game?.blueMissionBack, 520) ?? d.dosMissionBleueUrl,
      banquetHautUrl: url(iface?.banquetTop, 3000) ?? d.banquetHautUrl,
      banquetBasUrl: url(iface?.banquetBottom, 3000) ?? d.banquetBasUrl,
      reineUrl: url(iface?.queen, 1400) ?? d.reineUrl,
      motifUrl: url(iface?.pattern, 512) ?? d.motifUrl,
      papierUrl: url(iface?.paper, 1600) ?? d.papierUrl,
      flecheHautUrl: url(iface?.arrowUp, 256) ?? d.flecheHautUrl,
      flecheBasUrl: url(iface?.arrowDown, 256) ?? d.flecheBasUrl,
      regles: {
        textes: Object.fromEntries(
          Object.entries(TEXTES_REGLES_DEFAUT).map(([cle, defaut]) => {
            const brut = rules?.[cle as keyof typeof rules] as unknown
            const valeur = typeof brut === "string" ? brut : traduire(brut as Localise)
            return [cle, valeur?.trim() ? valeur : defaut]
          }),
        ) as TextesRegles,
        roles: reglesRoles,
        familles: d.regles.familles.map((f) => ({
          ...f,
          nom: famillesMap[f.cle].nom,
          couleur: famillesMap[f.cle].couleur,
          pictoUrl: famillesMap[f.cle].pictoUrl,
          carteUrl: cartes[cleCarte(f.cle, null)] ?? f.carteUrl,
        })),
        missions: MISSIONS_VISUEL_REGLES.map((id, i) => missionsMap[id] ?? d.regles.missions[i]!) as [string, string],
        cadrePicto: url(iface?.pictogramFrame, 240) ?? d.regles.cadrePicto,
      },
      phrasesVainqueur: traduire(texts?.winnerPhrases)?.length ? traduire(texts?.winnerPhrases)! : d.phrasesVainqueur,
      texteBoutonMissions: traduire(texts?.missionsButton)?.trim() || d.texteBoutonMissions,
      texteDebutBanquet: traduire(texts?.banquetStarts)?.trim() || d.texteDebutBanquet,
      texteConvives: traduire(texts?.guestsSettling)?.trim() || d.texteConvives,
    }
  } catch (error) {
    console.error("Catalogue Sanity indisponible", error)
    return CATALOGUE_PAR_DEFAUT
  }
}

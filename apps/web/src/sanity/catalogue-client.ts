import "server-only"
import { CHATEAUX_PAR_DEFAUT, type CatalogueClient } from "@/lib/catalogue"
import { getCatalogue } from "./catalogue"
import { urlFor } from "./image"

export async function getCatalogueClient(): Promise<CatalogueClient> {
  try {
    const { reglages, chateaux } = await getCatalogue()
    const depuisSanity = chateaux.flatMap((c) =>
      c.image ? [{ id: c._id, nom: c.nom ?? "Château", imageUrl: urlFor(c.image).width(240).url() }] : [],
    )
    return {
      logoUrl: reglages?.logo ? urlFor(reglages.logo).width(1000).url() : "/logo.png",
      chateaux: depuisSanity.length > 0 ? depuisSanity : CHATEAUX_PAR_DEFAUT,
    }
  } catch (error) {
    console.error("Catalogue Sanity indisponible", error)
    return { logoUrl: "/logo.png", chateaux: CHATEAUX_PAR_DEFAUT }
  }
}

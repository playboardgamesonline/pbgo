export type ChateauOption = { id: string; nom: string; imageUrl: string | null }

export const CHATEAUX_PAR_DEFAUT: ChateauOption[] = [
  { id: "chateau-or", nom: "Château d'Or", imageUrl: null },
  { id: "chateau-pourpre", nom: "Château Pourpre", imageUrl: null },
  { id: "chateau-azur", nom: "Château d'Azur", imageUrl: null },
  { id: "chateau-sylve", nom: "Château de Sylve", imageUrl: null },
  { id: "chateau-ambre", nom: "Château d'Ambre", imageUrl: null },
]

export type CatalogueClient = {
  logoUrl: string
  chateaux: ChateauOption[]
}

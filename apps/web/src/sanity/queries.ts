import { defineQuery } from "next-sanity"

export const CATALOGUE_QUERY = defineQuery(`{
  "interface": *[_id == "interface"][0]{ logo, banquetHaut, banquetBas },
  "game": *[_id == "game"][0]{ tapis, dosCourtisan, dosMissionBlanche, dosMissionBleue },
  "rules": *[_id == "rules"][0],
  "textes": *[_id == "textes"][0]{ phrasesVainqueur },
  "familles": *[_type == "famille"]{ _id, nom, cle, couleur, picto },
  "roles": *[_type == "role"]{ _id, nom, cle, picto, visuel, regle, "lettering": lettering.asset->url },
  "courtisans": *[_type == "courtisan"]{ _id, quantite, carte, "famille": famille->cle, "role": role->cle },
  "missions": *[_type == "mission"]{ _id, couleur, texte, carte, condition }
}`)

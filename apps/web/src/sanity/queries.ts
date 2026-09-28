import { defineQuery } from "next-sanity"

export const CATALOGUE_QUERY = defineQuery(`{
  "assets": *[_id == "assets"][0]{ logo, tapis, dosCourtisan, dosMissionBlanche, dosMissionBleue, banquetHaut, banquetBas },
  "textes": *[_id == "textes"][0]{ phrasesVainqueur },
  "familles": *[_type == "famille"]{ _id, nom, cle, couleur, picto },
  "roles": *[_type == "role"]{ _id, nom, cle, picto },
  "courtisans": *[_type == "courtisan"]{ _id, quantite, carte, "famille": famille->cle, "role": role->cle },
  "missions": *[_type == "mission"]{ _id, couleur, texte, carte, condition }
}`)

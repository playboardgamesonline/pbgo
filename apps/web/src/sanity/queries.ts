import { defineQuery } from "next-sanity"

export const CATALOGUE_QUERY = defineQuery(`{
  "assets": *[_id == "assets"][0]{ logo, dosCourtisan, dosMissionBlanche, dosMissionBleue, banquetHaut, banquetBas },
  "board": *[_id == "board"][0]{ tapis },
  "rules": *[_id == "rules"][0]{ missions, noble, garde, espion, assassin, table, exempleEspion, exempleAssassin, decompteTable, decompteDomaine },
  "textes": *[_id == "textes"][0]{ phrasesVainqueur },
  "familles": *[_type == "famille"]{ _id, nom, cle, couleur, picto },
  "roles": *[_type == "role"]{ _id, nom, cle, picto },
  "courtisans": *[_type == "courtisan"]{ _id, quantite, carte, "famille": famille->cle, "role": role->cle },
  "missions": *[_type == "mission"]{ _id, couleur, texte, carte, condition }
}`)

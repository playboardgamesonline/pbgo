import { CogIcon } from "@sanity/icons/Cog"
import { defineField, defineType } from "sanity"

export const reglages = defineType({
  name: "reglages",
  title: "Réglages",
  type: "document",
  icon: CogIcon,
  fields: [
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({ name: "tapis", title: "Tapis de jeu", type: "image" }),
    defineField({ name: "dosCourtisan", title: "Dos des cartes Courtisan", description: "Aussi utilisé pour les espions face cachée", type: "image" }),
    defineField({ name: "dosMissionBlanche", title: "Dos des Missions blanches", type: "image" }),
    defineField({ name: "dosMissionBleue", title: "Dos des Missions bleues", type: "image" }),
    defineField({
      name: "phrasesVainqueur",
      title: "Phrases du vainqueur",
      description: "Utilisez {pseudo} et {points}. Une phrase est tirée au hasard en fin de partie.",
      type: "array",
      of: [{ type: "string" }],
    }),
  ],
  preview: { prepare: () => ({ title: "Réglages" }) },
})

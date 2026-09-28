import { ImagesIcon } from "@sanity/icons/Images"
import { defineField, defineType } from "sanity"

export const assets = defineType({
  name: "assets",
  title: "Assets",
  type: "document",
  icon: ImagesIcon,
  groups: [
    { name: "jeu", title: "Jeu", default: true },
    { name: "banquet", title: "Décor du banquet" },
  ],
  fields: [
    defineField({ name: "logo", title: "Logo", type: "image", group: "jeu" }),
    defineField({ name: "tapis", title: "Tapis de jeu", type: "image", group: "jeu" }),
    defineField({
      name: "dosCourtisan",
      title: "Dos des cartes Courtisan",
      description: "Aussi utilisé pour les espions face cachée",
      type: "image",
      group: "jeu",
    }),
    defineField({ name: "dosMissionBlanche", title: "Dos des Missions blanches", type: "image", group: "jeu" }),
    defineField({ name: "dosMissionBleue", title: "Dos des Missions bleues", type: "image", group: "jeu" }),
    defineField({
      name: "banquetHaut",
      title: "Décoration du haut",
      description:
        "Suspendue en haut des écrans d'accueil et de lobby (guirlandes, lanternes…). PNG ou WebP transparent, idéalement 3500 px de large.",
      type: "image",
      group: "banquet",
    }),
    defineField({
      name: "banquetBas",
      title: "Décoration du bas",
      description: "La table du banquet en bas des écrans d'accueil et de lobby. PNG ou WebP transparent, idéalement 3500 px de large.",
      type: "image",
      group: "banquet",
    }),
  ],
  preview: { prepare: () => ({ title: "Assets" }) },
})

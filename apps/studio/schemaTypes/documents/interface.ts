import { ImagesIcon } from "@sanity/icons/Images"
import { defineField, defineType } from "sanity"

export const interfaceDoc = defineType({
  name: "interface",
  title: "Interface",
  type: "document",
  icon: ImagesIcon,
  fields: [
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({
      name: "banquetHaut",
      title: "Décoration du banquet (haut)",
      description:
        "Suspendue en haut des écrans d'accueil et de lobby (guirlandes, lanternes…). PNG ou WebP transparent, idéalement 3500 px de large.",
      type: "image",
    }),
    defineField({
      name: "banquetBas",
      title: "Décoration du banquet (bas)",
      description: "La table du banquet en bas des écrans d'accueil et de lobby. PNG ou WebP transparent, idéalement 3500 px de large.",
      type: "image",
    }),
  ],
  preview: { prepare: () => ({ title: "Interface" }) },
})

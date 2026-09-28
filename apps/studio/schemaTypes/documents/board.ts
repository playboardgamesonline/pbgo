import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType } from "sanity"

export const board = defineType({
  name: "board",
  title: "Board",
  type: "document",
  icon: ThLargeIcon,
  fields: [
    defineField({ name: "tapis", title: "Tapis de jeu", description: "Le tapis de la table de la Reine, au centre du plateau.", type: "image" }),
    defineField({
      name: "decorations",
      title: "Décorations",
      description: "Éléments de décor du plateau, à placer plus tard (bougies, coupes, pétales…). PNG ou WebP transparent.",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "decoration",
          fields: [
            defineField({ name: "nom", title: "Nom", type: "string", validation: (r) => r.required() }),
            defineField({ name: "image", title: "Image", type: "image", validation: (r) => r.required() }),
          ],
          preview: { select: { title: "nom", media: "image" } },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Board" }) },
})

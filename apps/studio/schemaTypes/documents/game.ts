import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineArrayMember, defineField, defineType } from "sanity"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [
    { name: "plateau", title: "Board", default: true },
    { name: "cartes", title: "Card backs" },
  ],
  fields: [
    defineField({
      name: "tapis",
      title: "Tapis de jeu",
      description: "Le tapis de la table de la Reine, au centre du plateau.",
      type: "image",
      group: "plateau",
    }),
    defineField({
      name: "decorations",
      title: "Décorations",
      description: "Éléments de décor du plateau, à placer plus tard (bougies, coupes, pétales…). PNG ou WebP transparent.",
      type: "array",
      group: "plateau",
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
    defineField({
      name: "dosCourtisan",
      title: "Dos des cartes Courtisan",
      description: "Aussi utilisé pour les espions face cachée",
      type: "image",
      group: "cartes",
    }),
    defineField({ name: "dosMissionBlanche", title: "Dos des Missions blanches", type: "image", group: "cartes" }),
    defineField({ name: "dosMissionBleue", title: "Dos des Missions bleues", type: "image", group: "cartes" }),
  ],
  preview: { prepare: () => ({ title: "Game" }) },
})

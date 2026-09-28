import { TagIcon } from "@sanity/icons/Tag"
import { defineField, defineType } from "sanity"
import { FAMILLES } from "../constants"

export const famille = defineType({
  name: "famille",
  title: "Famille",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "nom", title: "Nom", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "cle",
      title: "Clé de jeu",
      description: "Lien avec les règles du moteur de jeu",
      type: "string",
      options: { list: FAMILLES, layout: "dropdown" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "couleur",
      title: "Couleur",
      description: "Hexadécimal, ex. #e9b634",
      type: "string",
      validation: (r) => r.required().regex(/^#[0-9a-fA-F]{6}$/, { name: "hex" }),
    }),
    defineField({ name: "picto", title: "Pictogram", type: "image", validation: (r) => r.required() }),
  ],
  preview: { select: { title: "nom", subtitle: "couleur", media: "picto" } },
})

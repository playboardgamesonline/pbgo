import { StarIcon } from "@sanity/icons/Star"
import { defineField, defineType } from "sanity"
import { ROLES } from "../constants"

export const role = defineType({
  name: "role",
  title: "Rôle",
  type: "document",
  icon: StarIcon,
  fields: [
    defineField({ name: "nom", title: "Nom", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "cle",
      title: "Clé de jeu",
      type: "string",
      options: { list: ROLES, layout: "dropdown" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "picto", title: "Picto", type: "image", validation: (r) => r.required() }),
  ],
  preview: { select: { title: "nom", media: "picto" } },
})

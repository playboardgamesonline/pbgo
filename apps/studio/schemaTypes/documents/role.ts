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
    defineField({ name: "picto", title: "Pictogram", type: "image", validation: (r) => r.required() }),
    defineField({
      name: "visuel",
      title: "Visuel des règles",
      description: "Les cartes de ce rôle, affichées dans l'onglet « Les rôles » des règles.",
      type: "image",
    }),
    defineField({
      name: "lettering",
      title: "Lettering",
      description: "Le nom du rôle en calligraphie (SVG), affiché à la place du texte dans les règles.",
      type: "image",
      options: { accept: "image/svg+xml" },
    }),
    defineField({
      name: "regle",
      title: "Règle",
      description: "Balises : {lumiere}, {disgrace}, {neutre} affichent les étiquettes colorées ; **texte** met en gras.",
      type: "text",
      rows: 3,
    }),
  ],
  preview: { select: { title: "nom", media: "picto" } },
})

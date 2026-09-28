import { StarIcon } from "@sanity/icons/Star"
import { defineField, defineType } from "sanity"
import { ROLES } from "../constants"

export const role = defineType({
  name: "role",
  title: "Role",
  type: "document",
  icon: StarIcon,
  fields: [
    defineField({ name: "nom", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "cle",
      title: "Game key",
      type: "string",
      options: { list: ROLES, layout: "dropdown" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "picto", title: "Pictogram", type: "image", validation: (r) => r.required() }),
    defineField({
      name: "visuel",
      title: "Rules visual",
      description: "The cards of this role, shown in the Roles tab of the rules.",
      type: "image",
    }),
    defineField({
      name: "lettering",
      title: "Lettering",
      description: "The role's name as calligraphy (SVG), shown instead of the text in the rules.",
      type: "image",
      options: { accept: "image/svg+xml" },
    }),
    defineField({
      name: "regle",
      title: "Rule",
      description: "Tags: {lumiere}, {disgrace}, {neutre} show the coloured labels; **text** makes bold.",
      type: "text",
      rows: 3,
    }),
  ],
  preview: {
    select: { cle: "cle", media: "picto" },
    prepare: ({ cle, media }) => ({ title: ROLES.find((r) => r.value === cle)?.title ?? cle, media }),
  },
})

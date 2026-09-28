import { TagIcon } from "@sanity/icons/Tag"
import { defineField, defineType } from "sanity"
import { FAMILLES } from "../constants"

export const famille = defineType({
  name: "famille",
  title: "Family",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "nom", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "cle",
      title: "Game key",
      description: "Link with the game engine rules",
      type: "string",
      options: { list: FAMILLES, layout: "dropdown" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "couleur",
      title: "Colour",
      description: "Hexadecimal, e.g. #e9b634",
      type: "string",
      validation: (r) => r.required().regex(/^#[0-9a-fA-F]{6}$/, { name: "hex" }),
    }),
    defineField({ name: "picto", title: "Pictogram", type: "image", validation: (r) => r.required() }),
  ],
  preview: {
    select: { cle: "cle", couleur: "couleur", media: "picto" },
    prepare: ({ cle, couleur, media }) => ({ title: FAMILLES.find((f) => f.value === cle)?.title ?? cle, subtitle: couleur, media }),
  },
})

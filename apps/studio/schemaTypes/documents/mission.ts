import { DocumentIcon } from "@sanity/icons/Document"
import { defineField, defineType } from "sanity"

export const mission = defineType({
  name: "mission",
  title: "Mission",
  type: "document",
  icon: DocumentIcon,
  fields: [
    defineField({
      name: "couleur",
      title: "Colour",
      type: "string",
      options: {
        list: [
          { title: "White", value: "blanche" },
          { title: "Blue", value: "bleue" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: "texte", title: "Text", type: "text", rows: 2, validation: (r) => r.required() }),
    defineField({ name: "carte", title: "Card", type: "image", validation: (r) => r.required() }),
    defineField({
      name: "condition",
      title: "Rule",
      description: "Condition checked at the end of the game to earn 3 points",
      type: "condition",
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: { title: "texte", couleur: "couleur", media: "carte" },
    prepare: ({ title, couleur, media }) => ({ title, subtitle: couleur === "bleue" ? "Blue" : "White", media }),
  },
})

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
      title: "Couleur",
      type: "string",
      options: {
        list: [
          { title: "Blanche", value: "blanche" },
          { title: "Bleue", value: "bleue" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: "texte", title: "Texte", type: "text", rows: 2, validation: (r) => r.required() }),
    defineField({ name: "carte", title: "Carte", type: "image", validation: (r) => r.required() }),
    defineField({
      name: "condition",
      title: "Règle",
      description: "Condition vérifiée en fin de partie pour gagner 3 points",
      type: "condition",
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: { title: "texte", couleur: "couleur", media: "carte" },
    prepare: ({ title, couleur, media }) => ({ title, subtitle: couleur === "bleue" ? "Bleue" : "Blanche", media }),
  },
})

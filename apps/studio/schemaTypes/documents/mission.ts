import { DocumentIcon } from "@sanity/icons/Document"
import { defineField, defineType } from "sanity"

export const mission = defineType({
  name: "mission",
  title: "Mission",
  type: "document",
  icon: DocumentIcon,
  fields: [
    defineField({
      name: "color",
      title: "Color",
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
    defineField({ name: "text", title: "Text", type: "localeText" }),
    defineField({ name: "card", title: "Card", type: "image", validation: (r) => r.required() }),
    defineField({ name: "condition", title: "Rule", type: "condition", validation: (r) => r.required() }),
  ],
  preview: {
    select: { title: "text.en", fallback: "text.fr", color: "color", media: "card" },
    prepare: ({ title, fallback, color, media }) => ({ title: title || fallback, subtitle: color === "bleue" ? "Blue" : "White", media }),
  },
})

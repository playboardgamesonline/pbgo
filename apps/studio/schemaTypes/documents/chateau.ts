import { HomeIcon } from "@sanity/icons/Home"
import { defineField, defineType } from "sanity"

export const chateau = defineType({
  name: "chateau",
  title: "Château",
  type: "document",
  icon: HomeIcon,
  fields: [
    defineField({ name: "nom", title: "Nom", type: "string", validation: (r) => r.required() }),
    defineField({ name: "image", title: "Image", type: "image", validation: (r) => r.required() }),
    defineField({ name: "ordre", title: "Ordre", type: "number", initialValue: 0 }),
  ],
  orderings: [{ title: "Ordre", name: "ordre", by: [{ field: "ordre", direction: "asc" }] }],
  preview: { select: { title: "nom", media: "image" } },
})

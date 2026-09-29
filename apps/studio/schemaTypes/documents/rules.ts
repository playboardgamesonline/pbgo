import { BookIcon } from "@sanity/icons/Book"
import { defineArrayMember, defineField, defineType } from "sanity"

export const rules = defineType({
  name: "rules",
  title: "Rules",
  type: "document",
  icon: BookIcon,
  fields: [
    defineField({ name: "intro", title: "Introduction", type: "localeText" }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "section",
          fields: [
            defineField({ name: "title", title: "Title", type: "localeString" }),
            defineField({ name: "body", title: "Body", type: "localeText" }),
            defineField({ name: "image", title: "Image", type: "image" }),
          ],
          preview: { select: { title: "title.fr", media: "image" } },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Rules" }) },
})

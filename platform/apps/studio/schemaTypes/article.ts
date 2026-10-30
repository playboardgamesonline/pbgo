import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineArrayMember, defineField, defineType } from "sanity"
import { checkSlug } from "./rules"

/** An article of the hub, in English for now. Its body is rich text; blocks with pictures and the like come as more members of that list. */
export const article = defineType({
  name: "article",
  title: "Article",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title", maxLength: 80 }, validation: (rule) => rule.required().custom(checkSlug) }),
    defineField({ name: "excerpt", title: "Excerpt", type: "text", rows: 3, validation: (rule) => rule.max(280) }),
    defineField({ name: "body", title: "Body", type: "array", of: [defineArrayMember({ type: "block" })] }),
    defineField({ name: "cover", title: "Cover", type: "image", options: { hotspot: true } }),
    defineField({ name: "publishedAt", title: "Published at", type: "datetime" }),
    defineField({ name: "author", title: "Author", type: "string" }),
    defineField({
      name: "games",
      title: "Games",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "game" }] })],
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: { select: { title: "title", subtitle: "publishedAt", media: "cover" } },
  orderings: [{ title: "Newest first", name: "newest", by: [{ field: "publishedAt", direction: "desc" }] }],
})

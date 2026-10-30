import { RocketIcon } from "@sanity/icons/Rocket"
import { defineArrayMember, defineField, defineType } from "sanity"
import { CHANGELOG_KINDS } from "./constants"

/** One line of "What's new" on the hub, in English for now. */
export const changelogEntry = defineType({
  name: "changelogEntry",
  title: "Changelog entry",
  type: "document",
  icon: RocketIcon,
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "date", title: "Date", type: "date", validation: (rule) => rule.required() }),
    defineField({ name: "kind", title: "Kind", type: "string", options: { list: [...CHANGELOG_KINDS], layout: "radio" }, validation: (rule) => rule.required() }),
    defineField({ name: "body", title: "Body", type: "array", of: [defineArrayMember({ type: "block" })] }),
    defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true } }),
    defineField({
      name: "games",
      title: "Games",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "game" }] })],
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: { select: { title: "title", subtitle: "date", media: "image" } },
  orderings: [{ title: "Newest first", name: "newest", by: [{ field: "date", direction: "desc" }] }],
})

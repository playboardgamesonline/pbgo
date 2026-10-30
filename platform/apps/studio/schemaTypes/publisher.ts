import { CaseIcon } from "@sanity/icons/Case"
import { defineField, defineType } from "sanity"
import { checkName } from "./rules"

/** A publisher of games: the company that prints them, not a person who edits a text (that is the role "Editor" of a creator). */
export const publisher = defineType({
  name: "publisher",
  title: "Publisher",
  type: "document",
  icon: CaseIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (rule) => rule.required().custom(checkName) }),
    defineField({ name: "website", title: "Website", type: "url" }),
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({ name: "bggId", title: "BGG ID", type: "number", validation: (rule) => rule.integer().min(1) }),
  ],
  preview: { select: { title: "name", media: "logo" } },
  orderings: [{ title: "Name", name: "name", by: [{ field: "name", direction: "asc" }] }],
})

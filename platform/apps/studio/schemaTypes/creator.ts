import { UserIcon } from "@sanity/icons/User"
import { defineField, defineType } from "sanity"
import { checkName } from "./rules"

/** A person credited on games: designer, artist, developer… What they did is on the line of each game that credits them (`gameCreator`). */
export const creator = defineType({
  name: "creator",
  title: "Creator",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (rule) => rule.required().custom(checkName) }),
    defineField({ name: "photo", title: "Photo", type: "image", options: { hotspot: true } }),
    defineField({ name: "website", title: "Website", type: "url" }),
    defineField({ name: "bggId", title: "BGG ID", type: "number", validation: (rule) => rule.integer().min(1) }),
  ],
  preview: { select: { title: "name", media: "photo" } },
  orderings: [{ title: "Name", name: "name", by: [{ field: "name", direction: "asc" }] }],
})

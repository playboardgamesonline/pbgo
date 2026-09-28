import { StarIcon } from "@sanity/icons/Star"
import { defineField, defineType } from "sanity"
import { ROLES, titleOf } from "../constants"

export const role = defineType({
  name: "role",
  title: "Role",
  type: "document",
  icon: StarIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "key", title: "Game key", type: "string", options: { list: ROLES, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "countPerFamily", title: "Count per family", type: "number", validation: (r) => r.required().integer().min(0) }),
    defineField({ name: "pictogram", title: "Pictogram", type: "image", validation: (r) => r.required() }),
    defineField({ name: "rulesVisual", title: "Rules visual", type: "image" }),
    defineField({ name: "lettering", title: "Lettering", type: "image", options: { accept: "image/svg+xml" } }),
    defineField({ name: "rule", title: "Rule", type: "localeText" }),
  ],
  preview: {
    select: { key: "key", count: "countPerFamily", media: "pictogram" },
    prepare: ({ key, count, media }) => ({ title: titleOf(ROLES, key) ?? key, subtitle: count ? `× ${count} per family` : undefined, media }),
  },
})

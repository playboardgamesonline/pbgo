import { TagIcon } from "@sanity/icons/Tag"
import { defineField, defineType } from "sanity"
import { FAMILIES, titleOf } from "../constants"

export const family = defineType({
  name: "family",
  title: "Family",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "key", title: "Game key", type: "string", options: { list: FAMILIES, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "color", title: "Color", type: "string", validation: (r) => r.required().regex(/^#[0-9a-fA-F]{6}$/, { name: "hex" }) }),
    defineField({ name: "pictogram", title: "Pictogram", type: "image", validation: (r) => r.required() }),
  ],
  preview: {
    select: { key: "key", color: "color", media: "pictogram" },
    prepare: ({ key, color, media }) => ({ title: titleOf(FAMILIES, key) ?? key, subtitle: color, media }),
  },
})

import { TagIcon } from "@sanity/icons/Tag"
import { defineField, defineType } from "sanity"
import { checkName } from "./rules"

/** A category of games (Cooperation, Deduction…): what the hub's category filter offers. */
export const category = defineType({
  name: "category",
  title: "Category",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (rule) => rule.required().custom(checkName) }),
    defineField({ name: "icon", title: "Icon", type: "image" }),
    defineField({
      name: "color",
      title: "Color (#rrggbb)",
      type: "string",
      validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/, { name: "hex color" }).error("A color is written #rrggbb"),
    }),
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
  ],
  preview: { select: { title: "name", media: "icon" } },
  orderings: [{ title: "Name", name: "name", by: [{ field: "name", direction: "asc" }] }],
})

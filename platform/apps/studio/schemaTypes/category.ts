import { TagIcon } from "@sanity/icons/Tag"
import { defineField, defineType } from "sanity"
import { checkName, checkNameTranslations } from "./rules"
import { translated } from "./translations"

/**
 * A category of games (Cooperation, Deduction…): what the hub's category filter offers. Its English `name` is what the filter and the
 * icons go by; `names` holds it in the other languages (PLT-104, `TRANSLATED_FIELDS`).
 */
export const category = defineType({
  name: "category",
  title: "Category",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (rule) => rule.required().custom(checkName) }),
    defineField({
      name: "names",
      title: "Name in other languages (English: the name above)",
      type: translated("localizedName"),
      validation: (rule) => rule.custom(checkNameTranslations),
    }),
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

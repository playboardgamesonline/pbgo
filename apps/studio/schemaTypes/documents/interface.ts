import { ImagesIcon } from "@sanity/icons/Images"
import { defineField, defineType } from "sanity"

export const interfaceDoc = defineType({
  name: "interface",
  title: "Interface",
  type: "document",
  icon: ImagesIcon,
  fields: [
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({
      name: "banquetHaut",
      title: "Banquet decoration (top)",
      description: "Hangs at the top of the home and lobby screens (garlands, lanterns…). Transparent PNG or WebP, ideally 3500 px wide.",
      type: "image",
    }),
    defineField({
      name: "banquetBas",
      title: "Banquet decoration (bottom)",
      description: "The banquet table at the bottom of the home and lobby screens. Transparent PNG or WebP, ideally 3500 px wide.",
      type: "image",
    }),
  ],
  preview: { prepare: () => ({ title: "Interface" }) },
})

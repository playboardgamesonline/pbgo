import { ImagesIcon } from "@sanity/icons/Images"
import { defineField, defineType } from "sanity"

export const interfaceDoc = defineType({
  name: "interface",
  title: "Interface",
  type: "document",
  icon: ImagesIcon,
  fields: [
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({ name: "banquetTop", title: "Banquet decoration (top)", type: "image" }),
    defineField({ name: "banquetBottom", title: "Banquet decoration (bottom)", type: "image" }),
    defineField({ name: "pictogramFrame", title: "Pictogram frame", type: "image" }),
  ],
  preview: { prepare: () => ({ title: "Interface" }) },
})

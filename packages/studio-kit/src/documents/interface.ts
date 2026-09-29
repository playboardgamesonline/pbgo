import { ImagesIcon } from "@sanity/icons/Images"
import { defineField, defineType } from "sanity"

export const interfaceDoc = defineType({
  name: "interface",
  title: "Interface",
  type: "document",
  icon: ImagesIcon,
  fields: [
    defineField({ name: "background", title: "Background", type: "image" }),
  ],
  preview: { prepare: () => ({ title: "Interface" }) },
})

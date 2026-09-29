import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType } from "sanity"

export const texts = defineType({
  name: "texts",
  title: "Texts",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({ name: "tagline", title: "Tagline", type: "localeString" }),
    defineField({ name: "status", title: "Status", type: "localeString" }),
  ],
  preview: { prepare: () => ({ title: "Texts" }) },
})

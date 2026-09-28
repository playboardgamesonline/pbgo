import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType } from "sanity"

export const texts = defineType({
  name: "texts",
  title: "Texts",
  type: "document",
  icon: DocumentTextIcon,
  fields: [defineField({ name: "winnerPhrases", title: "Winner phrases", type: "localeStringList" })],
  preview: { prepare: () => ({ title: "Texts" }) },
})

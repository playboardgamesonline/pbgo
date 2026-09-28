import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType } from "sanity"

export const textes = defineType({
  name: "textes",
  title: "Texts",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "phrasesVainqueur",
      title: "Winner phrases",
      description: "Use {pseudo} and {points}. One phrase is picked at random at the end of the game.",
      type: "array",
      of: [{ type: "string" }],
    }),
  ],
  preview: { prepare: () => ({ title: "Texts" }) },
})

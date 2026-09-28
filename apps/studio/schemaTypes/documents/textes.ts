import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType } from "sanity"

export const textes = defineType({
  name: "textes",
  title: "Textes",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "phrasesVainqueur",
      title: "Phrases du vainqueur",
      description: "Utilisez {pseudo} et {points}. Une phrase est tirée au hasard en fin de partie.",
      type: "array",
      of: [{ type: "string" }],
    }),
  ],
  preview: { prepare: () => ({ title: "Textes" }) },
})

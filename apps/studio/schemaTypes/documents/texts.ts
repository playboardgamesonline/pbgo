import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { defineField, defineType } from "sanity"

export const texts = defineType({
  name: "texts",
  title: "Texts",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({ name: "missionsButton", title: "Missions button", type: "localeString" }),
    defineField({ name: "guestsSettling", title: "Guests settling in", type: "localeString" }),
    defineField({ name: "banquetStarts", title: "Banquet starts", type: "localeString" }),
    defineField({ name: "winnerPhrases", title: "Winner phrases", type: "localeStringList" }),
  ],
  preview: { prepare: () => ({ title: "Texts" }) },
})

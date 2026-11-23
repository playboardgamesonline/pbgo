import { DocumentIcon } from "@sanity/icons/Document"
import { defineField, defineType } from "sanity"

/** What a player reads and sees on a mission card. Which missions there are, their colour and their rule are the engine's (`MISSIONS`): a mission is found here by its id. */
export const mission = defineType({
  name: "mission",
  title: "Mission",
  type: "document",
  icon: DocumentIcon,
  fields: [
    defineField({ name: "text", title: "Text", type: "localeText" }),
    defineField({ name: "card", title: "Card", type: "image", validation: (r) => r.required() }),
  ],
  preview: {
    select: { title: "text.en", fallback: "text.fr", id: "_id", media: "card" },
    prepare: ({ title, fallback, id, media }) => ({ title: title || fallback, subtitle: id, media }),
  },
})

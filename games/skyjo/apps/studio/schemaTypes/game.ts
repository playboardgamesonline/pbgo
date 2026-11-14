import { ThLargeIcon } from "@sanity/icons/ThLarge"
import { defineField, defineType } from "sanity"

export const game = defineType({
  name: "game",
  title: "Game",
  type: "document",
  icon: ThLargeIcon,
  groups: [{ name: "backs", title: "Card backs", default: true }],
  fields: [defineField({ name: "cardBack", title: "Card back", type: "image", group: "backs" })],
  preview: { prepare: () => ({ title: "Game" }) },
})

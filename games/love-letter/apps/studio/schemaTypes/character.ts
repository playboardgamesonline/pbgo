import { UserIcon } from "@sanity/icons/User"
import { defineField, defineType } from "sanity"
import { CHARACTERS, titleOf } from "./constants"

// One document per character, ten for the 21 cards of the deck: every copy of a character shares its picture, so a character holds one picture. Drop it on the "Visual" field, or let the seed place the art files (docs/content-pipeline.md).
// The form follows the rules every game's cards follow (the skill `game-sanity-create`): no Effect or Rule field, no description under a field, an English game key, the quantity second to last and the visual last. A character is named by a word, so it
// has a localized name next to its key. The one exception is the card text, a text to display on the card's plate, by decision: the faces are blank plates (no name, no text), so what a player reads on a card is written here. What a card does stays the engine's:
// the engine never reads this text, and no field is named effect or rule.
export const character = defineType({
  name: "character",
  title: "Character",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({ name: "key", title: "Game key", type: "string", options: { list: CHARACTERS, layout: "dropdown" }, validation: (r) => r.required() }),
    defineField({ name: "value", title: "Value", type: "number", readOnly: true, validation: (r) => r.required().integer().min(0).max(9) }),
    defineField({ name: "name", title: "Name", type: "localeString" }),
    defineField({ name: "text", title: "Card text", type: "localeText" }),
    defineField({ name: "quantity", title: "Quantity", type: "number", validation: (r) => r.required().integer().min(1) }),
    defineField({ name: "image", title: "Visual", type: "image" }),
  ],
  orderings: [{ name: "valueOrder", title: "Order of the values", by: [{ field: "value", direction: "asc" }] }],
  preview: {
    select: { key: "key", value: "value", quantity: "quantity", media: "image" },
    prepare: ({ key, value, quantity, media }) => ({
      title: titleOf(CHARACTERS, key) ?? key,
      subtitle: `Value ${value ?? "?"} × ${quantity ?? "?"}`,
      media,
    }),
  },
})

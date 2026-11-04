import { ControlsIcon } from "@sanity/icons/Controls"
import { defineField, defineType } from "sanity"
import { checkHelperKey } from "./rules"

/**
 * A helper of a game, an item of its `helpers` (PLT-56): an aid that a player may have while they play, which the lobby offers as a small row with a switch and one line of text ("Show the
 * score calculation"). The key is what the game calls it and the name is what the lobby says; the game decides what a helper does, so the key does not change once the game reads it.
 */
export const gameHelper = defineType({
  name: "gameHelper",
  title: "Helper",
  type: "object",
  icon: ControlsIcon,
  fields: [
    defineField({ name: "title", title: "Name, as the lobby says it (for instance: Show the score calculation)", type: "string", validation: (rule) => rule.required().max(80) }),
    defineField({
      name: "key",
      title: "Key (what the game calls it: lowercase letters, digits and dashes; it does not change once the game reads it)",
      type: "string",
      validation: (rule) => rule.required().custom(checkHelperKey),
    }),
  ],
  preview: { select: { title: "title", subtitle: "key" } },
})

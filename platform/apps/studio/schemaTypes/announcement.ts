import { BellIcon } from "@sanity/icons/Bell"
import { defineField, defineType } from "sanity"
import { ANNOUNCEMENT_TONES } from "./constants"
import { checkEndsAfterStart } from "./rules"

/** A message the hub shows for a while, in English for now: a new game, a maintenance, a contest. */
export const announcement = defineType({
  name: "announcement",
  title: "Announcement",
  type: "document",
  icon: BellIcon,
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "message", title: "Message", type: "text", rows: 3, validation: (rule) => rule.required() }),
    defineField({ name: "tone", title: "Tone", type: "string", options: { list: [...ANNOUNCEMENT_TONES], layout: "radio" }, initialValue: "info", validation: (rule) => rule.required() }),
    defineField({ name: "startsAt", title: "Shown from", type: "datetime" }),
    defineField({ name: "endsAt", title: "Shown until", type: "datetime", validation: (rule) => rule.custom(checkEndsAfterStart) }),
    defineField({
      name: "link",
      title: "Link",
      type: "object",
      fields: [
        defineField({ name: "url", title: "Address", type: "url" }),
        defineField({ name: "label", title: "Label", type: "string" }),
      ],
    }),
    defineField({ name: "dismissible", title: "Can be dismissed", type: "boolean", initialValue: true }),
    defineField({ name: "game", title: "Game", type: "reference", to: [{ type: "game" }] }),
  ],
  preview: { select: { title: "title", subtitle: "tone" } },
  orderings: [{ title: "Newest first", name: "newest", by: [{ field: "startsAt", direction: "desc" }] }],
})

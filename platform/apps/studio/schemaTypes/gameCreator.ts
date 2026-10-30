import { defineField, defineType, type PreviewValue } from "sanity"
import { CREATOR_ROLES, roleTitle } from "./constants"

/** One line of the credits of a game: a creator and what they did on it. */
export const gameCreator = defineType({
  name: "gameCreator",
  title: "Creator",
  type: "object",
  fields: [
    defineField({ name: "creator", title: "Creator", type: "reference", to: [{ type: "creator" }], validation: (rule) => rule.required() }),
    defineField({
      name: "roles",
      title: "Roles",
      type: "array",
      of: [{ type: "string" }],
      options: { list: [...CREATOR_ROLES], layout: "grid" },
      validation: (rule) => rule.required().min(1).unique(),
    }),
  ],
  preview: {
    select: { name: "creator.name", roles: "roles", media: "creator.photo" },
    prepare: ({ name, roles, media }: { name?: string; roles?: string[]; media?: PreviewValue["media"] }) => ({
      title: name ?? "No creator yet",
      subtitle: (roles ?? []).map(roleTitle).join(", "),
      media,
    }),
  },
})

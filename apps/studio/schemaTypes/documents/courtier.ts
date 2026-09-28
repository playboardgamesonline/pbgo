import { UserIcon } from "@sanity/icons/User"
import { defineField, defineType } from "sanity"
import { FAMILIES, ROLES, titleOf } from "../constants"

export const courtier = defineType({
  name: "courtier",
  title: "Courtier",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({ name: "family", title: "Family", type: "reference", to: [{ type: "family" }], validation: (r) => r.required() }),
    defineField({ name: "role", title: "Role", type: "reference", to: [{ type: "role" }] }),
    defineField({ name: "card", title: "Card", type: "image", validation: (r) => r.required() }),
    defineField({ name: "quantity", title: "Quantity", type: "number", initialValue: 1, validation: (r) => r.required().integer().min(1) }),
  ],
  preview: {
    select: { family: "family.key", role: "role.key", quantity: "quantity", media: "card" },
    prepare: ({ family, role, quantity, media }) => ({
      title: `${titleOf(FAMILIES, family) ?? "?"} · ${titleOf(ROLES, role) ?? "No role"}`,
      subtitle: `× ${quantity ?? 1}`,
      media,
    }),
  },
})

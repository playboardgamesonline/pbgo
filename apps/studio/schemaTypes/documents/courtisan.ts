import { UserIcon } from "@sanity/icons/User"
import { defineField, defineType } from "sanity"
import { FAMILLES, ROLES } from "../constants"

export const courtisan = defineType({
  name: "courtisan",
  title: "Courtier",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({
      name: "famille",
      title: "Family",
      type: "reference",
      to: [{ type: "famille" }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "role",
      title: "Role",
      description: "Leave empty for a courtier without a role",
      type: "reference",
      to: [{ type: "role" }],
    }),
    defineField({ name: "carte", title: "Card", type: "image", validation: (r) => r.required() }),
    defineField({
      name: "quantite",
      title: "Quantity",
      description: "Number of copies using this illustration",
      type: "number",
      initialValue: 1,
      validation: (r) => r.required().integer().min(1),
    }),
  ],
  preview: {
    select: { famille: "famille.cle", role: "role.cle", quantite: "quantite", media: "carte" },
    prepare: ({ famille, role, quantite, media }) => ({
      title: `${FAMILLES.find((f) => f.value === famille)?.title ?? "?"} · ${ROLES.find((r) => r.value === role)?.title ?? "No role"}`,
      subtitle: `× ${quantite ?? 1}`,
      media,
    }),
  },
})

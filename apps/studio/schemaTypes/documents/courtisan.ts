import { UserIcon } from "@sanity/icons/User"
import { defineField, defineType } from "sanity"

export const courtisan = defineType({
  name: "courtisan",
  title: "Courtisan",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({
      name: "famille",
      title: "Famille",
      type: "reference",
      to: [{ type: "famille" }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "role",
      title: "Rôle",
      description: "Laisser vide pour un courtisan sans rôle",
      type: "reference",
      to: [{ type: "role" }],
    }),
    defineField({ name: "carte", title: "Carte", type: "image", validation: (r) => r.required() }),
    defineField({
      name: "quantite",
      title: "Quantité",
      description: "Nombre d'exemplaires utilisant cette illustration",
      type: "number",
      initialValue: 1,
      validation: (r) => r.required().integer().min(1),
    }),
  ],
  preview: {
    select: { famille: "famille.nom", role: "role.nom", quantite: "quantite", media: "carte" },
    prepare: ({ famille, role, quantite, media }) => ({
      title: `${famille ?? "?"} · ${role ?? "Sans rôle"}`,
      subtitle: `× ${quantite ?? 1}`,
      media,
    }),
  },
})

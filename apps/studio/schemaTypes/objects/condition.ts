import { defineArrayMember, defineField, defineType } from "sanity"
import { FAMILLES, ROLES, STATUTS } from "../constants"

type ConditionParent = { type?: string } | undefined

const TYPES = [
  { title: "Family status", value: "statutFamille" },
  { title: "Number of families with a status", value: "nombreFamillesStatut" },
  { title: "Number of cards in my domain", value: "nombreCartesDomaine" },
  { title: "Number of cards at the Queen's table", value: "nombreCartesTable" },
  { title: "Comparison with other players", value: "comparaisonJoueurs" },
  { title: "All conditions (AND)", value: "et" },
  { title: "At least one condition (OR)", value: "ou" },
  { title: "Inverse condition (NOT)", value: "non" },
]

const visibleFor =
  (...types: string[]) =>
  ({ parent }: { parent?: ConditionParent }) =>
    !types.includes(parent?.type ?? "")

const requiredFor =
  (...types: string[]) =>
  (value: unknown, context: { parent?: unknown }) => {
    const parent = context.parent as ConditionParent
    return types.includes(parent?.type ?? "") && (value === undefined || value === null) ? "Obligatoire" : true
  }

const COMPTAGE = ["nombreCartesDomaine", "nombreCartesTable", "comparaisonJoueurs"]

export const condition = defineType({
  name: "condition",
  title: "Condition",
  type: "object",
  fields: [
    defineField({
      name: "type",
      title: "Condition type",
      type: "string",
      options: { list: TYPES },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "famille",
      title: "Family",
      type: "string",
      options: { list: FAMILLES },
      hidden: visibleFor("statutFamille"),
      validation: (r) => r.custom(requiredFor("statutFamille")),
    }),
    defineField({
      name: "statut",
      title: "Status",
      type: "string",
      options: { list: STATUTS, layout: "radio", direction: "horizontal" },
      hidden: visibleFor("statutFamille", "nombreFamillesStatut"),
      validation: (r) => r.custom(requiredFor("statutFamille", "nombreFamillesStatut")),
    }),
    defineField({
      name: "filtreFamille",
      title: "Cards of family",
      description: "Empty = all families",
      type: "string",
      options: { list: FAMILLES },
      hidden: visibleFor(...COMPTAGE),
    }),
    defineField({
      name: "filtreRole",
      title: "Cards with role",
      description: "Empty = all roles",
      type: "string",
      options: { list: [...ROLES, { title: "No role", value: "sansRole" }] },
      hidden: visibleFor(...COMPTAGE),
    }),
    defineField({
      name: "niveau",
      title: "Position at the table",
      description: "Empty = above and below",
      type: "string",
      options: {
        list: [
          { title: "Above", value: "haut" },
          { title: "Below", value: "bas" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      hidden: visibleFor("nombreCartesTable"),
    }),
    defineField({
      name: "comparateur",
      title: "Comparison",
      type: "string",
      options: {
        list: [
          { title: "At least (≥)", value: "gte" },
          { title: "At most (≤)", value: "lte" },
          { title: "Exactly (=)", value: "eq" },
          { title: "More than (>)", value: "gt" },
          { title: "Less than (<)", value: "lt" },
        ],
      },
      hidden: visibleFor("nombreFamillesStatut", ...COMPTAGE),
      validation: (r) => r.custom(requiredFor("nombreFamillesStatut", ...COMPTAGE)),
    }),
    defineField({
      name: "valeur",
      title: "Value",
      type: "number",
      hidden: visibleFor("nombreFamillesStatut", "nombreCartesDomaine", "nombreCartesTable"),
      validation: (r) => r.custom(requiredFor("nombreFamillesStatut", "nombreCartesDomaine", "nombreCartesTable")),
    }),
    defineField({
      name: "adversaire",
      title: "Compared to",
      type: "string",
      options: {
        list: [
          { title: "My left neighbour", value: "voisinGauche" },
          { title: "My right neighbour", value: "voisinDroite" },
          { title: "All opponents", value: "tousLesAdversaires" },
          { title: "At least one opponent", value: "auMoinsUnAdversaire" },
        ],
      },
      hidden: visibleFor("comparaisonJoueurs"),
      validation: (r) => r.custom(requiredFor("comparaisonJoueurs")),
    }),
    defineField({
      name: "mode",
      title: "Counting",
      type: "string",
      initialValue: "cartes",
      options: {
        list: [
          { title: "Number of cards", value: "cartes" },
          { title: "Weight (noble = 2)", value: "poids" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      hidden: visibleFor(...COMPTAGE),
    }),
    defineField({
      name: "conditions",
      title: "Conditions",
      type: "array",
      of: [defineArrayMember({ type: "condition" })],
      hidden: visibleFor("et", "ou", "non"),
      validation: (r) =>
        r.custom((value: unknown[] | undefined, context) => {
          const type = (context.parent as ConditionParent)?.type
          if (type === "non" && value?.length !== 1) return "Une seule condition"
          if ((type === "et" || type === "ou") && (value?.length ?? 0) < 2) return "Au moins 2 conditions"
          return true
        }),
    }),
  ],
  preview: {
    select: { type: "type", famille: "famille", statut: "statut" },
    prepare: ({ type, famille, statut }) => ({
      title: TYPES.find((t) => t.value === type)?.title ?? "Condition",
      subtitle: [famille, statut].filter(Boolean).join(" · "),
    }),
  },
})

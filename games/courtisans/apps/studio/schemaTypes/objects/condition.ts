import { defineArrayMember, defineField, defineType } from "sanity"
import { FAMILIES, ROLES, STATUSES, titleOf } from "../constants"

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
    return types.includes(parent?.type ?? "") && (value === undefined || value === null) ? "Required" : true
  }

const COUNTING = ["nombreCartesDomaine", "nombreCartesTable", "comparaisonJoueurs"]

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
      name: "family",
      title: "Family",
      type: "string",
      options: { list: FAMILIES },
      hidden: visibleFor("statutFamille"),
      validation: (r) => r.custom(requiredFor("statutFamille")),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: { list: STATUSES, layout: "radio", direction: "horizontal" },
      hidden: visibleFor("statutFamille", "nombreFamillesStatut"),
      validation: (r) => r.custom(requiredFor("statutFamille", "nombreFamillesStatut")),
    }),
    defineField({
      name: "familyFilter",
      title: "Cards of family",
      type: "string",
      options: { list: FAMILIES },
      hidden: visibleFor(...COUNTING),
    }),
    defineField({
      name: "roleFilter",
      title: "Cards with role",
      type: "string",
      options: { list: [...ROLES, { title: "No role", value: "sansRole" }] },
      hidden: visibleFor(...COUNTING),
    }),
    defineField({
      name: "level",
      title: "Position at the table",
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
      name: "comparator",
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
      hidden: visibleFor("nombreFamillesStatut", ...COUNTING),
      validation: (r) => r.custom(requiredFor("nombreFamillesStatut", ...COUNTING)),
    }),
    defineField({
      name: "value",
      title: "Value",
      type: "number",
      hidden: visibleFor("nombreFamillesStatut", "nombreCartesDomaine", "nombreCartesTable"),
      validation: (r) => r.custom(requiredFor("nombreFamillesStatut", "nombreCartesDomaine", "nombreCartesTable")),
    }),
    defineField({
      name: "opponent",
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
      hidden: visibleFor(...COUNTING),
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
          if (type === "non" && value?.length !== 1) return "Exactly one condition"
          if ((type === "et" || type === "ou") && (value?.length ?? 0) < 2) return "At least 2 conditions"
          return true
        }),
    }),
  ],
  preview: {
    select: { type: "type", family: "family", status: "status" },
    prepare: ({ type, family, status }) => ({
      title: TYPES.find((t) => t.value === type)?.title ?? "Condition",
      subtitle: [titleOf(FAMILIES, family), titleOf(STATUSES, status)].filter(Boolean).join(" · "),
    }),
  },
})

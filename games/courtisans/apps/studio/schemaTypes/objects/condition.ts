import { defineArrayMember, defineField, defineType } from "sanity"
import { FAMILIES, ROLES, STATUSES, titleOf } from "../constants"

type ConditionParent = { type?: string } | undefined

const TYPES = [
  { title: "Family status", value: "familyStatus" },
  { title: "Number of families with a status", value: "familiesWithStatus" },
  { title: "Number of cards in my domain", value: "domainCards" },
  { title: "Number of cards at the Queen's table", value: "tableCards" },
  { title: "Comparison with other players", value: "playerComparison" },
  { title: "All conditions (AND)", value: "and" },
  { title: "At least one condition (OR)", value: "or" },
  { title: "Inverse condition (NOT)", value: "not" },
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

const COUNTING = ["domainCards", "tableCards", "playerComparison"]

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
      hidden: visibleFor("familyStatus"),
      validation: (r) => r.custom(requiredFor("familyStatus")),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: { list: STATUSES, layout: "radio", direction: "horizontal" },
      hidden: visibleFor("familyStatus", "familiesWithStatus"),
      validation: (r) => r.custom(requiredFor("familyStatus", "familiesWithStatus")),
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
      options: { list: [...ROLES, { title: "No role", value: "noRole" }] },
      hidden: visibleFor(...COUNTING),
    }),
    defineField({
      name: "level",
      title: "Position at the table",
      type: "string",
      options: {
        list: [
          { title: "Above", value: "up" },
          { title: "Below", value: "down" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      hidden: visibleFor("tableCards"),
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
      hidden: visibleFor("familiesWithStatus", ...COUNTING),
      validation: (r) => r.custom(requiredFor("familiesWithStatus", ...COUNTING)),
    }),
    defineField({
      name: "value",
      title: "Value",
      type: "number",
      hidden: visibleFor("familiesWithStatus", "domainCards", "tableCards"),
      validation: (r) => r.custom(requiredFor("familiesWithStatus", "domainCards", "tableCards")),
    }),
    defineField({
      name: "opponent",
      title: "Compared to",
      type: "string",
      options: {
        list: [
          { title: "My left neighbour", value: "leftNeighbor" },
          { title: "My right neighbour", value: "rightNeighbor" },
          { title: "All opponents", value: "allOpponents" },
          { title: "At least one opponent", value: "anyOpponent" },
        ],
      },
      hidden: visibleFor("playerComparison"),
      validation: (r) => r.custom(requiredFor("playerComparison")),
    }),
    defineField({
      name: "mode",
      title: "Counting",
      type: "string",
      initialValue: "cards",
      options: {
        list: [
          { title: "Number of cards", value: "cards" },
          { title: "Weight (noble = 2)", value: "weight" },
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
      hidden: visibleFor("and", "or", "not"),
      validation: (r) =>
        r.custom((value: unknown[] | undefined, context) => {
          const type = (context.parent as ConditionParent)?.type
          if (type === "not" && value?.length !== 1) return "Exactly one condition"
          if ((type === "and" || type === "or") && (value?.length ?? 0) < 2) return "At least 2 conditions"
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

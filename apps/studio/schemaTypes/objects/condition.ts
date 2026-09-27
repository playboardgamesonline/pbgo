import { defineArrayMember, defineField, defineType } from "sanity"
import { FAMILLES, ROLES, STATUTS } from "../constants"

type ConditionParent = { type?: string } | undefined

const TYPES = [
  { title: "Statut d'une famille", value: "statutFamille" },
  { title: "Nombre de familles dans un statut", value: "nombreFamillesStatut" },
  { title: "Nombre de cartes dans mon domaine", value: "nombreCartesDomaine" },
  { title: "Nombre de cartes à la table de la Reine", value: "nombreCartesTable" },
  { title: "Comparaison avec d'autres joueurs", value: "comparaisonJoueurs" },
  { title: "Toutes les conditions (ET)", value: "et" },
  { title: "Au moins une condition (OU)", value: "ou" },
  { title: "Condition inverse (NON)", value: "non" },
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
      title: "Type de condition",
      type: "string",
      options: { list: TYPES },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "famille",
      title: "Famille",
      type: "string",
      options: { list: FAMILLES },
      hidden: visibleFor("statutFamille"),
      validation: (r) => r.custom(requiredFor("statutFamille")),
    }),
    defineField({
      name: "statut",
      title: "Statut",
      type: "string",
      options: { list: STATUTS, layout: "radio", direction: "horizontal" },
      hidden: visibleFor("statutFamille", "nombreFamillesStatut"),
      validation: (r) => r.custom(requiredFor("statutFamille", "nombreFamillesStatut")),
    }),
    defineField({
      name: "filtreFamille",
      title: "Cartes de la famille",
      description: "Vide = toutes les familles",
      type: "string",
      options: { list: FAMILLES },
      hidden: visibleFor(...COMPTAGE),
    }),
    defineField({
      name: "filtreRole",
      title: "Cartes du rôle",
      description: "Vide = tous les rôles",
      type: "string",
      options: { list: [...ROLES, { title: "Sans rôle", value: "sansRole" }] },
      hidden: visibleFor(...COMPTAGE),
    }),
    defineField({
      name: "niveau",
      title: "Position à la table",
      description: "Vide = au-dessus et au-dessous",
      type: "string",
      options: {
        list: [
          { title: "Au-dessus", value: "haut" },
          { title: "Au-dessous", value: "bas" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      hidden: visibleFor("nombreCartesTable"),
    }),
    defineField({
      name: "comparateur",
      title: "Comparaison",
      type: "string",
      options: {
        list: [
          { title: "Au moins (≥)", value: "gte" },
          { title: "Au plus (≤)", value: "lte" },
          { title: "Exactement (=)", value: "eq" },
          { title: "Plus que (>)", value: "gt" },
          { title: "Moins que (<)", value: "lt" },
        ],
      },
      hidden: visibleFor("nombreFamillesStatut", ...COMPTAGE),
      validation: (r) => r.custom(requiredFor("nombreFamillesStatut", ...COMPTAGE)),
    }),
    defineField({
      name: "valeur",
      title: "Valeur",
      type: "number",
      hidden: visibleFor("nombreFamillesStatut", "nombreCartesDomaine", "nombreCartesTable"),
      validation: (r) => r.custom(requiredFor("nombreFamillesStatut", "nombreCartesDomaine", "nombreCartesTable")),
    }),
    defineField({
      name: "adversaire",
      title: "Comparé à",
      type: "string",
      options: {
        list: [
          { title: "Mon voisin de gauche", value: "voisinGauche" },
          { title: "Mon voisin de droite", value: "voisinDroite" },
          { title: "Tous les adversaires", value: "tousLesAdversaires" },
          { title: "Au moins un adversaire", value: "auMoinsUnAdversaire" },
        ],
      },
      hidden: visibleFor("comparaisonJoueurs"),
      validation: (r) => r.custom(requiredFor("comparaisonJoueurs")),
    }),
    defineField({
      name: "mode",
      title: "Comptage",
      type: "string",
      initialValue: "cartes",
      options: {
        list: [
          { title: "Nombre de cartes", value: "cartes" },
          { title: "Poids (noble = 2)", value: "poids" },
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

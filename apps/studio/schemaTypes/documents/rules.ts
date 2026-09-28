import { BookIcon } from "@sanity/icons/Book"
import { defineField, defineType } from "sanity"

const visuel = (name: string, title: string, description?: string, group = "cartes") =>
  defineField({ name, title, description, type: "image", group })

export const rules = defineType({
  name: "rules",
  title: "Rules",
  type: "document",
  icon: BookIcon,
  groups: [
    { name: "cartes", title: "Cards", default: true },
    { name: "exemples", title: "Examples" },
  ],
  fields: [
    visuel("missions", "Missions", "Visuel des cartes Mission (onglet « But du jeu »)."),
    visuel("noble", "Noble"),
    visuel("garde", "Garde"),
    visuel("espion", "Espion"),
    visuel("assassin", "Assassin"),
    visuel("table", "La table de la Reine", "Cartes posées au-dessus et au-dessous du tapis (onglet « But du jeu »).", "exemples"),
    visuel("exempleEspion", "Exemple d'espion", undefined, "exemples"),
    visuel("exempleAssassin", "Exemple d'assassin", undefined, "exemples"),
    visuel("decompteTable", "Décompte : statut des familles", undefined, "exemples"),
    visuel("decompteDomaine", "Décompte : points d'un domaine", undefined, "exemples"),
  ],
  preview: { prepare: () => ({ title: "Rules" }) },
})

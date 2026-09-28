import { BookIcon } from "@sanity/icons/Book"
import { defineField, defineType } from "sanity"

const AIDE = "Balises : {lumiere}, {disgrace}, {neutre} affichent les étiquettes colorées ; **texte** met en gras."

const texte = (name: string, title: string, group: string) => defineField({ name, title, type: "text", rows: 3, description: AIDE, group })
const ligne = (name: string, title: string, group: string) => defineField({ name, title, type: "string", group })
const visuel = (name: string, title: string, group: string) => defineField({ name, title, type: "image", group })

export const rules = defineType({
  name: "rules",
  title: "Rules",
  type: "document",
  icon: BookIcon,
  groups: [
    { name: "video", title: "Video", default: true },
    { name: "but", title: "Goal" },
    { name: "tour", title: "Turn" },
    { name: "roles", title: "Roles" },
    { name: "decompte", title: "Scoring" },
  ],
  fields: [
    defineField({
      name: "videoId",
      title: "Identifiant de la vidéo YouTube",
      description: "La partie après « v= » dans l'adresse de la vidéo.",
      type: "string",
      group: "video",
    }),
    texte("butIntro", "Introduction", "but"),
    texte("butFamilles", "Six familles", "but"),
    texte("butMissions", "Deux missions secrètes", "but"),
    visuel("visuelTable", "Visuel : la table de la Reine", "but"),
    visuel("visuelMissions", "Visuel : les missions", "but"),
    texte("tourIntro", "Introduction", "tour"),
    texte("tourTable", "1. À la table de la reine", "tour"),
    texte("tourDomaine", "2. Dans votre domaine", "tour"),
    texte("tourAdverse", "3. Dans un domaine adverse", "tour"),
    texte("tourFin", "Fin du tour", "tour"),
    defineField({
      name: "rolesIntro",
      title: "Introduction",
      description: `Les visuels, le lettering et le texte de chaque rôle se règlent dans Roles. ${AIDE}`,
      type: "text",
      rows: 3,
      group: "roles",
    }),
    visuel("exempleEspion", "Exemple d'espion", "roles"),
    ligne("legendeEspion", "Légende de l'exemple d'espion", "roles"),
    visuel("exempleAssassin", "Exemple d'assassin", "roles"),
    ligne("legendeAssassin", "Légende de l'exemple d'assassin", "roles"),
    texte("decompteIntro", "Introduction", "decompte"),
    texte("decompteRevelation", "1. Les espions sont révélés", "decompte"),
    texte("decompteStatut", "2. Le statut des familles", "decompte"),
    texte("decomptePoints", "3. Les points", "decompte"),
    visuel("decompteTable", "Visuel : statut des familles", "decompte"),
    visuel("decompteDomaine", "Visuel : points d'un domaine", "decompte"),
    ligne("legendeDomaine", "Légende du décompte d'un domaine", "decompte"),
  ],
  preview: { prepare: () => ({ title: "Rules" }) },
})

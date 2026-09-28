import { BookIcon } from "@sanity/icons/Book"
import { defineField, defineType } from "sanity"

const AIDE = "Tags: {lumiere}, {disgrace}, {neutre} show the coloured labels; **text** makes bold."

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
      title: "YouTube video ID",
      description: "The part after “v=” in the video URL.",
      type: "string",
      group: "video",
    }),
    texte("butIntro", "Introduction", "but"),
    texte("butFamilles", "Six families", "but"),
    texte("butMissions", "Two secret missions", "but"),
    visuel("visuelTable", "Visual: the Queen's table", "but"),
    visuel("visuelMissions", "Visual: the missions", "but"),
    texte("tourIntro", "Introduction", "tour"),
    texte("tourTable", "1. At the Queen's table", "tour"),
    texte("tourDomaine", "2. In your domain", "tour"),
    texte("tourAdverse", "3. In an opponent's domain", "tour"),
    texte("tourFin", "End of turn", "tour"),
    defineField({
      name: "rolesIntro",
      title: "Introduction",
      description: `Each role's visual, lettering and text are set in Roles. ${AIDE}`,
      type: "text",
      rows: 3,
      group: "roles",
    }),
    visuel("exempleEspion", "Spy example", "roles"),
    ligne("legendeEspion", "Spy example caption", "roles"),
    visuel("exempleAssassin", "Assassin example", "roles"),
    ligne("legendeAssassin", "Assassin example caption", "roles"),
    texte("decompteIntro", "Introduction", "decompte"),
    texte("decompteRevelation", "1. Spies are revealed", "decompte"),
    texte("decompteStatut", "2. Family status", "decompte"),
    texte("decomptePoints", "3. Points", "decompte"),
    visuel("decompteTable", "Visual: family status", "decompte"),
    visuel("decompteDomaine", "Visual: domain points", "decompte"),
    ligne("legendeDomaine", "Domain scoring caption", "decompte"),
  ],
  preview: { prepare: () => ({ title: "Rules" }) },
})

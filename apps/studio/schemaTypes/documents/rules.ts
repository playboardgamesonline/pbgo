import { BookIcon } from "@sanity/icons/Book"
import { defineField, defineType } from "sanity"

const text = (name: string, title: string, group: string) => defineField({ name, title, type: "localeText", group })
const caption = (name: string, title: string, group: string) => defineField({ name, title, type: "localeString", group })
const visual = (name: string, title: string, group: string) => defineField({ name, title, type: "image", group })

export const rules = defineType({
  name: "rules",
  title: "Rules",
  type: "document",
  icon: BookIcon,
  groups: [
    { name: "video", title: "Video", default: true },
    { name: "goal", title: "Goal" },
    { name: "turn", title: "Turn" },
    { name: "roles", title: "Roles" },
    { name: "scoring", title: "Scoring" },
  ],
  fields: [
    defineField({ name: "videoId", title: "YouTube video ID", type: "string", group: "video" }),
    text("goalIntro", "Introduction", "goal"),
    text("goalFamilies", "Six families", "goal"),
    text("goalMissions", "Two secret missions", "goal"),
    visual("tableVisual", "Visual: the Queen's table", "goal"),
    visual("missionsVisual", "Visual: the missions", "goal"),
    text("turnIntro", "Introduction", "turn"),
    text("turnTable", "1. At the Queen's table", "turn"),
    text("turnDomain", "2. In your domain", "turn"),
    text("turnOpponent", "3. In an opponent's domain", "turn"),
    text("turnEnd", "End of turn", "turn"),
    text("rolesIntro", "Introduction", "roles"),
    visual("spyExample", "Spy example", "roles"),
    caption("spyCaption", "Spy example caption", "roles"),
    visual("assassinExample", "Assassin example", "roles"),
    caption("assassinCaption", "Assassin example caption", "roles"),
    text("scoringIntro", "Introduction", "scoring"),
    text("scoringReveal", "1. Spies are revealed", "scoring"),
    text("scoringStatus", "2. Family status", "scoring"),
    text("scoringPoints", "3. Points", "scoring"),
    visual("scoringTable", "Visual: family status", "scoring"),
    visual("scoringDomain", "Visual: domain points", "scoring"),
    caption("domainCaption", "Domain scoring caption", "scoring"),
  ],
  preview: { prepare: () => ({ title: "Rules" }) },
})

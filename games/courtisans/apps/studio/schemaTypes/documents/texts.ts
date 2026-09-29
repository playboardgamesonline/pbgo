import { createTexts } from "@pgo/studio-kit"
import { defineField } from "sanity"

/** Textes communs (libellés d'interface, phrases de victoire…) + textes propres au banquet. */
export const texts = createTexts([
  defineField({ name: "missionsButton", title: "Missions button", description: "End of the opening (e.g. Missions comprises)", type: "localeString", group: "content" }),
  defineField({ name: "banquetStarts", title: "Banquet starts", description: "Announcement after the opening", type: "localeString", group: "content" }),
])

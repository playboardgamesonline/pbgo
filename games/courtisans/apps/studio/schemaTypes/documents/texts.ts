import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** Shared texts (interface labels, victory sentences…) + the banquet's own texts. */
export const texts = createTexts([
  defineField({ name: "missionsButton", title: "Missions button", description: "End of the opening (e.g. Missions comprises)", type: "localeString", group: "content" }),
  defineField({ name: "banquetStarts", title: "Banquet starts", description: "Announcement after the opening", type: "localeString", group: "content" }),
])

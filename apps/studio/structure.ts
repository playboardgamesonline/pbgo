import { CogIcon } from "@sanity/icons/Cog"
import type { StructureResolver } from "sanity/structure"

export const SINGLETONS = ["reglages"]

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Courtisans")
    .items([
      S.listItem().title("Réglages").icon(CogIcon).child(S.document().schemaType("reglages").documentId("reglages")),
      S.divider(),
      S.documentTypeListItem("famille").title("Familles"),
      S.documentTypeListItem("role").title("Rôles"),
      S.documentTypeListItem("courtisan").title("Courtisans"),
      S.documentTypeListItem("mission").title("Missions"),
      S.divider(),
      S.documentTypeListItem("chateau").title("Châteaux"),
    ])

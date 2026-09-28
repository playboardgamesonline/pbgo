import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { ImagesIcon } from "@sanity/icons/Images"
import type { StructureResolver } from "sanity/structure"

export const SINGLETONS = ["assets", "textes"]

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Courtisans")
    .items([
      S.listItem().title("Assets").icon(ImagesIcon).child(S.document().schemaType("assets").documentId("assets")),
      S.listItem().title("Textes").icon(DocumentTextIcon).child(S.document().schemaType("textes").documentId("textes")),
      S.divider(),
      S.documentTypeListItem("famille").title("Familles"),
      S.documentTypeListItem("role").title("Rôles"),
      S.documentTypeListItem("courtisan").title("Courtisans"),
      S.documentTypeListItem("mission").title("Missions"),
    ])

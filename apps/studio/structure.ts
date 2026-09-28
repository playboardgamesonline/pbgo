import { BookIcon } from "@sanity/icons/Book"
import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { ImagesIcon } from "@sanity/icons/Images"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import type { StructureResolver } from "sanity/structure"

export const SINGLETONS = ["assets", "board", "rules", "textes"]

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Courtisans")
    .items([
      S.listItem().title("Assets").icon(ImagesIcon).child(S.document().schemaType("assets").documentId("assets")),
      S.listItem().title("Board").icon(ThLargeIcon).child(S.document().schemaType("board").documentId("board")),
      S.listItem().title("Rules").icon(BookIcon).child(S.document().schemaType("rules").documentId("rules")),
      S.listItem().title("Texts").icon(DocumentTextIcon).child(S.document().schemaType("textes").documentId("textes")),
      S.divider(),
      S.documentTypeListItem("famille").title("Families"),
      S.documentTypeListItem("role").title("Roles"),
      S.documentTypeListItem("courtisan").title("Courtiers"),
      S.documentTypeListItem("mission").title("Missions"),
    ])

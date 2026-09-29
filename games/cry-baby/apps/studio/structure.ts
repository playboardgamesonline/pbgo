import { BookIcon } from "@sanity/icons/Book"
import { DocumentTextIcon } from "@sanity/icons/DocumentText"
import { ImagesIcon } from "@sanity/icons/Images"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import type { StructureResolver } from "sanity/structure"

export const SINGLETONS = ["interface", "game", "rules", "texts"]

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Cry Baby")
    .items([
      S.listItem().title("Interface").icon(ImagesIcon).child(S.document().schemaType("interface").documentId("interface")),
      S.listItem().title("Game").icon(ThLargeIcon).child(S.document().schemaType("game").documentId("game")),
      S.listItem().title("Rules").icon(BookIcon).child(S.document().schemaType("rules").documentId("rules")),
      S.listItem().title("Texts").icon(DocumentTextIcon).child(S.document().schemaType("texts").documentId("texts")),
    ])

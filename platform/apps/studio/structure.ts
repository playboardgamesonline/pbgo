import { BasketIcon } from "@sanity/icons/Basket"
import { EditIcon } from "@sanity/icons/Edit"
import { ThLargeIcon } from "@sanity/icons/ThLarge"
import type { DefaultDocumentNodeResolver, StructureResolver } from "sanity/structure"
import { GamesOf } from "./views/games-of-view"

// The sidebar is three blocks. The Catalog is what the hub lists, the Editorial what it tells, and the Shop is kept for what it will
// sell: nothing in it yet (no document type), until we have looked at how Discord's shop is built.
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Play Board Games Online")
    .items([
      S.listItem()
        .title("Catalog")
        .icon(ThLargeIcon)
        .child(
          S.list()
            .title("Catalog")
            .items([
              S.listItem()
                .title("Games")
                .icon(ThLargeIcon)
                .child(S.documentTypeList("game").title("Games").defaultOrdering([{ field: "order", direction: "asc" }, { field: "name", direction: "asc" }])),
              S.documentTypeListItem("creator").title("Creators"),
              S.documentTypeListItem("publisher").title("Publishers"),
              S.documentTypeListItem("category").title("Categories"),
            ]),
        ),
      S.listItem()
        .title("Editorial")
        .icon(EditIcon)
        .child(
          S.list()
            .title("Editorial")
            .items([
              S.documentTypeListItem("article").title("Articles"),
              S.documentTypeListItem("changelogEntry").title("Changelog"),
              S.documentTypeListItem("announcement").title("Announcements"),
            ]),
        ),
      S.listItem().title("Shop").icon(BasketIcon).child(S.list().title("Shop").items([])),
    ])

/** A creator and a publisher get a "Games" tab next to their form: the games that credit them. */
export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, { schemaType }) =>
  schemaType === "creator" || schemaType === "publisher"
    ? S.document().views([S.view.form(), S.view.component(GamesOf).title("Games").icon(ThLargeIcon).options({ of: schemaType })])
    : S.document().views([S.view.form()])

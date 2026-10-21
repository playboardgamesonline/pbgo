import { createTexts } from "@pbgo/studio-kit"
import { defineField } from "sanity"

/** A text of the board, one per language. `title` carries the placeholders the code fills in (`{name}`, `{count}`). */
const word = (name: string, title: string) => defineField({ name, title, type: "localeString", group: "board" })

/** A list of wordings, one list per language. */
const words = (name: string, title: string) => defineField({ name, title, type: "localeStringList", group: "board" })

/** Shared texts (interface labels, victory sentences…) + the banquet's own texts and the vocabulary of the board. */
export const texts = createTexts(
  [
    defineField({ name: "missionsButton", title: "Missions button", type: "localeString", group: "content" }),
    defineField({ name: "banquetStarts", title: "Banquet starts", type: "localeString", group: "content" }),
    defineField({ name: "homeHeading", title: "Home heading (hidden, for search engines)", type: "localeString", group: "content" }),
    defineField({ name: "genres", title: "Genres (search engines)", type: "localeStringList", group: "content" }),
    word("courtier", "Courtier"),
    words("statusLight", "Status · in the light (every wording a mission text uses)"),
    words("statusDisgrace", "Status · in disgrace (every wording a mission text uses)"),
    word("zoneTable", "Zone · at the Queen's table"),
    word("zoneYours", "Zone · your domain"),
    word("zoneTheirs", "Zone · the author's own domain, seen by another player"),
    word("zoneOther", "Zone · a named player's domain ({name})"),
    word("youPlay", "You play"),
    word("youEliminate", "You eliminate"),
    word("youDrawOne", "You draw one card ({count})"),
    word("youDrawMany", "You draw several cards ({count})"),
    word("theyPlay", "Plays (a player)"),
    word("theyEliminate", "Eliminates (a player)"),
    word("theyDrawOne", "Draws one card ({count})"),
    word("theyDrawMany", "Draws several cards ({count})"),
    word("gameOverLog", "Log line · the draw pile is empty"),
    word("missionsSucceeded", "Score · missions succeeded"),
    word("noAssassination", "Button · don't assassinate"),
    word("skip", "Button · skip the end sequence"),
  ],
  [{ name: "board", title: "Board" }],
)

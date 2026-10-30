import type { SchemaTypeDefinition } from "sanity"
import { announcement } from "./announcement"
import { article } from "./article"
import { category } from "./category"
import { changelogEntry } from "./changelogEntry"
import { creator } from "./creator"
import { game } from "./game"
import { gameCreator } from "./gameCreator"
import { publisher } from "./publisher"

/** The catalog (games and what they point to), then the editorial documents. There is nothing for the shop yet. */
export const schemaTypes: SchemaTypeDefinition[] = [game, gameCreator, creator, publisher, category, article, changelogEntry, announcement]

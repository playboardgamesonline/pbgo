import { roleTitle } from "../schemaTypes/constants"

// What the "Games" tab of a creator and of a publisher asks for, and how it words the answer. Plain TypeScript: the tab itself
// (`games-of.tsx`) is the part that needs the Studio.

/** What a game shows in the tab: its name, and for a creator what they did on it. */
export type GameOf = { _id: string; name: string | null; roles?: string[] | null }

/** The documents that hold games: a person credited on them (`creator`), a company that publishes them (`publisher`). */
export type Holder = "creator" | "publisher"

// `$id` is the published id of the creator or of the publisher, drafts and published games alike (the query runs on the drafts perspective)
const QUERIES: Record<Holder, string> = {
  creator: `*[_type == "game" && $id in creators[].creator._ref] | order(order asc, name asc) { _id, name, "roles": creators[creator._ref == $id][0].roles }`,
  publisher: `*[_type == "game" && $id in publishers[]._ref] | order(order asc, name asc) { _id, name }`,
}

export const gamesOfQuery = (holder: Holder): string => QUERIES[holder]

/** What a creator did on a game, as the Studio words it: "Designer, Artist". */
export const rolesLine = (roles: readonly string[] | null | undefined): string => (roles ?? []).map(roleTitle).join(", ")

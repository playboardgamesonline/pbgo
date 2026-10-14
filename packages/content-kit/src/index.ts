// What a game's content data needs: the builders of localized texts, the types of its documents and art slots, and the two ways
// a slot places an image. Light on purpose (no Sanity client, no sharp), so that `tsc -p content` and the data files stay cheap.
export { LANGUAGE_IDS, localeString, localeText } from "./locale.ts"
export type { LanguageId, Localized } from "./locale.ts"
export { setField, setItemField } from "./place.ts"
export { assertSeedId } from "./plan.ts"
export type { ArtSlot } from "./art.ts"
export type { ImageValue, SeedDoc } from "./types.ts"

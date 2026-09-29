// Ce que Courtisans fournit à @pgo/core côté serveur et client (alias "@pgo/binding").
export * from "@pgo/engine-kit"
export * from "@courtisans/engine"
// en cas de doublon avec engine-kit, la version du moteur l'emporte
export { EngineError, type DebugCommand, createRng, shuffle, type Rng, type PlayerInfo } from "@courtisans/engine"
export { type GameState as State, type CourtisansPlayerResult as PlayerResult } from "@courtisans/engine"
export * from "./lib/site"
export { SOUNDS } from "./lib/sounds"
export { DEFAULT_SKIN, SETTINGS_DEFAULTS } from "./lib/skin"

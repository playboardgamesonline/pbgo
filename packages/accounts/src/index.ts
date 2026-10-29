// The pure part of the accounts, which the browser, the server and the tests all read (docs/accounts.md). The Supabase clients are `./client` (browser),
// `./server` (Server Components and route handlers) and `./proxy` (the session refresh), kept apart so that none of them reaches the others' bundle.

export { AFTER_SIGN_IN, safeNext } from "./redirect"
export { PROVIDERS, PROVIDER_NAMES, accountOf, initialsOf } from "./account"
export type { Account, AuthUser, Provider } from "./account"
export { ordinal, perGame, statsOf } from "./games"
export type { PlayedGame } from "./games"
export { supabaseAuthConfig } from "./config"
export type { AuthEnv, SupabaseAuthConfig } from "./config"

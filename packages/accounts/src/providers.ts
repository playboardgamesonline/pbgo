// Which providers a Supabase project has switched on, so that the sign-in draws a button only for those: a button for a provider the project has not enabled would
// answer "Unsupported provider" to whoever pressed it. The project says it itself, in the settings of its Auth, which anyone may read with its publishable key.

import { EXTERNAL_PROVIDERS, PROVIDERS, SIGN_IN_PROVIDERS, type AnyProvider, type ExternalProvider, type Provider } from "./account"
import { supabaseAuthConfig, type SupabaseAuthConfig } from "./config"

/** How long the settings of a project are kept in production, in seconds: a provider switched on in the dashboard shows its button within that time. */
export const PROVIDERS_REVALIDATE_SECONDS = 300

/** How long the project may take to answer, in milliseconds: the sign-in page does not wait longer for its buttons. */
const TIMEOUT_MS = 3000

/**
 * The providers that the settings of an Auth project switch on (`external` maps each provider to a boolean), in the order of the buttons. Anything that is not such
 * a map gives none, and so does a provider that is not one of ours.
 */
export function providersOn(settings: unknown): Provider[] {
  const external = typeof settings === "object" && settings !== null ? (settings as { external?: unknown }).external : null
  if (typeof external !== "object" || external === null) return []
  return PROVIDERS.filter((provider) => (external as Record<string, unknown>)[provider] === true)
}

/**
 * The providers that the project has switched on right now: `GET /auth/v1/settings`, which needs the publishable key alone. Kept five minutes in production and not
 * at all in development, where a provider has just been switched on and is being tried. When the project is not set, does not answer in time or answers something
 * else, none: the sign-in then offers the password alone rather than a button that fails.
 */
export async function enabledProviders(config: SupabaseAuthConfig | null = supabaseAuthConfig(), doFetch: typeof fetch = fetch): Promise<Provider[]> {
  if (!config) return []
  const kept = process.env.NODE_ENV === "production" ? { next: { revalidate: PROVIDERS_REVALIDATE_SECONDS } } : { cache: "no-store" as const }
  try {
    const response = await doFetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.key }, signal: AbortSignal.timeout(TIMEOUT_MS), ...kept })
    return response.ok ? providersOn(await response.json()) : []
  } catch {
    return []
  }
}

/** The environment variables an external provider needs besides the means of making a member: Steam's Web API key, which gives the name and the picture of a player. */
const EXTERNAL_KEYS: Record<ExternalProvider, string> = { steam: "STEAM_WEB_API_KEY" }

/** What the server's environment gives: variable names to values. */
export type ServerEnv = Readonly<Record<string, string | undefined>>

const set = (value: string | undefined) => (value?.trim() ?? "") !== ""

/**
 * The external providers the server is set up for, in the order of `EXTERNAL_PROVIDERS`: the project and its publishable key (to spend the token that signs the member in), its secret key (to make the member) and the provider's own key. A provider with any of them missing is not offered: a
 * button that cannot sign anyone in is worse than none. The switch is the key, so that a provider is switched on in Vercel and off by removing it.
 */
export function externalProvidersOn(env: ServerEnv = process.env): ExternalProvider[] {
  const canMakeMembers = set(env.NEXT_PUBLIC_SUPABASE_URL) && set(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) && (set(env.SUPABASE_SECRET_KEY) || set(env.SUPABASE_SERVICE_ROLE_KEY))
  return canMakeMembers ? EXTERNAL_PROVIDERS.filter((provider) => set(env[EXTERNAL_KEYS[provider]])) : []
}

/**
 * What the sign-in and the sign-up offer, in the order of the buttons: the providers of `SIGN_IN_PROVIDERS` that the project has switched on (Twitch may be, and is only linked: it is not among them) and the external ones the
 * server is set up for. None when the project is not set, as for `enabledProviders`.
 */
export async function signInProviders(config: SupabaseAuthConfig | null = supabaseAuthConfig(), env: ServerEnv = process.env, doFetch: typeof fetch = fetch): Promise<AnyProvider[]> {
  if (!config) return []
  const on: readonly AnyProvider[] = [...(await enabledProviders(config, doFetch)), ...externalProvidersOn(env)]
  return SIGN_IN_PROVIDERS.filter((provider) => on.includes(provider))
}

// Where the accounts are: the Supabase project whose Auth signs the visitors in. The same two public variables the games read, so that the hub and the
// games talk to one project per environment (docs/supabase-and-env.md). The names are written out in full: Next inlines `process.env.NEXT_PUBLIC_*` into
// the browser's code only where it finds them spelled like this.

export type SupabaseAuthConfig = {
  /** The URL of the project, `https://<ref>.supabase.co`. */
  url: string
  /** Its publishable key: made to be public, the row level security is what protects the data. */
  key: string
}

/** What the environment gives: the URL and the publishable key of the project. */
export type AuthEnv = { url: string | undefined; key: string | undefined }

/** The two variables, as the build and the browser see them. */
export function authEnv(): AuthEnv {
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }
}

/** The configuration of the accounts, or null when the project is not set: the hub then has no sign-in, and says so rather than failing. */
export function supabaseAuthConfig(env: AuthEnv = authEnv()): SupabaseAuthConfig | null {
  const url = env.url?.trim()
  const key = env.key?.trim()
  return url && key ? { url, key } : null
}

import { MIN_SECRET_LENGTH, same } from "./admin-session"

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` to the jobs of `apps/web/vercel.json` when the project has that variable. A secret that is
 * missing, or shorter than the gamemaster's, authorizes nobody: a deployment that forgot it answers 401 instead of running for whoever asks.
 */
export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false
  return same(authorization ?? "", `Bearer ${secret}`)
}

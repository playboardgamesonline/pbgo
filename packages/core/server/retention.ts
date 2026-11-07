import "server-only"
import { feedbackCutoff, presenceCutoff, tableCutoff } from "../lib/retention"
import { supabaseAdmin } from "./supabase"
import { FEEDBACK_BUCKET } from "./tasks"

/** Feedback goes in batches of this size, so that a request to the Storage API and a `delete` stay small. */
export const PURGE_BATCH_SIZE = 100
/** A run deletes this many batches at most (5,000 feedback): a backlog is finished by the next nights and a run stays short. */
export const PURGE_MAX_BATCHES = 50

export type PurgeReport = {
  /** Nothing was deleted: the counts are what a real run would delete now */
  dryRun: boolean
  /** A table last written before the first, a feedback received before the second, a member last seen before the third, is old enough (`lib/retention.ts`) */
  cutoffs: { tables: string; feedback: string; presence: string }
  tables: number
  feedback: number
  /** The members' rows of `member_presence` (the last time each was seen on the site) */
  presence: number
  /** The screenshots of those feedback, removed from the bucket before their rows */
  screenshots: number
  /** One line per job that failed (the other one still ran); empty when all went well */
  errors: string[]
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error))

/**
 * The nightly clean-up of what the Privacy Policy promises (PLT-113): the tables written more than `TABLE_RETENTION_DAYS` ago, the
 * feedback received more than `FEEDBACK_RETENTION_MONTHS` ago, each feedback with its screenshot, and the members' last sight on the site
 * more than `PRESENCE_RETENTION_DAYS` ago. Called by `GET /api/cron/purge`, which Vercel Cron runs every night. Idempotent: a run that stops half way
 * (an error, the batch limit) is finished by the next one. The jobs are independent, one that fails is reported in `errors` and does not hold the others back.
 */
export async function purgeExpired({ now = new Date(), dryRun = false }: { now?: Date; dryRun?: boolean } = {}): Promise<PurgeReport> {
  const cutoffs = { tables: tableCutoff(now).toISOString(), feedback: feedbackCutoff(now).toISOString(), presence: presenceCutoff(now).toISOString() }
  const report: PurgeReport = { dryRun, cutoffs, tables: 0, feedback: 0, presence: 0, screenshots: 0, errors: [] }
  try {
    report.tables = await purgeTables(cutoffs.tables, dryRun)
  } catch (error) {
    report.errors.push(`tables: ${messageOf(error)}`)
  }
  try {
    report.presence = await purgePresence(cutoffs.presence, dryRun)
  } catch (error) {
    report.errors.push(`presence: ${messageOf(error)}`)
  }
  try {
    await purgeFeedback(cutoffs.feedback, dryRun, report)
  } catch (error) {
    report.errors.push(`feedback: ${messageOf(error)}`)
  }
  return report
}

/** Every game's tables in one statement: they are few, and `updated_at` has an index. */
async function purgeTables(cutoff: string, dryRun: boolean): Promise<number> {
  const games = supabaseAdmin().from("games")
  const { count, error } = dryRun
    ? await games.select("code", { count: "exact", head: true }).lt("updated_at", cutoff)
    : await games.delete({ count: "exact" }).lt("updated_at", cutoff)
  if (error) throw error
  return count ?? 0
}

/** The members' rows go in one statement: there is one row per member, and `seen_at` has an index. */
async function purgePresence(cutoff: string, dryRun: boolean): Promise<number> {
  const presence = supabaseAdmin().from("member_presence")
  const { count, error } = dryRun
    ? await presence.select("user_id", { count: "exact", head: true }).lt("seen_at", cutoff)
    : await presence.delete({ count: "exact" }).lt("seen_at", cutoff)
  if (error) throw error
  return count ?? 0
}

/** The counts go into `report` as each batch is done, so that a run that fails half way still says what it did. */
async function purgeFeedback(cutoff: string, dryRun: boolean, report: PurgeReport) {
  const db = supabaseAdmin()
  if (dryRun) {
    const [old, withScreenshot] = await Promise.all([
      db.from("feedback").select("id", { count: "exact", head: true }).lt("created_at", cutoff),
      db.from("feedback").select("id", { count: "exact", head: true }).lt("created_at", cutoff).not("screenshot", "is", null),
    ])
    if (old.error) throw old.error
    if (withScreenshot.error) throw withScreenshot.error
    report.feedback = old.count ?? 0
    report.screenshots = withScreenshot.count ?? 0
    return
  }
  for (let batch = 0; batch < PURGE_MAX_BATCHES; batch++) {
    const { data, error } = await db.from("feedback").select("id, screenshot").lt("created_at", cutoff).order("created_at").limit(PURGE_BATCH_SIZE)
    if (error) throw error
    const rows = (data ?? []) as Array<{ id: string; screenshot: string | null }>
    if (!rows.length) return
    const paths = rows.flatMap((row) => (row.screenshot ? [row.screenshot] : []))
    // The screenshots first, through the Storage API (a SQL delete leaves the file in the bucket, see `docs/supabase-and-env.md`):
    // a row that outlives its image is found again tomorrow, an image that outlives its row can never be found again
    if (paths.length) {
      const { error: removeError } = await db.storage.from(FEEDBACK_BUCKET).remove(paths)
      if (removeError) throw removeError
    }
    const ids = rows.map((row) => row.id)
    const { count, error: deleteError } = await db.from("feedback").delete({ count: "exact" }).in("id", ids)
    if (deleteError) throw deleteError
    report.feedback += count ?? 0
    report.screenshots += count ? paths.length : 0
    if (!count) {
      // None went. Vercel can call a job twice and the other run may have deleted these rows first, which is fine; rows that are still there are an error,
      // and the next batch would be the same one
      const { data: left, error: leftError } = await db.from("feedback").select("id").in("id", ids)
      if (leftError) throw leftError
      if (left?.length) throw new Error("feedback found but not deleted")
    }
    if (rows.length < PURGE_BATCH_SIZE) return
  }
}

import "server-only"
import { supabaseAdmin } from "./supabase"
import { FEEDBACK_BUCKET } from "./tasks"

// Deleting feedback, with its screenshot: the nightly clean-up of feedback past its twelve months (`retention.ts`) and the deletion of an account, which takes with it the feedback sent with the address of the account (`account-deletion.ts`).

type Db = ReturnType<typeof supabaseAdmin>

export type FeedbackRow = { id: string; screenshot: string | null }

/** Feedback goes in batches of this size, so that a request to the Storage API and a `delete` stay small. */
export const FEEDBACK_BATCH_SIZE = 100
/** The feedback of one address goes in this many batches at most: a person who sent more than 5,000 is finished by the next night, and their account is not deleted before. */
const FEEDBACK_OF_MAX_BATCHES = 50

/**
 * Deletes these feedback rows: first their screenshots, through the Storage API (a SQL delete leaves the file in the bucket, see `docs/supabase-and-env.md`), then the rows. A row that outlives its image is found again by the next night; an image that
 * outlives its row can never be found again. Answers how many rows and how many screenshots went.
 */
export async function removeFeedbackRows(db: Db, rows: FeedbackRow[]): Promise<{ deleted: number; screenshots: number }> {
  const paths = rows.flatMap((row) => (row.screenshot ? [row.screenshot] : []))
  if (paths.length) {
    const { error } = await db.storage.from(FEEDBACK_BUCKET).remove(paths)
    if (error) throw error
  }
  const ids = rows.map((row) => row.id)
  const { count, error } = await db.from("feedback").delete({ count: "exact" }).in("id", ids)
  if (error) throw error
  if (!count) {
    // None went. Vercel can call a job twice and the other run may have deleted these rows first, which is fine; rows that are still there are an error,
    // and the next batch would be the same one
    const { data: left, error: leftError } = await db.from("feedback").select("id").in("id", ids)
    if (leftError) throw leftError
    if (left?.length) throw new Error("feedback found but not deleted")
  }
  return { deleted: count ?? 0, screenshots: count ? paths.length : 0 }
}

/**
 * Deletes the feedback that was sent with this e-mail address (the optional field of the form), screenshots included: it is the one place where the address of an account is kept in our database apart from Supabase Auth. The match is the
 * address alone, whatever its case; `%`, `_` and `\` are escaped, since they mean something to `ilike` and an address may hold them. Throws when it is not finished, so that the account it belongs to is not deleted yet (nothing would link
 * the rest to it any more).
 */
export async function removeFeedbackOf(db: Db, email: string): Promise<{ deleted: number; screenshots: number }> {
  const pattern = email.trim().replace(/[\\%_]/g, "\\$&")
  const total = { deleted: 0, screenshots: 0 }
  for (let batch = 0; batch < FEEDBACK_OF_MAX_BATCHES; batch++) {
    const { data, error } = await db.from("feedback").select("id, screenshot").ilike("email", pattern).order("created_at").limit(FEEDBACK_BATCH_SIZE)
    if (error) throw error
    const rows = (data ?? []) as FeedbackRow[]
    if (!rows.length) return total
    const done = await removeFeedbackRows(db, rows)
    total.deleted += done.deleted
    total.screenshots += done.screenshots
    if (rows.length < FEEDBACK_BATCH_SIZE) return total
  }
  throw new Error("the feedback of this address is not all deleted yet")
}

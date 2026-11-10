import { trackAnonymously } from "../../../../server/analytics"
import { ApiError, handle } from "../../../../server/api"
import { cronAuthorized } from "../../../../server/cron"
import { purgeExpired } from "../../../../server/retention"

/**
 * `GET /api/cron/purge`: the nightly clean-up of old tables and feedback (`server/retention.ts`, PLT-113), run by Vercel Cron (`apps/web/vercel.json`)
 * with `Authorization: Bearer $CRON_SECRET`. `?dry=1` deletes nothing and counts what a real run would. It is not a game's route and has no rate limit:
 * the secret is long and random, and a run only deletes what is already old enough, so asking twice does nothing more than asking once.
 */
export const GET = handle(async (request: Request) => {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) throw new ApiError("ACCESS_DENIED", 401)
  const report = await purgeExpired({ dryRun: new URL(request.url).searchParams.get("dry") === "1" })
  // One count for each account that the clean-up deleted: the run says how many, never whose
  if (!report.dryRun) for (let account = 0; account < report.accounts; account++) trackAnonymously("account_deletion", { step: "purged" })
  // Counts and dates only, no personal data: Vercel keeps this line with the run of the cron job
  if (report.errors.length) {
    console.error("Purge failed", report)
    throw new ApiError("PURGE_FAILED", 500)
  }
  console.info("Purge", report)
  return report
})

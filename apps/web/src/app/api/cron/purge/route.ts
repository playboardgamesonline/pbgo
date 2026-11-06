import * as core from "@pbgo/core/routes/api/cron/purge/route"

// Vercel Cron calls this with a GET every night (apps/web/vercel.json), behind CRON_SECRET; it reads the clock and the database, so never static
export const dynamic = "force-dynamic"
export const maxDuration = 60

export const GET = core.GET

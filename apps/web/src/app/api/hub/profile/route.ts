import * as core from "@pbgo/core/routes/api/hub/profile/route"

// A member's own handle and the change of their nickname and tag (PLT-39): they read the visitor's session and the database, so never static
export const dynamic = "force-dynamic"

export const GET = core.GET
export const POST = core.POST

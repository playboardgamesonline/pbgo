import * as core from "@pbgo/core/routes/api/hub/profile/route"

// A member's own handle and the change of what their profile says (PLT-39): they read the visitor's session and the database, so never static. The city is checked at Geoapify
export const dynamic = "force-dynamic"

export const GET = core.GET
export const POST = core.POST

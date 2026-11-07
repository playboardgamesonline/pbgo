import * as core from "@pbgo/core/routes/api/hub/presence/route"

// The beat of a signed-in member who has the site open (`PresenceBeat`): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = core.POST

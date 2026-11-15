import { postGroup } from "@pbgo/core/routes/api/hub/groups/route"

// A change of the signed-in member's group (PLT-23): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = postGroup("kick")

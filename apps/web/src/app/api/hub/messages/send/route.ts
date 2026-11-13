import { postMessage } from "@pbgo/core/routes/api/hub/messages/route"

// A message between friends (PLT-25): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = postMessage("send")

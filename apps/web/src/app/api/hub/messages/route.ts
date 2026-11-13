import { getMessages } from "@pbgo/core/routes/api/hub/messages/route"

// The conversation of the signed-in member with a friend (PLT-25): it reads the visitor's session and the database, so never static
export const dynamic = "force-dynamic"

export const GET = getMessages

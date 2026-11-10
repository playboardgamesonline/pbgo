import { postFriend } from "@pbgo/core/routes/api/hub/friends/route"

// A change of the friends of the signed-in member (PLT-23): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = postFriend("block")

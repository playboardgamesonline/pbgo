import { getFriends } from "@pbgo/core/routes/api/hub/friends/route"
import { friendsDeps } from "@/lib/friends-deps"

// The social state of the signed-in member (PLT-23): it reads the visitor's session and the database, so never static
export const dynamic = "force-dynamic"

export const GET = getFriends(friendsDeps)

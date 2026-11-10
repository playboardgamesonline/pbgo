import { postPlay } from "@pbgo/core/routes/api/hub/play/route"
import { playDeps } from "@/lib/play-deps"

// The search of a visitor who presses Play (and asks again while it lasts): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = postPlay(playDeps)

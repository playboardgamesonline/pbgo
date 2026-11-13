import { postInvitation } from "@pbgo/core/routes/api/hub/invitations/route"
import { invitationDeps } from "@/lib/invitation-deps"

// An invitation to a table (PLT-109): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = postInvitation("accept", invitationDeps)

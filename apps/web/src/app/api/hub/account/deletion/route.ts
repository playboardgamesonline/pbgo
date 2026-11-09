import { deletionRoute } from "@pbgo/core/routes/api/hub/account/deletion/route"
import { deletionMail } from "@/lib/deletion-mail"

// The deletion of an account (PLT-36): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = deletionRoute(deletionMail)

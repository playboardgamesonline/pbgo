import * as core from "@pbgo/core/routes/api/hub/birthdate/route"

// A member declaring their date of birth (PLT-125): it reads the visitor's session and writes the database, so never static
export const dynamic = "force-dynamic"

export const POST = core.POST

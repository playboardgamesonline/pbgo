import * as core from "@pbgo/core/routes/api/hub/cities/route"

// The search of a city for the profile (PLT-139): it reads the address of the request, so never static
export const dynamic = "force-dynamic"

export const GET = core.GET

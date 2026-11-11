import { searchCities } from "@pbgo/cities"
import * as core from "@pbgo/core/routes/api/hub/cities/route"

// The search of a city for the profile (PLT-139): the list is in memory on the server, so a visitor's keystrokes go nowhere else. It reads the address of the request, so never static
export const dynamic = "force-dynamic"

export const GET = core.getCities(searchCities)

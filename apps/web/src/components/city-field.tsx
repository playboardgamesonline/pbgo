"use client"

import { useEffect, useRef, useState } from "react"
import { cityText, countryName, isCountryCode, type ProfileCity } from "@pbgo/accounts"
import { SearchSelect } from "@pbgo/ui/platform/search-select"

/** A city as the server's search sends it. */
type Found = { id: number; name: string; country: string; region: string | null }

/** What the search answered, read as safely as anything that comes from outside: only cities of this shape are drawn. */
function citiesOf(body: unknown): Found[] {
  const list = typeof body === "object" && body !== null ? (body as { cities?: unknown }).cities : null
  if (!Array.isArray(list)) return []
  return list.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return []
    const { id, name, country, region } = item as Record<string, unknown>
    if (typeof id !== "number" || !Number.isInteger(id) || typeof name !== "string" || name === "" || !isCountryCode(country)) return []
    return [{ id, name, country, region: typeof region === "string" && region !== "" ? region : null }]
  })
}

/** How long the member stops typing before the search goes: a city is a few letters, and the server is asked once for them. */
const PAUSE_MS = 200

/**
 * The City field of the Edit profile window: a search among the cities of the list that ships with the site (`GET /api/hub/cities`: the list is in memory on our server, so nothing a member types goes anywhere else). The member only ever picks a city of the list, never types one.
 * With a country set the search is limited to it; a city comes with its country, which the window sets when one is picked (`onCityChange`). The last answer is forgotten each time the panel opens.
 */
export function CityField({ id, city, country, disabled, onCityChange }: { id: string; city: ProfileCity | null; country: string | null; disabled: boolean; onCityChange: (city: ProfileCity | null) => void }) {
  const [results, setResults] = useState<Found[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const request = useRef<AbortController | null>(null)

  // A search that is still on its way when the window closes goes nowhere
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      request.current?.abort()
    },
    [],
  )

  function search(query: string) {
    if (timer.current) clearTimeout(timer.current)
    request.current?.abort()
    if (query.trim() === "") {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      request.current = controller
      try {
        const params = new URLSearchParams({ q: query })
        if (country) params.set("country", country)
        const response = await fetch(`/api/hub/cities?${params}`, { signal: controller.signal })
        setResults(response.ok ? citiesOf(await response.json()) : [])
      } catch {
        // A search that a newer one took the place of says nothing: that one is still loading
        if (controller.signal.aborted) return
        setResults([])
      }
      setLoading(false)
    }, PAUSE_MS)
  }

  return (
    <SearchSelect
      id={id}
      className="ph-mask"
      options={results.map((found) => ({ value: String(found.id), label: found.name, description: [found.region, countryName(found.country)].filter(Boolean).join(", ") }))}
      value={city === null ? null : String(city.id)}
      selectedLabel={city === null ? undefined : cityText(city)}
      onValueChange={(next) => {
        if (next === null) return onCityChange(null)
        const found = results.find((candidate) => String(candidate.id) === next)
        if (found) onCityChange({ id: found.id, name: found.name, country: found.country })
      }}
      onQueryChange={search}
      loading={loading}
      placeholder="Not set"
      searchPlaceholder="Search cities..."
      prompt="Type the first letters of your city."
      empty="No city matches."
      clearLabel="Clear"
      disabled={disabled}
      aria-label="City"
    />
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { cityText, countryName, isCountryCode, type ProfileCity } from "@pbgo/accounts"
import { SearchSelect } from "@pbgo/ui/platform/search-select"

/** A city as the server's search sends it. */
type Found = { name: string; country: string; region: string | null }

/** What the search answered, read as safely as anything that comes from outside: only cities of this shape are drawn. */
function citiesOf(body: unknown): Found[] {
  const list = typeof body === "object" && body !== null ? (body as { cities?: unknown }).cities : null
  if (!Array.isArray(list)) return []
  return list.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return []
    const { name, country, region } = item as Record<string, unknown>
    if (typeof name !== "string" || name === "" || !isCountryCode(country)) return []
    return [{ name, country, region: typeof region === "string" && region !== "" ? region : null }]
  })
}

/** How long the member stops typing before the search goes, and how few letters it takes: a city is a few letters, and every search spends a credit of the day's allowance. */
const PAUSE_MS = 200
const LETTERS_MIN = 2

/** A small link of the credit line. */
const LINK = "underline underline-offset-4 hover:text-foreground"

/**
 * The City field of the Edit profile window: a search among the cities Geoapify finds (`GET /api/hub/cities`: our server asks Geoapify, so a browser never talks to it and Geoapify gets the first letters, never a member). The member only ever picks a city of the results, never types one,
 * and the server checks it again when it is saved. With a country set the search is limited to it; a city comes with its country, which the window sets when one is picked (`onCityChange`). The last answer is forgotten each time the panel opens. Geoapify and OpenStreetMap are credited under it,
 * as the free plan of Geoapify asks.
 */
export function CityField({ id, city, country, disabled, onCityChange }: { id: string; city: ProfileCity | null; country: string | null; disabled: boolean; onCityChange: (city: ProfileCity | null) => void }) {
  const [results, setResults] = useState<Found[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
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
    setFailed(false)
    if (Array.from(query.trim()).length < LETTERS_MIN) {
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
        if (response.ok) setResults(citiesOf(await response.json()))
        else {
          setResults([])
          setFailed(true)
        }
      } catch {
        // A search that a newer one took the place of says nothing: that one is still loading
        if (controller.signal.aborted) return
        setResults([])
        setFailed(true)
      }
      setLoading(false)
    }, PAUSE_MS)
  }

  // Two cities of one name in one country are told apart by their division (Springfield, Illinois and Springfield, Missouri)
  const keyOf = (found: Found) => `${found.country}|${found.name}|${found.region ?? ""}`

  return (
    <div className="flex flex-col gap-2">
      <SearchSelect
        id={id}
        className="ph-mask"
        options={results.map((found) => ({ value: keyOf(found), label: found.name, description: [found.region, countryName(found.country)].filter(Boolean).join(", ") }))}
        value={city === null ? null : `${city.country}|${city.name}|`}
        selectedLabel={city === null ? undefined : cityText(city)}
        onValueChange={(next) => {
          if (next === null) return onCityChange(null)
          const found = results.find((candidate) => keyOf(candidate) === next)
          if (found) onCityChange({ name: found.name, country: found.country })
        }}
        onQueryChange={search}
        loading={loading}
        placeholder="Not set"
        searchPlaceholder="Search cities..."
        prompt="Type the first letters of your city."
        empty={failed ? "Cities can't be searched right now." : "No city matches."}
        clearLabel="Clear"
        disabled={disabled}
        aria-label="City"
      />
      <p className="text-xs text-muted-foreground">
        Cities by{" "}
        <a className={LINK} href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
          Geoapify
        </a>{" "}
        ·{" "}
        <a className={LINK} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  )
}

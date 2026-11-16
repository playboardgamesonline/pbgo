"use client"

import { useEffect, useRef, useState } from "react"
import { cityText, countryName, isCountryCode, type ProfileCity } from "@pbgo/accounts"
import { optionMatches } from "@pbgo/ui/match-options"
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

/** How many countries the list offers above the cities, when what is typed holds the name of some. */
const COUNTRIES_SHOWN = 3

/** A small link of the credit line. */
const LINK = "underline underline-offset-4 hover:text-foreground"

/** Where a member is, as the field says it: a city with its country, or a country alone, or nothing. */
export type Place = { country: string | null; city: ProfileCity | null }

// What names an option of the list: a country by its code, a city by its country, its name and its division (two cities of one name in one country are told apart by it: Springfield, Illinois and Springfield, Missouri)
const countryKey = (code: string) => `country|${code}`
const cityKey = (found: Found) => `city|${found.country}|${found.name}|${found.region ?? ""}`

/**
 * The Location field of the Edit profile window: one search for where a member is, which holds a city or a country alone. What is typed is looked for in the countries (here, at once: three at most, above) and among the cities Geoapify finds (`GET /api/hub/cities`: our server asks Geoapify,
 * so a browser never talks to it and Geoapify gets the first letters, never a member). The member only ever picks: a city, which comes with its country, or a country, which leaves no city; the server checks the city again when it is saved. Where the search of a city is off (`cities` is
 * false: the server has no key) the field is a search among the countries. The last answer is forgotten each time the panel opens, as the free plan of Geoapify asks.
 */
export function LocationField({
  id,
  country,
  city,
  countries,
  cities,
  disabled,
  onChange,
}: {
  id: string
  country: string | null
  city: ProfileCity | null
  countries: readonly { code: string; name: string }[]
  cities: boolean
  disabled: boolean
  onChange: (place: Place) => void
}) {
  const [results, setResults] = useState<Found[]>([])
  const [query, setQuery] = useState("")
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

  function search(text: string) {
    setQuery(text)
    if (timer.current) clearTimeout(timer.current)
    request.current?.abort()
    setFailed(false)
    if (Array.from(text.trim()).length < LETTERS_MIN) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      const controller = new AbortController()
      request.current = controller
      try {
        const response = await fetch(`/api/hub/cities?${new URLSearchParams({ q: text })}`, { signal: controller.signal })
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

  const here = city !== null ? cityText(city) : country !== null ? countryName(country) : undefined
  const value = city !== null ? `city|${city.country}|${city.name}|` : country !== null ? countryKey(country) : null
  // Among cities a country says it is one; in a list of countries alone there is nothing to say
  const countryOptions = (list: readonly { code: string; name: string }[], among: boolean) => list.map((entry) => ({ value: countryKey(entry.code), label: entry.name, ...(among ? { description: "Country" } : {}) }))

  function pick(next: string | null) {
    if (next === null) return onChange({ country: null, city: null })
    if (next.startsWith("country|")) {
      const code = next.slice("country|".length)
      if (isCountryCode(code)) onChange({ country: code, city: null })
      return
    }
    const found = results.find((candidate) => cityKey(candidate) === next)
    if (found) onChange({ country: found.country, city: { name: found.name, country: found.country } })
  }

  const common = { id, className: "ph-mask", selectedLabel: here, value, onValueChange: pick, placeholder: "Not set", clearLabel: "Clear", disabled, "aria-label": "Location" }

  // Without the search of a city the field is a search among the countries, which the list filters itself
  if (!cities) return <SearchSelect {...common} options={countryOptions(countries, false)} searchPlaceholder="Search countries..." empty="No country matches." />

  const matching = query.trim() === "" ? [] : countries.filter((entry) => optionMatches(entry.name, query)).slice(0, COUNTRIES_SHOWN)
  return (
    <div className="flex flex-col gap-2">
      <SearchSelect
        {...common}
        options={[
          ...countryOptions(matching, true),
          ...results.map((found) => ({ value: cityKey(found), label: found.name, description: [found.region, countryName(found.country)].filter(Boolean).join(", ") })),
        ]}
        onQueryChange={search}
        loading={loading}
        searchPlaceholder="Search cities or countries..."
        prompt="Type the first letters of your city or your country."
        empty={failed ? "Cities can't be searched right now." : "No city or country matches."}
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

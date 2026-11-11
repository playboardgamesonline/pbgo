"use client"

import { useRef, useState } from "react"
import { CountedTextarea } from "@pbgo/ui/platform/counted-textarea"
import { CoverTile } from "@pbgo/ui/platform/cover-tile"
import { MultiSelect } from "@pbgo/ui/platform/multi-select"
import { SearchSelect } from "@pbgo/ui/platform/search-select"

// The live specimens of the pickers (`SearchSelect`, `MultiSelect`, `CountedTextarea`, `CoverTile`): they keep their picks as long as the page is open. The pictures are drawn by the browser, so no address is needed: the tiles are plain frames.

const COUNTRIES = [
  { value: "BE", label: "Belgium" },
  { value: "CA", label: "Canada" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "ES", label: "Spain" },
  { value: "CH", label: "Switzerland" },
  { value: "US", label: "United States" },
]

const GAMES = ["Courtisans", "Flip 7", "Hanabi", "Skull King", "The Crew", "6 nimmt!", "Exploding Kittens"].map((name) => ({ value: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), label: name, cover: {} }))

export function SearchSelectSpecimen() {
  const [country, setCountry] = useState<string | null>("FR")
  return (
    <div className="w-full max-w-xs">
      <SearchSelect options={COUNTRIES} value={country} onValueChange={setCountry} placeholder="Select a country" searchPlaceholder="Search countries..." empty="No country matches." clearLabel="Clear" aria-label="Country" />
    </div>
  )
}

export function MultiSelectSpecimen() {
  const [picked, setPicked] = useState<string[]>(["courtisans", "hanabi"])
  return (
    <div className="w-full max-w-md">
      <MultiSelect options={GAMES} value={picked} onValueChange={setPicked} max={5} placeholder="Add a game" searchPlaceholder="Search games..." empty="No game matches." aria-label="Favourite games" />
    </div>
  )
}

export function CountedTextareaSpecimen() {
  const [text, setText] = useState("I play late. Come and join!")
  return (
    <div className="w-full max-w-md">
      <CountedTextarea value={text} onChange={(event) => setText(event.target.value)} left={200 - text.length} aria-label="Bio" placeholder="A few words about you" />
    </div>
  )
}

export function CoverTileSpecimen() {
  return (
    <div className="flex items-center gap-3">
      <CoverTile />
      <CoverTile className="size-14 rounded-2xl" />
      <CoverTile className="size-20 rounded-3xl" />
    </div>
  )
}

/** A search that answers after a short wait, as a server does: the countries whose name starts with what was typed. */
export function SearchSelectRemoteSpecimen() {
  const [value, setValue] = useState<string | null>(null)
  const [options, setOptions] = useState<typeof COUNTRIES>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function search(query: string) {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim() === "") {
      setOptions([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(() => {
      setOptions(COUNTRIES.filter((country) => country.label.toLowerCase().startsWith(query.trim().toLowerCase())))
      setLoading(false)
    }, 300)
  }
  const picked = COUNTRIES.find((country) => country.value === value)
  return (
    <div className="w-full max-w-xs">
      <SearchSelect
        options={options.map((country) => ({ ...country, description: country.value }))}
        value={value}
        selectedLabel={picked?.label}
        onValueChange={setValue}
        onQueryChange={search}
        loading={loading}
        placeholder="Not set"
        searchPlaceholder="Search..."
        prompt="Type the first letters."
        empty="No country matches."
        clearLabel="Clear"
        aria-label="Country"
      />
    </div>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  FAVORITES_MAX,
  PRONOUNS,
  bioCharactersLeft,
  checkBio,
  checkNickname,
  checkTag,
  nicknameCharactersLeft,
  profilePath,
  tagText,
  type ProfileCity,
  type ProfileDetails,
  type ProfileEdit,
  type Pronouns,
} from "@pbgo/accounts"
import { saveNickname, useAccount } from "@pbgo/accounts/client"
import { trackClient } from "@pbgo/analytics/client"
import { ApiClientError, gameRequest } from "@pbgo/core/lib/api"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Button } from "@pbgo/ui/platform/button"
import type { ComboboxOption } from "@pbgo/ui/platform/combobox"
import { CountedTextarea } from "@pbgo/ui/platform/counted-textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Field, FieldError, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { MultiSelect } from "@pbgo/ui/platform/multi-select"
import { SearchSelect } from "@pbgo/ui/platform/search-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { toast } from "@pbgo/ui/platform/sonner"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { CityField } from "@/components/city-field"
import { changing } from "@/lib/settings-change"
import { messageOf } from "@/lib/table-door"
import { rememberOwnHandle } from "@/lib/use-own-handle"

/** What a select cannot say with an empty value: no pronouns. */
const NO_PRONOUNS = "none"

/** What the analytics are told of a refusal: the ways the profile route says no (a favourite that is not a game is one more way to be invalid). */
const REFUSALS: Record<string, "taken" | "invalid" | "unavailable"> = { PROFILE_TAKEN: "taken", PROFILE_INVALID: "invalid", PROFILE_GAME_UNKNOWN: "invalid", PROFILE_CITY_UNKNOWN: "invalid", PROFILE_UNAVAILABLE: "unavailable" }

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((slug, index) => slug === b[index])

type Saved = { nickname: string; tag: number } & ProfileDetails

const sameCity = (a: ProfileCity | null, b: ProfileCity | null): boolean => a?.name === b?.name && a?.country === b?.country

/**
 * The Edit profile window of a member's own profile (`/me` and their public page): their username and tag, their pronouns (a list), their country (searched in a list), their city (searched at Geoapify, never typed: `CityField`), up to five favourite games of the catalog (with their covers) and a short bio. One Save sends
 * what changed, and only that, to `POST /api/hub/profile`, which keeps it whole or not at all: the pair that somebody else has is told in place and nothing else is changed. The window closes on Save and the page behind it is drawn again (on the public page, the new
 * address when the pair changed). The account keeps a copy of the username for the navbar (`saveNickname`). The picture is the provider's and is not edited here. `address` says which page the member is on.
 */
export function EditProfileDialog({
  nickname,
  tag,
  details,
  games,
  countries,
  cities,
  demo,
  address,
}: {
  nickname: string
  tag: number
  details: ProfileDetails
  /** Every game of the catalog, as a favourite can be picked: its slug, its name and its small cover. */
  games: readonly ComboboxOption[]
  countries: readonly { code: string; name: string }[]
  /** The search of a city is on (the server has the key of Geoapify): without it the window has no City field. */
  cities: boolean
  demo: boolean
  address: "me" | "player"
}) {
  const router = useRouter()
  const session = useAccount()
  const [saved, setSaved] = useState<Saved>({ nickname, tag, ...details })
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(nickname)
  const [tagValue, setTagValue] = useState(tagText(tag))
  const [pronouns, setPronouns] = useState<Pronouns | null>(details.pronouns)
  const [country, setCountry] = useState<string | null>(details.country)
  const [city, setCity] = useState<ProfileCity | null>(details.city)
  const [favorites, setFavorites] = useState<string[]>(details.favoriteGames)
  const [bio, setBio] = useState(details.bio ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const checkedName = checkNickname(name)
  const checkedTag = checkTag(tagValue)
  const checkedBio = checkBio(bio)
  const nameProblem = checkedName.ok ? null : checkedName.problem
  const tagProblem = checkedTag.ok ? null : checkedTag.problem
  const bioProblem = checkedBio.ok ? null : checkedBio.problem

  // Only what changed is sent: a field the member did not touch is never rewritten
  const edit: ProfileEdit = {}
  if (checkedName.ok && checkedName.nickname !== saved.nickname) edit.nickname = checkedName.nickname
  if (checkedTag.ok && checkedTag.tag !== saved.tag) edit.tag = checkedTag.tag
  if (pronouns !== saved.pronouns) edit.pronouns = pronouns
  if (country !== saved.country) edit.country = country
  if (!sameCity(city, saved.city)) edit.city = city
  if (!sameList(favorites, saved.favoriteGames)) edit.favoriteGames = favorites
  if (checkedBio.ok && checkedBio.bio !== saved.bio) edit.bio = checkedBio.bio
  const canSave = checkedName.ok && checkedTag.ok && checkedBio.ok && Object.keys(edit).length > 0

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setName(saved.nickname)
      setTagValue(tagText(saved.tag))
      setPronouns(saved.pronouns)
      setCountry(saved.country)
      setCity(saved.city)
      setFavorites(saved.favoriteGames)
      setBio(saved.bio ?? "")
      setError(null)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave || pending || !checkedName.ok || !checkedTag.ok || !checkedBio.ok) return
    setError(null)
    setPending(true)
    try {
      await gameRequest("/api/hub/profile", { method: "POST", body: JSON.stringify(edit) })
    } catch (failure) {
      setPending(false)
      const reason = failure instanceof ApiClientError ? REFUSALS[failure.code] : undefined
      if (reason) trackClient("profile_update_refused", { reason })
      setError(messageOf(failure))
      return
    }
    const next: Saved = {
      nickname: edit.nickname ?? saved.nickname,
      tag: edit.tag ?? saved.tag,
      pronouns: edit.pronouns === undefined ? saved.pronouns : edit.pronouns,
      country: edit.country === undefined ? saved.country : edit.country,
      city: edit.city === undefined ? saved.city : edit.city,
      favoriteGames: edit.favoriteGames ?? saved.favoriteGames,
      bio: edit.bio === undefined ? saved.bio : edit.bio,
    }
    // The account keeps a copy of the username for the navbar: the profile is changed already, so a copy that cannot be written is no reason to say the change failed
    if (edit.nickname !== undefined) await changing(demo, () => saveNickname(next.nickname))
    if (edit.nickname !== undefined || edit.tag !== undefined) {
      // The account menu and the head of the panel say the new pair at once
      if (session.status === "signed-in") rememberOwnHandle(session.account.id, { nickname: next.nickname, tag: next.tag })
    }
    trackClient("profile_updated", {
      nickname: edit.nickname !== undefined,
      tag: edit.tag !== undefined,
      pronouns: edit.pronouns !== undefined,
      country: edit.country !== undefined,
      city: edit.city !== undefined,
      favorites: edit.favoriteGames !== undefined,
      bio: edit.bio !== undefined,
    })
    setSaved(next)
    setPending(false)
    setOpen(false)
    toast.success("Profile saved")
    // The public page is at the member's handle: when the handle changed, the page behind the window has to move to the new one
    if (address === "player" && (edit.nickname !== undefined || edit.tag !== undefined)) router.replace(profilePath({ nickname: next.nickname, tag: next.tag }, "account"))
    else router.refresh()
  }

  const left = nicknameCharactersLeft(name)
  return (
    <>
      <Button variant="outline" onClick={() => toggle(true)}>
        Edit profile
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && toggle(next)}>
        <DialogContent aria-describedby={undefined} className="max-h-svh overflow-y-auto sm:max-w-lg">
          <form onSubmit={submit} noValidate aria-busy={pending} className="grid gap-6">
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
            </DialogHeader>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-5">
              <div className="flex items-start gap-3">
                <Field className="min-w-0 flex-1" data-invalid={nameProblem ? true : undefined}>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor="profile-name">Username</FieldLabel>
                    <span className={left < 0 ? "text-xs tabular-nums text-destructive" : "text-xs tabular-nums text-muted-foreground"}>
                      {left}
                      <span className="sr-only"> characters left</span>
                    </span>
                  </div>
                  <Input
                    id="profile-name"
                    className="ph-mask"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setError(null)
                    }}
                    // A little room over the limit, so that the counter can go below zero and the field can say why the name is refused
                    maxLength={DISPLAY_NAME_MAX * 2}
                    autoComplete="nickname"
                    // A field called username is where a password manager offers a login: this one is not it
                    data-1p-ignore
                    data-lpignore="true"
                    disabled={pending}
                    aria-invalid={nameProblem ? true : undefined}
                    aria-describedby={nameProblem ? "profile-name-error" : undefined}
                  />
                  <FieldError id="profile-name-error">{nameProblem}</FieldError>
                </Field>
                <Field className="w-28 shrink-0" data-invalid={tagProblem ? true : undefined}>
                  <FieldLabel htmlFor="profile-tag">Tag</FieldLabel>
                  <Input
                    id="profile-tag"
                    className="ph-mask tabular-nums"
                    value={tagValue}
                    onChange={(event) => {
                      setTagValue(event.target.value)
                      setError(null)
                    }}
                    inputMode="numeric"
                    maxLength={5}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    disabled={pending}
                    aria-invalid={tagProblem ? true : undefined}
                    aria-describedby={tagProblem ? "profile-tag-error" : undefined}
                  />
                  <FieldError id="profile-tag-error">{tagProblem}</FieldError>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="profile-pronouns">Pronouns</FieldLabel>
                <Select
                  value={pronouns ?? NO_PRONOUNS}
                  onValueChange={(value) => {
                    setPronouns(value === NO_PRONOUNS ? null : (value as Pronouns))
                    setError(null)
                  }}
                  disabled={pending}
                >
                  <SelectTrigger id="profile-pronouns" className="ph-mask w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start">
                    {PRONOUNS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={NO_PRONOUNS}>None</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="profile-country">Country / region</FieldLabel>
                <SearchSelect
                  id="profile-country"
                  className="ph-mask"
                  options={countries.map((entry) => ({ value: entry.code, label: entry.name }))}
                  value={country}
                  onValueChange={(next) => {
                    setCountry(next)
                    // A city belongs to its country: another country, or none, takes it away
                    if (city && city.country !== next) setCity(null)
                    setError(null)
                  }}
                  placeholder="Not set"
                  searchPlaceholder="Search countries..."
                  empty="No country matches."
                  clearLabel="Clear"
                  disabled={pending}
                  aria-label="Country / region"
                />
              </Field>

              {cities && (
                <Field>
                  <FieldLabel htmlFor="profile-city">City</FieldLabel>
                  <CityField
                    id="profile-city"
                    city={city}
                    country={country}
                    disabled={pending}
                    onCityChange={(next) => {
                      setCity(next)
                      // A city comes with its country
                      if (next) setCountry(next.country)
                      setError(null)
                    }}
                  />
                </Field>
              )}

              <Field>
                <FieldLabel id="profile-favorites-label">Favorite board games</FieldLabel>
                <MultiSelect
                  options={games}
                  value={favorites}
                  onValueChange={(next) => {
                    setFavorites(next)
                    setError(null)
                  }}
                  max={FAVORITES_MAX}
                  placeholder="Add a board game"
                  searchPlaceholder="Search games..."
                  empty="No game matches."
                  disabled={pending}
                  aria-label="Favorite board games"
                />
              </Field>

              <Field data-invalid={bioProblem ? true : undefined}>
                <FieldLabel htmlFor="profile-bio">Bio</FieldLabel>
                <CountedTextarea
                  id="profile-bio"
                  className="ph-mask"
                  value={bio}
                  onChange={(event) => {
                    setBio(event.target.value)
                    setError(null)
                  }}
                  left={bioCharactersLeft(bio)}
                  // Room over the limit, so that the counter can go below zero and the field can say why the bio is refused
                  maxLength={BIO_MAX * 2}
                  rows={3}
                  placeholder="A few words about you"
                  disabled={pending}
                  aria-invalid={bioProblem ? true : undefined}
                  aria-describedby={bioProblem ? "profile-bio-error" : undefined}
                />
                <FieldError id="profile-bio-error">{bioProblem}</FieldError>
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => toggle(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave || pending}>
                {pending && <Spinner />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

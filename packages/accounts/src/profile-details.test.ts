import { describe, expect, it } from "vitest"
import { BIO_LINE_BREAKS_MAX, BIO_MAX, FAVORITES_MAX, PRONOUNS, bioCharactersLeft, checkBio, cityOfRequest, cityText, cleanBio, detailsOf, favoriteGamesOf, hasProfileDetails, isGameSlug, isPronouns, noProfileDetails, parseProfileEdit, pronounsLabel } from "./profile-details"

describe("the pronouns", () => {
  it("are a fixed list, each with a key the database keeps and the words a page writes", () => {
    expect(PRONOUNS.map((pronouns) => pronouns.value)).toEqual(["he/him", "she/her", "they/them", "he/they", "she/they", "any", "ask"])
    expect(PRONOUNS.map((pronouns) => pronouns.label)).toEqual(["he/him", "she/her", "they/them", "he/they", "she/they", "any pronouns", "ask me"])
    expect(new Set(PRONOUNS.map((pronouns) => pronouns.value)).size).toBe(PRONOUNS.length)
  })

  it("are known by their key and nothing else", () => {
    for (const { value } of PRONOUNS) expect(isPronouns(value)).toBe(true)
    for (const value of ["", "none", "He/Him", "he/she", "any pronouns", "ask me", 3, null, undefined, {}, ["he/him"]]) expect(isPronouns(value), String(value)).toBe(false)
  })

  it("are written as the list says", () => {
    expect(pronounsLabel("they/them")).toBe("they/them")
    expect(pronounsLabel("any")).toBe("any pronouns")
    expect(pronounsLabel("ask")).toBe("ask me")
  })
})

describe("cleanBio", () => {
  it("trims, and writes every line break as \\n", () => {
    expect(cleanBio("  Hello  ")).toBe("Hello")
    expect(cleanBio("a\r\nb\rc\nd")).toBe("a\nb\nc\nd")
    expect(cleanBio("a\u2028b\u2029c")).toBe("a\nb\nc")
    expect(cleanBio("\n\nHello\n\n")).toBe("Hello")
  })

  it("takes out the control characters but the line break", () => {
    expect(cleanBio("a\tb\u0007c\u0000d\u007fe\u0085f")).toBe("abcdef")
    expect(cleanBio("a\nb")).toBe("a\nb")
  })

  it("keeps what a person writes: emoji, accents, symbols, other scripts, text that looks like HTML", () => {
    const text = "Héllo 🎲 — “quoted” 日本語 <b>bold</b> & <script>alert(1)</script>"
    expect(cleanBio(text)).toBe(text)
  })

  it("leaves nothing of blanks", () => {
    expect(cleanBio("")).toBe("")
    expect(cleanBio(" \n\t \r\n ")).toBe("")
  })

  it("is a fixed point: what it keeps, it keeps again", () => {
    for (const text of ["  a\r\nb  ", "x\u2028y", "\u0007hi\u0007", "🎲"]) expect(cleanBio(cleanBio(text))).toBe(cleanBio(text))
  })
})

describe("checkBio", () => {
  it("keeps a bio as it is cleaned", () => {
    expect(checkBio("  I play late.\r\nCome and join!  ")).toEqual({ ok: true, bio: "I play late.\nCome and join!" })
  })

  it("is null for a field with nothing in it: it takes the bio away", () => {
    expect(checkBio("")).toEqual({ ok: true, bio: null })
    expect(checkBio("   \n  ")).toEqual({ ok: true, bio: null })
    expect(checkBio("\u0007")).toEqual({ ok: true, bio: null })
  })

  it("counts characters as a person does, 200 at most", () => {
    expect(checkBio("b".repeat(BIO_MAX))).toEqual({ ok: true, bio: "b".repeat(BIO_MAX) })
    expect(checkBio("🎲".repeat(BIO_MAX)).ok).toBe(true)
    expect(checkBio("b".repeat(BIO_MAX + 1))).toEqual({ ok: false, problem: "Use 200 characters at most." })
    expect(checkBio("🎲".repeat(BIO_MAX + 1)).ok).toBe(false)
  })

  it("counts the characters of the text that is kept: what is trimmed or taken out does not count", () => {
    expect(checkBio(`  ${"b".repeat(BIO_MAX)}  \u0007`).ok).toBe(true)
  })

  it("allows three line breaks and no more, whatever kind they are", () => {
    expect(BIO_LINE_BREAKS_MAX).toBe(3)
    expect(checkBio("a\nb\nc\nd").ok).toBe(true)
    expect(checkBio("a\nb\nc\nd\ne")).toEqual({ ok: false, problem: "Use 3 line breaks at most." })
    expect(checkBio("a\r\nb\r\nc\r\nd\r\ne").ok).toBe(false)
    expect(checkBio("a\u2028b\u2028c\u2028d\u2028e").ok).toBe(false)
    // The line breaks around the text are trimmed: they were never in the bio
    expect(checkBio("\n\na\nb\nc\nd\n\n").ok).toBe(true)
  })

  it("never reads text as markup: it keeps it as it is for a page to draw as text", () => {
    expect(checkBio("<img src=x onerror=alert(1)>")).toEqual({ ok: true, bio: "<img src=x onerror=alert(1)>" })
  })
})

describe("bioCharactersLeft", () => {
  it("is what the counter shows: 200 less what is kept", () => {
    expect(bioCharactersLeft("")).toBe(200)
    expect(bioCharactersLeft("hello")).toBe(195)
    expect(bioCharactersLeft("🎲🎲")).toBe(198)
    expect(bioCharactersLeft("  hello  ")).toBe(195)
  })

  it("is negative exactly when the bio is refused for its length", () => {
    expect(bioCharactersLeft("b".repeat(200))).toBe(0)
    expect(bioCharactersLeft("b".repeat(201))).toBe(-1)
    expect(checkBio("b".repeat(201)).ok).toBe(false)
  })
})

describe("the favourite games", () => {
  it("are slugs: lowercase letters and digits, words joined by single dashes, 48 characters at most", () => {
    for (const slug of ["courtisans", "flip-7", "6-nimmt", "a", "the-werewolves-of-millers-hollow-the-village", "a".repeat(48)]) expect(isGameSlug(slug), slug).toBe(true)
    for (const slug of ["", "Flip-7", "flip 7", "flip--7", "-flip", "flip-", "a/b", "a_b", "é", "a".repeat(49), 7, null, undefined, ["a"]]) expect(isGameSlug(slug), String(slug)).toBe(false)
  })

  it("are a list of five at most with no slug twice, in the order they were put", () => {
    expect(FAVORITES_MAX).toBe(5)
    expect(favoriteGamesOf(["flip-7", "courtisans", "hanabi"])).toEqual(["flip-7", "courtisans", "hanabi"])
    expect(favoriteGamesOf([])).toEqual([])
    expect(favoriteGamesOf(["a", "b", "c", "d", "e"])).toEqual(["a", "b", "c", "d", "e"])
  })

  it("are refused when they are six, twice the same, not slugs, or not a list", () => {
    expect(favoriteGamesOf(["a", "b", "c", "d", "e", "f"])).toBeNull()
    expect(favoriteGamesOf(["a", "b", "a"])).toBeNull()
    expect(favoriteGamesOf(["Flip 7"])).toBeNull()
    expect(favoriteGamesOf([7])).toBeNull()
    expect(favoriteGamesOf([null])).toBeNull()
    expect(favoriteGamesOf([["a"]])).toBeNull()
    for (const value of ["flip-7", 7, null, undefined, {}, { 0: "a", length: 1 }]) expect(favoriteGamesOf(value), String(value)).toBeNull()
  })
})

describe("detailsOf", () => {
  it("reads what a row of the database says", () => {
    expect(detailsOf({ pronouns: "they/them", country: "FR", favorite_games: ["courtisans", "flip-7"], bio: "Hello\nthere" })).toEqual({ pronouns: "they/them", country: "FR", city: null, favoriteGames: ["courtisans", "flip-7"], bio: "Hello\nthere" })
  })

  it("says nothing for a row that has none of it, or no row (the migration is not applied)", () => {
    expect(detailsOf({})).toEqual(noProfileDetails())
    expect(detailsOf({ user_id: "x", nickname: "Ann" })).toEqual(noProfileDetails())
    expect(detailsOf(null)).toEqual(noProfileDetails())
    expect(detailsOf(undefined)).toEqual(noProfileDetails())
    expect(detailsOf({ pronouns: null, country: null, favorite_games: [], bio: null })).toEqual(noProfileDetails())
  })

  it("never draws what it does not hold: a pronoun off the list, a country that is no country, slugs that are not slugs, a bio that is not text", () => {
    expect(detailsOf({ pronouns: "xe/xem", country: "ZZ", favorite_games: "flip-7", bio: 12 })).toEqual(noProfileDetails())
    expect(detailsOf({ country: "fr" }).country).toBeNull()
    expect(detailsOf({ favorite_games: ["Flip 7", 7, null, "flip-7"] }).favoriteGames).toEqual(["flip-7"])
    expect(detailsOf({ favorite_games: ["a", "b", "a"] }).favoriteGames).toEqual(["a", "b"])
    expect(detailsOf({ favorite_games: ["a", "b", "c", "d", "e", "f", "g"] }).favoriteGames).toEqual(["a", "b", "c", "d", "e"])
    expect(detailsOf({ bio: "x".repeat(201) }).bio).toBeNull()
    expect(detailsOf({ bio: "   " }).bio).toBeNull()
  })

  it("gives a new object each time, so that nobody shares the list of another", () => {
    const one = noProfileDetails()
    one.favoriteGames.push("x")
    expect(noProfileDetails().favoriteGames).toEqual([])
  })
})

describe("hasProfileDetails", () => {
  it("is true when anything is filled in", () => {
    expect(hasProfileDetails(noProfileDetails())).toBe(false)
    expect(hasProfileDetails({ ...noProfileDetails(), pronouns: "any" })).toBe(true)
    expect(hasProfileDetails({ ...noProfileDetails(), country: "BE" })).toBe(true)
    expect(hasProfileDetails({ ...noProfileDetails(), favoriteGames: ["hanabi"] })).toBe(true)
    expect(hasProfileDetails({ ...noProfileDetails(), bio: "Hi" })).toBe(true)
  })
})

describe("parseProfileEdit", () => {
  it("keeps the fields that are there, cleaned as the profile keeps them", () => {
    expect(parseProfileEdit({ nickname: "  Marly   74 ", tag: " #0042 ", pronouns: "she/her", country: "fr", favoriteGames: ["courtisans", "flip-7"], bio: "  Hi\r\nthere  " })).toEqual({
      ok: true,
      edit: { nickname: "Marly 74", tag: 42, pronouns: "she/her", country: "FR", favoriteGames: ["courtisans", "flip-7"], bio: "Hi\nthere" },
    })
  })

  it("leaves out a field that is not there: it stays as it is", () => {
    expect(parseProfileEdit({ bio: "Hi" })).toEqual({ ok: true, edit: { bio: "Hi" } })
    expect(parseProfileEdit({ tag: 7 })).toEqual({ ok: true, edit: { tag: 7 } })
    expect(parseProfileEdit({ nickname: "Alex", pronouns: undefined })).toEqual({ ok: true, edit: { nickname: "Alex" } })
  })

  it("takes the pronouns, the country, the favourites and the bio away with null or nothing", () => {
    expect(parseProfileEdit({ pronouns: null, country: null, favoriteGames: null, bio: null })).toEqual({ ok: true, edit: { pronouns: null, country: null, favoriteGames: [], bio: null } })
    expect(parseProfileEdit({ pronouns: "", country: "", favoriteGames: [], bio: "   " })).toEqual({ ok: true, edit: { pronouns: null, country: null, favoriteGames: [], bio: null } })
  })

  it("refuses a field that no profile can hold, and keeps nothing of the rest", () => {
    for (const body of [
      { nickname: "" },
      { nickname: "   " },
      { nickname: 7 },
      { nickname: null },
      { nickname: "a".repeat(21) },
      { nickname: "A#1" },
      { nickname: "A/B" },
      { tag: 0 },
      { tag: 10000 },
      { tag: "x" },
      { tag: null },
      { tag: 4.2 },
      { tag: [42] },
      { pronouns: "he/she" },
      { pronouns: "HE/HIM" },
      { pronouns: "None" },
      { pronouns: 3 },
      { pronouns: false },
      { country: "ZZ" },
      { country: "FRA" },
      { country: 12 },
      { country: ["FR"] },
      { favoriteGames: "flip-7" },
      { favoriteGames: ["a", "b", "c", "d", "e", "f"] },
      { favoriteGames: ["a", "a"] },
      { favoriteGames: ["Flip 7"] },
      { favoriteGames: [7] },
      { favoriteGames: {} },
      { bio: "b".repeat(201) },
      { bio: "a\nb\nc\nd\ne" },
      { bio: 12 },
      { bio: ["a"] },
      { bio: true },
      { nickname: "Alex", bio: "b".repeat(201) },
      { nickname: "Alex", tag: 0 },
    ]) {
      expect(parseProfileEdit(body), JSON.stringify(body)).toEqual({ ok: false })
    }
  })

  it("refuses a body that holds nothing of a profile, and one that is not an object", () => {
    expect(parseProfileEdit({})).toEqual({ ok: false })
    expect(parseProfileEdit({ user_id: "someone-else", mood: "happy" })).toEqual({ ok: false })
    expect(parseProfileEdit({ nickname: undefined })).toEqual({ ok: false })
    for (const body of [null, undefined, "nickname", 42, true, [], [{ nickname: "Alex" }]]) expect(parseProfileEdit(body), String(body)).toEqual({ ok: false })
  })

  it("ignores a key it does not know: a client cannot say whose profile it is", () => {
    expect(parseProfileEdit({ nickname: "Alex", user_id: "someone-else", userId: "someone-else", hide_history: true })).toEqual({ ok: true, edit: { nickname: "Alex" } })
  })

  it("does not read what a prototype says: only the fields the body holds itself", () => {
    const body = Object.create({ nickname: "Inherited", bio: "Inherited" }) as Record<string, unknown>
    body.tag = 5
    expect(parseProfileEdit(body)).toEqual({ ok: true, edit: { tag: 5 } })
  })
})

describe("the city", () => {
  const row = { country: "FR", city_name: "Lyon", city_country: "FR" }

  it("is written with its country: Lyon, France", () => {
    expect(cityText({ name: "Lyon", country: "FR" })).toBe("Lyon, France")
    expect(cityText({ name: "Köln", country: "DE" })).toBe("Köln, Germany")
  })

  it("is read from the two columns of a row, in the country the profile says", () => {
    expect(detailsOf(row).city).toEqual({ name: "Lyon", country: "FR" })
    expect(hasProfileDetails({ ...noProfileDetails(), city: { name: "Lyon", country: "FR" } })).toBe(true)
  })

  it("is never drawn when it is not what the table keeps: another country than the profile's, no country, a part missing, a bad name", () => {
    expect(detailsOf({ ...row, country: "BE" }).city).toBeNull()
    expect(detailsOf({ ...row, country: null }).city).toBeNull()
    expect(detailsOf({ ...row, city_country: "fr" }).city).toBeNull()
    expect(detailsOf({ ...row, city_name: null }).city).toBeNull()
    expect(detailsOf({ ...row, city_name: "" }).city).toBeNull()
    expect(detailsOf({ ...row, city_name: "a".repeat(101) }).city).toBeNull()
    expect(detailsOf({ ...row, city_country: null }).city).toBeNull()
  })

  it("is asked for as a name and a country, cleaned as a profile keeps them", () => {
    expect(cityOfRequest({ name: "  Saint-Étienne ", country: "fr" })).toEqual({ name: "Saint-Étienne", country: "FR" })
    expect(cityOfRequest({ name: "Los\n  Angeles", country: "US" })).toEqual({ name: "Los Angeles", country: "US" })
    expect(parseProfileEdit({ city: { name: "Lyon", country: "fr" } })).toEqual({ ok: true, edit: { city: { name: "Lyon", country: "FR" } } })
    expect(parseProfileEdit({ city: null })).toEqual({ ok: true, edit: { city: null } })
    expect(parseProfileEdit({ country: "fr", city: { name: "Lyon", country: "FR" } })).toEqual({ ok: true, edit: { country: "FR", city: { name: "Lyon", country: "FR" } } })
  })

  it("is refused when it is not a name and a country and nothing else: the shape only, whether it exists is the server's to ask", () => {
    for (const city of [2996944, "Lyon", [], {}, { name: "Lyon" }, { country: "FR" }, { name: "", country: "FR" }, { name: "   ", country: "FR" }, { name: "a".repeat(101), country: "FR" }, { name: "Lyon", country: "ZZ" }, { name: "Lyon", country: "FRA" }, { name: 7, country: "FR" }, { name: "Lyon", country: 5 }, { name: "Lyon", country: "FR", id: 5 }, { name: "Lyon", country: "FR", region: "x" }, true]) {
      expect(parseProfileEdit({ city }), JSON.stringify(city)).toEqual({ ok: false })
    }
  })
})

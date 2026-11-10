import { describe, expect, it } from "vitest"
import { decode, parseSearch, parseThings } from "./xml.ts"

// The reader against the shape of a real answer of `thing?id=432&stats=1` (checked on 2026-11-10; the description, the polls and the links are left out, as are most of the names).

const TAKE_5 = `<?xml version="1.0" encoding="utf-8"?><items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"><item type="boardgame" id="432">
     <thumbnail>https://cf.geekdo-images.com/x/img/pic.jpg</thumbnail>
     <image>https://cf.geekdo-images.com/x/original/pic.jpg</image>
     <name type="primary" sortindex="1" value="Take 5" />
     <name type="alternate" sortindex="1" value="6 nimmt!" />
     <name type="alternate" sortindex="1" value="6 qui prend!" />
     <name type="alternate" sortindex="1" value="6 nimmt!" />
     <description>A card game.&#10;Pick up the cows.</description>
     <yearpublished value="1994" />
     <minplayers value="2" />
     <maxplayers value="10" />
     <poll name="suggested_numplayers" title="User Suggested Number of Players" totalvotes="3"><results numplayers="2"><result value="Best" numvotes="1" /></results></poll>
     <playingtime value="45" />
     <minplaytime value="30" />
     <maxplaytime value="45" />
     <minage value="8" />
     <link type="boardgamecategory" id="1002" value="Card Game" />
     <statistics page="1">
       <ratings >
         <usersrated value="33350" />
         <average value="6.98668" />
         <bayesaverage value="6.86026" />
         <ranks>
           <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="674" bayesaverage="6.86026" />
           <rank type="family" id="5499" name="familygames" friendlyname="Family Game Rank" value="201" bayesaverage="6.88076" />
         </ranks>
         <stddev value="1.27838" />
         <median value="0" />
         <owned value="51943" />
         <numweights value="1827" />
         <averageweight value="1.1877" />
       </ratings>
     </statistics>
</item></items>`

describe("parseThings", () => {
  it("reads the figures of an item, each from its own tag", () => {
    expect(parseThings(TAKE_5)).toEqual([
      {
        id: 432,
        type: "boardgame",
        name: "Take 5",
        names: ["Take 5", "6 nimmt!", "6 qui prend!"],
        year: 1994,
        minPlayers: 2,
        maxPlayers: 10,
        playingTime: 45,
        minAge: 8,
        weight: 1.1877,
        weights: 1827,
        rating: 6.98668,
        ratings: 33350,
        rank: 674,
      },
    ])
  })

  it("does not mistake the average weight for the average rating, nor the family rank for the rank of board games", () => {
    const [thing] = parseThings(TAKE_5)
    expect(thing?.rating).toBe(6.98668)
    expect(thing?.weight).toBe(1.1877)
    expect(thing?.rank).toBe(674)
  })

  it("knows 0 and what is not a number for no figure, and 'Not Ranked' for no rank", () => {
    const xml = `<items><item type="boardgame" id="9">
      <name type="primary" sortindex="1" value="Bare" />
      <yearpublished value="0" /><minplayers value="0" /><maxplayers value="0" /><playingtime value="0" /><minage value="0" />
      <statistics page="1"><ratings><usersrated value="0" /><average value="0" />
        <ranks><rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="Not Ranked" bayesaverage="Not Ranked" /></ranks>
        <numweights value="0" /><averageweight value="0" /></ratings></statistics></item></items>`
    expect(parseThings(xml)).toEqual([
      { id: 9, type: "boardgame", name: "Bare", names: ["Bare"], year: null, minPlayers: null, maxPlayers: null, playingTime: null, minAge: null, weight: null, weights: 0, rating: null, ratings: 0, rank: null },
    ])
  })

  it("reads the items in the order of the answer, each with its own type, and leaves out one with no id", () => {
    const xml = `<items><item type="boardgameexpansion" id="2"><name type="primary" value="Add-on" /></item><item type="boardgame"><name type="primary" value="No id" /></item><item type="rpgitem" id="3"/></items>`
    expect(parseThings(xml).map((thing) => [thing.id, thing.type, thing.name])).toEqual([
      [2, "boardgameexpansion", "Add-on"],
      [3, "rpgitem", null],
    ])
  })

  it("reads the names as text: entities undone, the primary one first, no empty name and no name twice", () => {
    const xml = `<items><item type="boardgame" id="5"><name type="alternate" value="Alt &amp; Co" /><name type="primary" value="L&#039;Ile &quot;X&quot;" /><name type="alternate" value="" /><name type="alternate" value="Alt &amp; Co" /></item></items>`
    expect(parseThings(xml)[0]).toMatchObject({ name: `L'Ile "X"`, names: [`L'Ile "X"`, "Alt & Co"] })
  })

  it("takes the first name when none is marked primary", () => {
    expect(parseThings(`<items><item type="boardgame" id="5"><name type="alternate" value="First" /><name type="alternate" value="Second" /></item></items>`)[0]?.name).toBe("First")
  })

  it("answers an empty list for an answer with no item, or no XML at all", () => {
    expect(parseThings(`<items termsofuse="x"></items>`)).toEqual([])
    expect(parseThings("")).toEqual([])
    expect(parseThings("Rate limit exceeded")).toEqual([])
  })
})

describe("parseSearch", () => {
  it("reads the id, the primary name and the year of each result", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><items total="2" termsofuse="x"><item type="boardgame" id="3955"><name type="primary" value="BANG!" /><yearpublished value="2002" /></item><item type="boardgame" id="32806"><name type="primary" value="Bang!" /></item></items>`
    expect(parseSearch(xml)).toEqual([
      { id: 3955, name: "BANG!", year: 2002 },
      { id: 32806, name: "Bang!", year: null },
    ])
  })

  it("leaves out a result with no name or no id, and answers an empty list for none", () => {
    expect(parseSearch(`<items total="0"></items>`)).toEqual([])
    expect(parseSearch(`<items><item type="boardgame" id="1"></item><item type="boardgame"><name type="primary" value="X" /></item></items>`)).toEqual([])
  })
})

describe("decode", () => {
  it("undoes the entities of XML, named and numeric", () => {
    expect(decode("a &amp; b &lt;c&gt; &quot;d&quot; &#039;e&#039; &#x26; &apos;f&apos;")).toBe(`a & b <c> "d" 'e' & 'f'`)
  })

  it("leaves an entity it does not know as it is", () => {
    expect(decode("a &unknown; b")).toBe("a &unknown; b")
  })
})

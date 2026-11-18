// The two phrases that a game's page is found by. They live in a file of their own, with no import, so that `pnpm check:production` (run by Node itself, which cannot load `seo.ts`: its imports have no
// extension) says exactly the words that the page says: `seo.ts` re-exports them and builds the page's title and description from them, and the checks of production read them from here.

/** The phrase that a game's page is found by, "Play Courtisans Online": its title in search results and its heading. */
export const playTitle = (name: string) => `Play ${name} Online`

/**
 * The sentence that opens the description of a game's page in search results and on social cards: it starts with the phrase, "Play Courtisans
 * online". A game that is not live cannot be played yet, and its description says it is coming soon, so that a search result never promises a
 * table that is not there (the line of the page itself, `playLine`, is the same for every game: the page says the rest).
 */
export const playLead = ({ name, live }: { name: string; live: boolean }) => (live ? `Play ${name} online with friends or rivals.` : `Play ${name} online, coming soon.`)

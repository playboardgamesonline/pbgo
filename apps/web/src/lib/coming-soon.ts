/**
 * What the platform says where a list has nothing to show yet: the page of the tab, the section of the home and the home's search when it
 * looks through tables or tournaments. One place, so the three say the same. Tables are private for now (a table is joined with its code
 * or its link): the list of the open ones is PLT-21, the tournaments are PLT-31, the release notes PLT-20. About has no text yet: it says what the site is, in a line, and What's New is a section of that page. Pricing is not here any more: it shows its three plans (`lib/plans.ts`).
 */
export const COMING_SOON = {
  tables: {
    heading: "No table to join yet",
    description: "Tables are private for now: open one from a game and share its link. The tables open to everyone will be listed here.",
  },
  tournaments: {
    heading: "No tournament yet",
    description: "Brackets between friends, and public ones, are on their way. The tournaments in progress will be listed here.",
  },
  whatsNew: {
    heading: "Nothing to read yet",
    description: "The new games and the notes of each release will be posted here.",
  },
  about: {
    heading: "The story is being written",
    description: "Play Board Games Online lets you play board games in your browser, with no sign-up. The page about who makes it, and why, will be here soon.",
  },
} as const

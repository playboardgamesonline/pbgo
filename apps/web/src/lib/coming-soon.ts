/**
 * What the platform says where a list has nothing to show yet: the page of the tab, the section of the home and the home's search when it
 * looks through tables or tournaments. One place, so the three say the same. Tables are private for now (a table is joined with its code
 * or its link): the list of the open ones is PLT-21, the tournaments are PLT-31, the release notes PLT-20.
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
} as const

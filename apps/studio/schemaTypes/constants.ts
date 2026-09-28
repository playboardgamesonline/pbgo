export const LANGUAGES = [
  { id: "fr", title: "French" },
  { id: "en", title: "English" },
] as const

export const FAMILIES = [
  { title: "Butterfly", value: "papillon", slug: "butterfly" },
  { title: "Toad", value: "crapaud", slug: "toad" },
  { title: "Nightingale", value: "rossignol", slug: "nightingale" },
  { title: "Hare", value: "lievre", slug: "hare" },
  { title: "Stag", value: "cerf", slug: "stag" },
  { title: "Carp", value: "carpe", slug: "carp" },
]

export const ROLES = [
  { title: "Noble", value: "noble", slug: "noble" },
  { title: "Spy", value: "espion", slug: "spy" },
  { title: "Assassin", value: "assassin", slug: "assassin" },
  { title: "Guard", value: "garde", slug: "guard" },
]

export const STATUSES = [
  { title: "In the light", value: "lumiere" },
  { title: "In disgrace", value: "disgrace" },
  { title: "Neutral", value: "neutre" },
]

export const titleOf = (list: { title: string; value: string }[], value: unknown) => list.find((i) => i.value === value)?.title

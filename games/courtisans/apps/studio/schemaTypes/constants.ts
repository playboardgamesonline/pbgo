export const FAMILIES = [
  { title: "Butterfly", value: "butterfly", slug: "butterfly" },
  { title: "Toad", value: "toad", slug: "toad" },
  { title: "Nightingale", value: "nightingale", slug: "nightingale" },
  { title: "Hare", value: "hare", slug: "hare" },
  { title: "Stag", value: "stag", slug: "stag" },
  { title: "Carp", value: "carp", slug: "carp" },
]

export const ROLES = [
  { title: "Noble", value: "noble", slug: "noble" },
  { title: "Spy", value: "spy", slug: "spy" },
  { title: "Assassin", value: "assassin", slug: "assassin" },
  { title: "Guard", value: "guard", slug: "guard" },
]

export const STATUSES = [
  { title: "In the light", value: "light" },
  { title: "In disgrace", value: "disgrace" },
  { title: "Neutral", value: "neutral" },
]

export const titleOf = (list: { title: string; value: string }[], value: unknown) => list.find((i) => i.value === value)?.title

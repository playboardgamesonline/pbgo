import type { OptionDefinitions } from "@pbgo/engine-kit"

/**
 * The options of a table. Texts are player-facing, in French (like the rest of the lobby).
 *
 * `fiveDifferent` is a plain `parameter`, not an `extension`: the kit's extensions are always off by default, and this rule is
 * part of the official Original rules, so it is on unless the table turns it off.
 *
 * `fasterGame` is declared before `classicDeal`: when a table asks for both, the first one wins (see `conflictsWith` in the kit).
 */
export const OPTIONS: OptionDefinitions = {
  fiveDifferent: {
    type: "boolean",
    defaultValue: true,
    label: "Cinq cartes différentes",
    help: "Cinq cartes de titres différents jouées ensemble permettent de prendre une carte de la défausse (jamais un Chaton explosif).",
    group: "parameter",
  },
  fasterGame: {
    type: "boolean",
    defaultValue: false,
    label: "Partie rapide",
    help: "Un tiers de la pioche est retiré au hasard avant de glisser les Chatons explosifs : une partie plus courte. À 2 ou 3 joueurs.",
    group: "parameter",
    players: { max: 3 },
    conflictsWith: ["classicDeal"],
  },
  classicDeal: {
    type: "boolean",
    defaultValue: false,
    label: "Distribution classique",
    help: "Chacun reçoit un Désamorçage et 4 cartes, au lieu de 7, et tous les Désamorçages restants rejoignent la pioche.",
    group: "parameter",
  },
}

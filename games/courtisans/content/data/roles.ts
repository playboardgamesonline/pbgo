import { localeString, localeText } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"

export const ROLE_KEYS = ["noble", "spy", "assassin", "guard"] as const
export type RoleKey = (typeof ROLE_KEYS)[number]

type RoleSpec = { name: Localized; rule: Localized }

// The source names and rules of the roles, as the game wrote them before its texts moved to Sanity; the drafts are made from them.
const SPECS: Record<RoleKey, RoleSpec> = {
  noble: {
    name: { fr: "Noble", en: "Noble", es: "Noble", de: "Adliger" },
    rule: {
      fr: "En fin de partie, un noble vaut 2 cartes, aussi bien dans le domaine d'un joueur qu'à la table de la reine.",
      en: "At the end of the game, a noble counts as 2 cards, both in a player's domain and at the Queen's table.",
      es: "Al final de la partida, un noble vale por 2 cartas, tanto en el dominio de un jugador como en la mesa de la reina.",
      de: "Am Ende der Partie zählt ein Adliger als 2 Karten, sowohl im Herrschaftsbereich eines Spielers als auch an der Tafel der Königin.",
    },
  },
  spy: {
    name: { fr: "Espion", en: "Spy", es: "Espía", de: "Spion" },
    rule: {
      fr: "Un espion se pose toujours face cachée. Une fois joué, plus personne ne peut le regarder, pas même le joueur qui l'a posé.\n\nÀ la table de la reine, il va dans la colonne de la reine, au centre du tapis, au-dessus ou au-dessous : sa famille reste ainsi secrète.",
      en: "A spy is always played face down. Once played, nobody can look at it anymore, not even the player who placed it.\n\nAt the Queen's table, it goes in the Queen's column, in the center of the mat, above or below: its family thus remains secret.",
      es: "Un espía se coloca siempre boca abajo. Una vez jugado, nadie puede mirarlo, ni siquiera el jugador que lo colocó.\n\nEn la mesa de la reina, va a la columna de la reina, en el centro del tapete, por encima o por debajo: así su familia permanece en secreto.",
      de: "Ein Spion wird immer verdeckt gespielt. Einmal gespielt, kann ihn niemand mehr ansehen, nicht einmal der Spieler, der ihn gelegt hat.\n\nAn der Tafel der Königin kommt er in die Spalte der Königin in der Mitte der Matte, oberhalb oder unterhalb: So bleibt seine Familie geheim.",
    },
  },
  assassin: {
    name: { fr: "Assassin", en: "Assassin", es: "Asesino", de: "Attentäter" },
    rule: {
      fr: "Quand vous posez un assassin, vous pouvez éliminer une autre carte Courtisan de la même zone, à la table de la reine comme dans un domaine. La carte éliminée est retirée du jeu pour de bon.\n\nÀ la table de la reine, vous pouvez viser n'importe quelle carte de la zone, peu importe sa famille ou sa position, espions compris (sans les regarder). L'effet est facultatif.",
      en: "When you play an assassin, you may eliminate another Courtier card in the same zone, at the Queen's table as well as in a domain. The eliminated card is removed from the game for good.\n\nAt the Queen's table, you can target any card in the zone, whatever its family or position, spies included (without looking at them). The effect is optional.",
      es: "Cuando colocas un asesino, puedes eliminar otra carta de Cortesano de la misma zona, tanto en la mesa de la reina como en un dominio. La carta eliminada sale del juego definitivamente.\n\nEn la mesa de la reina, puedes apuntar a cualquier carta de la zona, sea cual sea su familia o posición, espías incluidos (sin mirarlos). El efecto es opcional.",
      de: "Wenn du einen Attentäter legst, darfst du eine andere Höflingskarte derselben Zone eliminieren, an der Tafel der Königin ebenso wie in einem Herrschaftsbereich. Die eliminierte Karte wird endgültig aus dem Spiel genommen.\n\nAn der Tafel der Königin kannst du jede Karte der Zone anvisieren, unabhängig von Familie oder Position, Spione eingeschlossen (ohne sie anzusehen). Der Effekt ist freiwillig.",
    },
  },
  guard: {
    name: { fr: "Garde", en: "Guard", es: "Guardia", de: "Wache" },
    rule: {
      fr: "Un garde ne peut pas être éliminé par un assassin : il reste donc toujours en jeu.",
      en: "A guard cannot be eliminated by an assassin: it always stays in play.",
      es: "Un guardia no puede ser eliminado por un asesino: siempre permanece en juego.",
      de: "Eine Wache kann von einem Attentäter nicht eliminiert werden: Sie bleibt immer im Spiel.",
    },
  },
}

export const roleId = (key: RoleKey) => `role-${key}`

/**
 * The names and the rule texts of the four roles. The documents already exist in the Studio (key, count per family, pictograms):
 * only `name` and `rule` are seeded. The French rule already in the Studio is worded differently from the code's, so it is kept as it is.
 */
export function buildRoles(): SeedDoc[] {
  return ROLE_KEYS.map((key) => {
    const spec = SPECS[key]
    return { _id: roleId(key), _type: "role", name: localeString(spec.name), rule: localeText(spec.rule) }
  })
}

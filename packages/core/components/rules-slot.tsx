"use client"

import * as bindingUi from "@pbgo/binding-ui"
import type { RulesContent } from "../lib/rules"
import { RulesButton } from "./rules"

type RulesButtonComponent = (props: { rules: RulesContent; className?: string }) => React.ReactNode

/** Bouton des règles : celui du jeu s'il en exporte un (`RulesButton` de @pbgo/binding-ui), sinon la fenêtre à onglets commune. */
export function GameRulesButton(props: { rules: RulesContent; className?: string }) {
  const Custom = (bindingUi as unknown as { RulesButton?: RulesButtonComponent }).RulesButton
  return Custom ? <Custom {...props} /> : <RulesButton {...props} />
}

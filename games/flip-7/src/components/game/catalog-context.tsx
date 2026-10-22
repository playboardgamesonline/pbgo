"use client"

import { createContext, useContext } from "react"
import { type ClientCatalog, MISSING_CATALOG, type Vocabulary } from "../../lib/catalog"

const CatalogContext = createContext<ClientCatalog>(MISSING_CATALOG)

/** The catalog the server loaded (faces, table, words), for every component of the board. */
export const CatalogProvider = CatalogContext.Provider

export const useCatalog = () => useContext(CatalogContext)

/** The words of the board in the visitor's language: each one is a text of the game's Sanity project, `[missing: <key>]` when it is not there. */
export const useWords = (): Vocabulary => useContext(CatalogContext).words

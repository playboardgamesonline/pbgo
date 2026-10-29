/**
 * The games of the list of friends that the visitor has folded (`FriendsRoster`: the key of a group, `game:<slug>`), kept in their browser: it is a thing of the visitor's, nothing that
 * another device or the server needs. Read once as the panel is mounted (the navbar draws it in the browser, once the session is read), written when a game is folded or unfolded; a browser
 * that keeps nothing, or keeps something else, has none folded.
 */
const KEY = "pbgo:folded-games"

export function readFolded(): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]")
    return new Set(Array.isArray(stored) ? stored.filter((key): key is string => typeof key === "string") : [])
  } catch {
    return new Set()
  }
}

export function writeFolded(folded: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...folded]))
  } catch {
    // Private mode, or no room: the games stay folded for as long as the page is open
  }
}

// What a board is built on, read from the source: which pieces of `@pbgo/table` a game's board reaches, and what it draws with three.js itself. The one definition: `pnpm check:game` judges a board with
// it, `pnpm check:kit` prints it and a test keeps the boards on the kit, so that none of them can disagree. It reads files and nothing else (no build, no network), and is made of what Node strips as it
// is (type stripping), like `slug.ts` and `scout.ts`. A kit piece is *reached* by a board when the board's code, followed through its imports (the ones that run: a type that is imported is erased), loads
// the file that holds it: an edit of that file changes the board, and an edit of one that is not reached cannot.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import ts from "typescript"

/** Where the shared table lives, from the root of the repository. */
export const KIT_DIR = "packages/table/src"
/** The name a game imports it by. */
export const KIT_PACKAGE = "@pbgo/table"
/** Where a game keeps its board, from the game's own folder: `@pbgo/table` and three.js are imported there only. */
export const BOARD_DIR = "src/components/board"

/** The packages that draw the scene: what a board takes from them it writes itself, instead of taking it from the kit. */
const SCENE_PACKAGES = ["@react-three/fiber", "@react-three/drei"]

/** The lower-case elements that are the page's (HTML and SVG), not the scene's: what is left of the lower-case ones in a board is three.js (`mesh`, `planeGeometry`, `group`). */
const PAGE_ELEMENTS = new Set(
  (
    "a abbr article aside audio b blockquote br button canvas caption circle clipPath code dd defs desc details dialog div dl dt ellipse em fieldset figcaption figure filter footer foreignObject form " +
    "g h1 h2 h3 h4 h5 h6 header hr i iframe img input kbd label legend li linearGradient main mark mask nav ol optgroup option p path pattern picture polygon polyline pre progress radialGradient rect " +
    "section select small span stop strong sub summary sup svg table tbody td text textarea tfoot th thead title tr tspan u ul use video"
  ).split(" "),
)

/** What a module does when it runs, as far as a board is concerned. */
export type ModuleReading = {
  /** The modules it loads, with the names it takes from each (`*` for a whole module or a dynamic import): a type that is imported is erased and not listed */
  imports: { from: string; names: string[] }[]
  /** The modules it re-exports from (a barrel), with the names it gives out under: `*` for `export *` */
  exports: { from: string; names: string[] }[]
  /** The lower-case elements of its JSX that are not the page's: `group`, `mesh`, `planeGeometry` */
  elements: string[]
}

/** Reads one module, with the TypeScript parser: no pattern over the text, so a word in a comment or a string is never an import. */
export function readModule(file: string, text = readFileSync(file, "utf8")): ModuleReading {
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const imports: ModuleReading["imports"] = []
  const exports: ModuleReading["exports"] = []
  const elements = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      if (!clause?.isTypeOnly) {
        const names: string[] = []
        if (clause?.name) names.push("default")
        const bindings = clause?.namedBindings
        if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) if (!element.isTypeOnly) names.push((element.propertyName ?? element.name).text)
        if (bindings && ts.isNamespaceImport(bindings)) names.push("*")
        imports.push({ from: node.moduleSpecifier.text, names })
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) {
        const clause = node.exportClause
        const names = clause && ts.isNamedExports(clause) ? clause.elements.filter((element) => !element.isTypeOnly).map((element) => element.name.text) : ["*"]
        exports.push({ from: node.moduleSpecifier.text, names })
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments
      if (argument && ts.isStringLiteral(argument)) imports.push({ from: argument.text, names: ["*"] })
    } else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName
      if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text) && !PAGE_ELEMENTS.has(tag.text)) elements.add(tag.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return { imports, exports, elements: [...elements].sort() }
}

const FILE_ENDINGS = [".ts", ".tsx", ".mts", ".js", ".jsx"]
const isFile = (path: string) => existsSync(path) && statSync(path).isFile()

/** The file a relative specifier of a module names, or null when it is not a relative one or no file of code answers it. */
export function resolveModule(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null
  const base = join(dirname(from), specifier)
  for (const ending of ["", ...FILE_ENDINGS]) if (isFile(base + ending)) return base + ending
  for (const ending of FILE_ENDINGS) if (isFile(join(base, `index${ending}`))) return join(base, `index${ending}`)
  return null
}

/** Every file of code under a folder (no test, no build), as absolute paths. */
export function codeFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", "dist", ".sanity"].includes(name)) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? codeFiles(path) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const posix = (repo: string, path: string) => relative(repo, path).split(sep).join("/")

/** The reader of one analysis: each file is parsed once, however many boards reach it. */
function reader() {
  const cache = new Map<string, ModuleReading>()
  return (file: string) => {
    let reading = cache.get(file)
    if (!reading) cache.set(file, (reading = readModule(file)))
    return reading
  }
}

/** The files a set of seeds loads, through relative imports that `keep` lets by. */
function closure(seeds: string[], read: (file: string) => ModuleReading, keep: (file: string) => boolean): Set<string> {
  const seen = new Set<string>()
  const queue = [...seeds]
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue
    seen.add(file)
    const { imports, exports } = read(file)
    for (const { from } of [...imports, ...exports]) {
      const next = resolveModule(file, from)
      if (next && keep(next) && !seen.has(next)) queue.push(next)
    }
  }
  return seen
}

/** What `@pbgo/table` gives out, by name: the file that holds each. The index is a list of `export { … } from` lines; `export *` would hide which file an edit reaches, so it is refused. */
export function kitExports(repo: string, read: (file: string) => ModuleReading = reader()): Map<string, string> {
  const index = join(repo, KIT_DIR, "index.ts")
  const names = new Map<string, string>()
  for (const { from, names: given } of read(index).exports) {
    if (given.includes("*")) throw new Error(`${KIT_DIR}/index.ts has \`export * from "${from}"\`: list the names, so that a board's import says which file it reaches`)
    const file = resolveModule(index, from)
    if (!file) throw new Error(`${KIT_DIR}/index.ts exports from "${from}", which is no file`)
    for (const name of given) names.set(name, file)
  }
  return names
}

/** Every file of the kit that holds code, from the root of the repository. */
export function kitFiles(repo: string): string[] {
  return codeFiles(join(repo, KIT_DIR))
    .map((file) => posix(repo, file))
    .sort()
}

/** A game's board as it stands: what it takes from the kit, what of the kit that reaches, and the three.js it writes itself. */
export type BoardReading = {
  slug: string
  /** The files of the board's folder, from the root of the repository */
  files: string[]
  /** The names it takes from `@pbgo/table` */
  names: string[]
  /** The files of the kit its code loads, directly or through the kit's own imports, from the root of the repository */
  kit: string[]
  /** The scene's elements it writes (`mesh`, `planeGeometry`: not `group`, which draws nothing) */
  elements: string[]
  /** What it takes from react-three-fiber and drei: `useFrame`, `useThree`, `useCursor` */
  hooks: string[]
}

/** The folder of a game, from the root: the template is a game that sits beside the others. */
export const gameDir = (slug: string) => (slug === "template" ? "template" : `games/${slug}`)

/** A game's board, or null when the game has none yet. The files read: its board's folder, and what that loads of the game's own `src`. */
export function readBoard(repo: string, slug: string, read: (file: string) => ModuleReading = reader(), exported?: Map<string, string>): BoardReading | null {
  const dir = join(repo, gameDir(slug))
  const board = codeFiles(join(dir, BOARD_DIR))
  if (board.length === 0) return null
  const given = exported ?? kitExports(repo, read)
  const own = closure(board, read, (file) => file.startsWith(join(dir, "src") + sep))
  const names = new Set<string>()
  const elements = new Set<string>()
  const hooks = new Set<string>()
  for (const file of own) {
    const reading = read(file)
    for (const element of reading.elements) if (element !== "group") elements.add(element)
    for (const { from, names: taken } of reading.imports) {
      if (from === KIT_PACKAGE) for (const name of taken) names.add(name)
      if (SCENE_PACKAGES.includes(from)) for (const name of taken) hooks.add(name)
    }
  }
  const seeds = [...names].flatMap((name) => given.get(name) ?? [])
  const kit = closure(seeds, read, (file) => file.startsWith(join(repo, KIT_DIR) + sep))
  return {
    slug,
    files: board.map((file) => posix(repo, file)).sort(),
    names: [...names].sort(),
    kit: [...kit].map((file) => posix(repo, file)).sort(),
    elements: [...elements].sort(),
    hooks: [...hooks].sort(),
  }
}

/** Several boards at once, sharing the reading of the kit. A game with no board is left out. */
export function readBoards(repo: string, slugs: string[]): BoardReading[] {
  const read = reader()
  const exported = kitExports(repo, read)
  return slugs.flatMap((slug) => readBoard(repo, slug, read, exported) ?? [])
}

/** The boards that an edit of a file of the kit reaches. */
export const reachedBy = (boards: BoardReading[], file: string) => boards.filter((board) => board.kit.includes(file)).map((board) => board.slug)

/** The files of the kit that every one of these boards reaches: what a change there changes in all of them. */
export const sharedByAll = (boards: BoardReading[]) => (boards.length === 0 ? [] : boards.slice(1).reduce((shared, board) => shared.filter((file) => board.kit.includes(file)), boards[0]!.kit))

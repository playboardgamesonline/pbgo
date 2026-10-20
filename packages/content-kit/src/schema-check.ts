// A small checker of documents against the definitions of a Sanity schema (what `defineType` and `defineField` return).
// It knows the kinds of field, the option lists and the validation rules the types of a game use, and it throws on a
// rule it does not know rather than skipping it, so that a new kind of rule cannot slip through unchecked.

type Shape = {
  type: string
  description?: unknown
  fields?: FieldDef[]
  of?: MemberDef[]
  options?: { list?: unknown[] }
  validation?: unknown
}

/** A tab of a document form (a Sanity group). */
export type GroupDef = { name: string; title?: string; default?: boolean }

/** A field, as `defineField` returns it. `group` is the tab(s) of the document form it appears in. */
export type FieldDef = Shape & { name: string; group?: string | string[] }

/** An array member, as `defineArrayMember` returns it. */
export type MemberDef = Shape & { name?: string }

/** A registered type: a document, or a reusable object such as `localeString`. A document lists its tabs in `groups`. */
export type TypeDef = Shape & { name: string; groups?: GroupDef[] }

export type Types = ReadonlyMap<string, TypeDef>

/** The fields Sanity adds to every document. */
const SYSTEM_FIELDS = new Set(["_id", "_type", "_rev", "_createdAt", "_updatedAt"])

/** The schemes a `url` field accepts when it has no rule of its own. */
const URL_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"]

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const show = (value: unknown) => {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 48 ? `${text.slice(0, 45)}…` : text
}

type Constraint = { name: string; args: unknown[]; blocking: boolean }

/** The rules a `validation` states: its function (or each function of its array) is handed a Rule that records the calls made on it. */
export function constraintsOf(validation: unknown): Constraint[] {
  const constraints: Constraint[] = []
  const rule: unknown = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          const last = constraints.at(-1)
          // `.warning()` and `.info()` soften the rule they follow; `.error()` is what every rule is by default
          if ((name === "warning" || name === "info") && last) last.blocking = false
          else if (name !== "warning" && name !== "info" && name !== "error") constraints.push({ name: String(name), args, blocking: true })
          return rule
        },
    },
  )
  const validators = Array.isArray(validation) ? validation : validation ? [validation] : []
  for (const validator of validators) if (typeof validator === "function") validator(rule)
  return constraints
}

const sizeOf = (value: unknown) => (typeof value === "string" || Array.isArray(value) ? value.length : Number.NaN)

/** Why a rule refuses a value that is there, or nothing when it accepts it. */
function refusal(name: string, args: unknown[], value: unknown): string | undefined {
  switch (name) {
    case "regex": {
      const [pattern, options] = args
      if (!(pattern instanceof RegExp)) throw new Error("regex() needs a pattern")
      const matches = typeof value === "string" && pattern.test(value)
      const invert = isObject(options) && options.invert === true
      return matches !== invert ? undefined : `does not match ${pattern} (got ${show(value)})`
    }
    case "length":
      return sizeOf(value) === args[0] ? undefined : `must be ${args[0]} long (got ${show(value)})`
    case "min": {
      const measure = typeof value === "number" ? value : sizeOf(value)
      return measure >= (args[0] as number) ? undefined : `must be at least ${args[0]} (got ${show(value)})`
    }
    case "max": {
      const measure = typeof value === "number" ? value : sizeOf(value)
      return measure <= (args[0] as number) ? undefined : `must be at most ${args[0]} (got ${show(value)})`
    }
    case "integer":
      return Number.isInteger(value) ? undefined : `must be an integer (got ${show(value)})`
    default:
      throw new Error(`The validation rule ${name}() is not emulated by schema-check.ts: add it there before a field the seed writes uses it`)
  }
}

/** The problems of a value against the rules of its field. An empty string counts as no value, as in a Studio form. */
function ruleProblems(value: unknown, constraints: Constraint[], path: string): string[] {
  const absent = value === undefined || value === null || value === ""
  const problems: string[] = []
  for (const { name, args, blocking } of constraints) {
    if (name === "required") {
      if (absent && blocking) problems.push(`${path} is required`)
    } else if (!absent) {
      const reason = refusal(name, args, value)
      if (reason && blocking) problems.push(`${path} ${reason}`)
    }
  }
  return problems
}

/**
 * The problems of a value against its definition (a field, an array member or a registered type):
 * the kind of value, the keys of an object, the type and key of each array item, the option list and the rules.
 * `expectedType` is the `_type` an array member's value must carry.
 */
export function problemsOf(value: unknown, def: Shape & { name?: string }, path: string, types: Types, expectedType?: string): string[] {
  const constraints = constraintsOf(def.validation)
  if (value === undefined || value === null) return ruleProblems(value, constraints, path)

  const registered = types.get(def.type)
  const kind = registered?.type ?? def.type
  const problems: string[] = []

  switch (kind) {
    case "string":
    case "text":
      if (typeof value !== "string") return [`${path} should be a ${kind}, got ${show(value)}`]
      break
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return [`${path} should be a number, got ${show(value)}`]
      break
    case "boolean":
      if (typeof value !== "boolean") return [`${path} should be a boolean, got ${show(value)}`]
      break
    case "url": {
      const protocol = typeof value === "string" ? URL.parse(value)?.protocol : undefined
      if (!protocol || !URL_PROTOCOLS.includes(protocol)) return [`${path} should be a URL (${URL_PROTOCOLS.join(" ")}), got ${show(value)}`]
      break
    }
    case "image": {
      const asset = isObject(value) ? value.asset : undefined
      const reference = isObject(asset) && asset._type === "reference" && typeof asset._ref === "string" && /^image-.+-\d+x\d+-[a-z0-9]+$/.test(asset._ref)
      if (!isObject(value) || value._type !== "image" || !reference) return [`${path} should be an image that references an asset, got ${show(value)}`]
      break
    }
    case "file": {
      const asset = isObject(value) ? value.asset : undefined
      const reference = isObject(asset) && asset._type === "reference" && typeof asset._ref === "string" && /^file-.+-[a-z0-9]+$/.test(asset._ref)
      if (!isObject(value) || value._type !== "file" || !reference) return [`${path} should be a file that references an asset, got ${show(value)}`]
      break
    }
    case "object": {
      if (!isObject(value)) return [`${path} should be an object, got ${show(value)}`]
      const fields = def.fields ?? registered?.fields ?? []
      const wanted = registered?.name ?? expectedType
      if (wanted !== undefined && value._type !== wanted) problems.push(`${path}._type is ${show(value._type)}, expected "${wanted}"`)
      for (const key of Object.keys(value)) {
        if (key !== "_type" && key !== "_key" && !fields.some((field) => field.name === key)) problems.push(`${path}.${key} is not a field`)
      }
      for (const field of fields) problems.push(...problemsOf(value[field.name], field, `${path}.${field.name}`, types))
      break
    }
    case "array": {
      if (!Array.isArray(value)) return [`${path} should be an array, got ${show(value)}`]
      const members = def.of ?? registered?.of ?? []
      const keys = new Set<string>()
      value.forEach((item, index) => {
        const at = `${path}[${index}]`
        if (!isObject(item)) {
          if (!members.some((member) => problemsOf(item, member, at, types).length === 0)) problems.push(`${at} is ${show(item)}, which no member of the array accepts`)
          return
        }
        if (typeof item._key !== "string" || item._key === "") problems.push(`${at} has no _key`)
        else if (keys.has(item._key)) problems.push(`${at} repeats the _key "${item._key}"`)
        else keys.add(item._key)
        const member = members.find((candidate) => (candidate.name ?? candidate.type) === item._type)
        if (member) problems.push(...problemsOf(item, member, at, types, member.name ?? member.type))
        else problems.push(`${at} has the type ${show(item._type)}, which the array does not accept (${members.map((candidate) => candidate.name ?? candidate.type).join(", ")})`)
      })
      break
    }
    default:
      return [`${path} has the type "${kind}", which schema-check.ts does not know`]
  }

  // the list of a field is a closed set of values, which the Studio enforces
  const list = def.options?.list
  if (Array.isArray(list)) {
    const allowed = list.map((entry) => (isObject(entry) && "value" in entry ? entry.value : entry))
    if (!allowed.includes(value)) problems.push(`${path} is ${show(value)}, not one of ${allowed.map(show).join(", ")}`)
  }
  return [...ruleProblems(value, constraints, path), ...problems]
}

/** The problems of a document against its type: every key must be a field, and every field must satisfy its definition. */
export function documentProblems(doc: Record<string, unknown>, types: Types): string[] {
  const name = String(doc._id ?? "(no id)")
  const type = types.get(String(doc._type))
  if (!type || type.type !== "document") return [`${name}: "${String(doc._type)}" is not a document type of the schema`]
  const fields = type.fields ?? []
  const problems: string[] = []
  for (const key of Object.keys(doc)) {
    if (!SYSTEM_FIELDS.has(key) && !fields.some((field) => field.name === key)) problems.push(`${name}.${key} is not a field of "${type.name}"`)
  }
  for (const field of fields) problems.push(...problemsOf(doc[field.name], field, `${name}.${field.name}`, types))
  return problems
}

/**
 * The fields a value leaves out, images and files apart (the art step brings the images, the rulebook step the PDFs): a field the
 * Studio form shows and the seed forgot. Pass a document with its type, or a field with the value it holds.
 */
export function emptyFields(value: unknown, def: Shape, path: string, types: Types): string[] {
  const registered = types.get(def.type)
  const kind = registered?.type ?? def.type
  if (kind === "image" || kind === "file") return []
  if (value === undefined || value === null) return [path]
  if ((kind === "object" || kind === "document") && isObject(value)) {
    const fields = def.fields ?? registered?.fields ?? []
    return fields.flatMap((field) => emptyFields(value[field.name], field, `${path}.${field.name}`, types))
  }
  if (kind === "array" && Array.isArray(value)) {
    const members = def.of ?? registered?.of ?? []
    return value.flatMap((item, index) => {
      const member = isObject(item) ? members.find((candidate) => (candidate.name ?? candidate.type) === item._type) : undefined
      return member ? emptyFields(item, member, `${path}[${index}]`, types) : []
    })
  }
  return []
}

/** Every image field of a document type, written `type.field` and `type.list[].field`. */
export function imageFields(typeName: string, types: Types): string[] {
  const root = types.get(typeName)
  if (!root) throw new Error(`The schema has no type "${typeName}"`)
  const walk = (def: Shape, path: string): string[] => {
    const registered = types.get(def.type)
    const kind = registered?.type ?? def.type
    if (kind === "image") return [path]
    if (kind === "object") return (def.fields ?? registered?.fields ?? []).flatMap((field) => walk(field, `${path}.${field.name}`))
    if (kind === "array") return (def.of ?? registered?.of ?? []).flatMap((member) => walk(member, `${path}[]`))
    return []
  }
  return (root.fields ?? []).flatMap((field) => walk(field, `${typeName}.${field.name}`))
}

/** An image path of a document (`$.valueGlyphs[3].glyph`) written like the image fields of its type (`game.valueGlyphs[].glyph`). */
export const imageFieldOf = (typeName: string, path: string) => `${typeName}${path.replace(/^\$/, "").replace(/\[\d+\]/g, "[]")}`

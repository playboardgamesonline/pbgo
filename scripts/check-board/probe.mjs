// The code that runs inside the page. Each function here is sent to the browser as its source text (`Function.prototype.toString`), so it may use nothing from this module: no import, no helper of the file, only what the page has.
//
// How it sees a three.js board without help from the game: three.js tells `globalThis.__THREE_DEVTOOLS__`, when there is one, about every renderer and scene it makes. `installProbe` runs before the page's own scripts
// (`Page.addScriptToEvaluateOnNewDocument`), keeps those, and wraps `renderer.render` to learn which scene and camera are drawn. From the camera it projects a point of the table to a pixel; from the scene it lists what the
// board offers to press (every object that react-three-fiber gave a click handler: `object.__r3f.handlers`) and asks react-three-fiber's own raycaster what a pointer at a pixel would reach.

/** Installed in every new document, before any script of the page */
export function installProbe() {
  if (globalThis.__pbgoCheck) return
  const probe = {
    frames: 0,
    renders: new Map(),
    /** The scene that is drawn the most, among those drawn in the last seconds: the table's (the share photo or a debug overlay may have a scene of their own) */
    main() {
      const now = performance.now()
      let best = null
      for (const entry of probe.renders.values()) if (now - entry.last < 3000 && (!best || entry.count > best.count)) best = entry
      return best
    },
  }
  globalThis.__pbgoCheck = probe
  const hook = new EventTarget()
  hook.addEventListener("observe", (event) => {
    const renderer = event.detail
    if (!renderer || renderer.isWebGLRenderer !== true || renderer.__pbgoCheck) return
    renderer.__pbgoCheck = true
    const render = renderer.render
    renderer.render = (...args) => {
      const [scene, camera] = args
      probe.frames += 1
      const entry = probe.renders.get(scene) ?? { scene, camera, renderer, count: 0, last: 0 }
      entry.camera = camera
      entry.count += 1
      entry.last = performance.now()
      probe.renders.set(scene, entry)
      return render.apply(renderer, args)
    }
  })
  globalThis.__THREE_DEVTOOLS__ = hook
}

/** Whether the board has drawn: a canvas of a size worth the name, and a scene drawn */
export function boardDrawn() {
  const canvas = document.querySelector("canvas")
  const probe = globalThis.__pbgoCheck
  return { canvas: !!canvas && canvas.width > 300, scene: !!(probe && probe.main()) }
}

/**
 * Whether the board is in view: a press somewhere in the window reaches the canvas. The platform's loading and start screens cover the whole window, so while one lies over the board no point does; a cookie banner or a box of the HUD
 * covers a part of it and leaves the others, so one point is enough.
 */
export function boardRevealed() {
  const probe = globalThis.__pbgoCheck
  const main = probe && probe.main()
  const canvas = main ? main.renderer.domElement : document.querySelector("canvas")
  if (!canvas) return false
  const wrapper = canvas.parentElement
  for (const x of [0.15, 0.5, 0.85]) {
    for (const y of [0.15, 0.5, 0.85]) {
      const element = document.elementFromPoint(window.innerWidth * x, window.innerHeight * y)
      if (element && (element === canvas || (wrapper && wrapper.contains(element)))) return true
    }
  }
  return false
}

/** The camera and the canvas, as they are now */
export function readScene() {
  const probe = globalThis.__pbgoCheck
  if (!probe) return { ok: false, reason: "the probe is not installed" }
  const main = probe.main()
  if (!main) return { ok: false, reason: probe.renders.size ? "nothing has been drawn in the last seconds" : "no three.js scene was drawn" }
  const { camera, renderer, scene } = main
  const canvas = renderer.domElement
  const rect = canvas.getBoundingClientRect()
  let objects = 0
  const count = (object) => {
    objects += 1
    for (const child of object.children) count(child)
  }
  count(scene)
  return {
    ok: true,
    frames: probe.frames,
    objects,
    canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height, pixelWidth: canvas.width, pixelHeight: canvas.height },
    camera: {
      type: camera.type,
      fov: camera.fov,
      aspect: camera.aspect,
      position: [camera.position.x, camera.position.y, camera.position.z],
      view: Array.from(camera.matrixWorldInverse.elements),
      projection: Array.from(camera.projectionMatrix.elements),
    },
  }
}

/**
 * What the board offers to press, and where a pointer must be to press it. A pressable is an object with a click, pointer-down, pointer-up or double-click handler. For each one: its place in the world (the middle of its box, x to the right,
 * y up, z toward the viewer), its size, the pixel to press (the first of a few that is inside the window, not under any element of the page and that react-three-fiber's raycaster hands to this object first) and, when there is none,
 * why: `reachable` is false and `why` says what is in the way.
 */
export function scanPressables() {
  const probe = globalThis.__pbgoCheck
  const main = probe && probe.main()
  if (!main) return { ok: false, reason: "no three.js scene was drawn" }
  const { scene, camera, renderer } = main
  const canvas = renderer.domElement
  const rect = canvas.getBoundingClientRect()
  const view = camera.matrixWorldInverse.elements
  const projection = camera.projectionMatrix.elements
  /** A point of the world as a pixel of the window, or null behind the camera */
  const project = (x, y, z) => {
    const vx = view[0] * x + view[4] * y + view[8] * z + view[12]
    const vy = view[1] * x + view[5] * y + view[9] * z + view[13]
    const vz = view[2] * x + view[6] * y + view[10] * z + view[14]
    const cx = projection[0] * vx + projection[4] * vy + projection[8] * vz + projection[12]
    const cy = projection[1] * vx + projection[5] * vy + projection[9] * vz + projection[13]
    const cw = projection[3] * vx + projection[7] * vy + projection[11] * vz + projection[15]
    if (!(cw > 0)) return null
    return [rect.left + ((cx / cw) * 0.5 + 0.5) * rect.width, rect.top + (0.5 - (cy / cw) * 0.5) * rect.height]
  }

  const PRESS = ["onClick", "onPointerDown", "onPointerUp", "onDoubleClick"]
  const found = []
  const walk = (object, visible, names) => {
    const shown = visible && object.visible !== false
    const path = names.concat(object.name || object.type || "?")
    const handlers = object.__r3f ? object.__r3f.handlers : null
    const own = handlers ? PRESS.filter((name) => typeof handlers[name] === "function") : []
    if (own.length) found.push({ object, shown, path: path.join("/"), handlers: own })
    for (const child of object.children) walk(child, shown, path)
  }
  walk(scene, true, [])

  /** The box of an object in the world: its visible meshes' boxes, corner by corner through their world matrices */
  const boxOf = (object) => {
    const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], meshes: 0 }
    const add = (o) => {
      if (o.visible === false) return
      const geometry = o.geometry
      if (geometry) {
        if (!geometry.boundingBox && geometry.computeBoundingBox) geometry.computeBoundingBox()
        const b = geometry.boundingBox
        if (b && b.min.x <= b.max.x) {
          const m = o.matrixWorld.elements
          for (const x of [b.min.x, b.max.x])
            for (const y of [b.min.y, b.max.y])
              for (const z of [b.min.z, b.max.z]) {
                const world = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
                for (let i = 0; i < 3; i++) {
                  box.min[i] = Math.min(box.min[i], world[i])
                  box.max[i] = Math.max(box.max[i], world[i])
                }
              }
          box.meshes += 1
        }
      }
      for (const child of o.children) add(child)
    }
    add(object)
    return box
  }

  const state = scene.__r3f && scene.__r3f.root && scene.__r3f.root.getState ? scene.__r3f.root.getState() : null
  const raycaster = state && state.raycaster
  const targets = found.map((item) => item.object)
  /** Which pressable a pointer at this pixel reaches first (an index of `found`), -1 for none, null when it cannot be told */
  const reachedAt = (x, y) => {
    if (!raycaster) return null
    raycaster.setFromCamera({ x: ((x - rect.left) / rect.width) * 2 - 1, y: -((y - rect.top) / rect.height) * 2 + 1 }, camera)
    for (const hit of raycaster.intersectObjects(targets, true)) {
      let o = hit.object
      while (o && !targets.includes(o)) o = o.parent
      if (o) return targets.indexOf(o)
    }
    return -1
  }
  /** An element as a short name: its tag, the first plain classes (not the variants of a utility framework) and its text */
  const describe = (element) => {
    const classes = String(element.className && element.className.baseVal !== undefined ? element.className.baseVal : element.className || "")
      .split(/\s+/)
      .filter((name) => /^[a-z][a-z0-9-]*$/i.test(name))
      .slice(0, 2)
      .join(".")
    const text = (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30)
    return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}${text ? ` "${text}"` : ""}`
  }
  const wrapper = canvas.parentElement
  /** Null when a press at this pixel reaches the canvas, else what is on top of it or why it cannot */
  const blockedAt = (x, y) => {
    if (x < 1 || y < 1 || x > window.innerWidth - 1 || y > window.innerHeight - 1) return "outside the window"
    const element = document.elementFromPoint(x, y)
    if (!element) return "outside the window"
    return element === canvas || (wrapper && wrapper.contains(element)) ? null : describe(element)
  }

  const pressables = found.map((item, index) => {
    const box = boxOf(item.object)
    if (box.meshes === 0) return { index, path: item.path, handlers: item.handlers, shown: item.shown, world: null, size: null, pixel: null, center: null, reachable: false, why: "it has no mesh to press" }
    const world = box.min.map((low, i) => (low + box.max[i]) / 2)
    const size = box.max.map((high, i) => high - box.min[i])
    const corners = []
    for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) corners.push(project(x, y, z))
    const visibleCorners = corners.filter(Boolean)
    const center = project(world[0], world[1], world[2])
    const candidates = []
    if (center) candidates.push(center)
    if (visibleCorners.length) {
      const xs = visibleCorners.map((point) => point[0])
      const ys = visibleCorners.map((point) => point[1])
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      const grid = []
      for (const fx of [0.3, 0.5, 0.7, 0.15, 0.85]) for (const fy of [0.3, 0.5, 0.7, 0.15, 0.85]) grid.push([x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy])
      const around = center || [(x0 + x1) / 2, (y0 + y1) / 2]
      grid.sort((a, b) => Math.hypot(a[0] - around[0], a[1] - around[1]) - Math.hypot(b[0] - around[0], b[1] - around[1]))
      candidates.push(...grid)
    }
    let why = null
    let pixel = null
    for (const [k, [x, y]] of candidates.entries()) {
      const blocked = blockedAt(x, y)
      const reached = blocked ? null : reachedAt(x, y)
      if (!blocked && (reached === index || reached === null)) {
        pixel = [x, y]
        break
      }
      if (k === 0) {
        // what stops a press at the middle of it, for the report
        why = blocked ? `under ${blocked}` : reached === -1 ? "the pointer at its middle reaches no control" : `the pointer at its middle reaches another control (${found[reached].path})`
      }
    }
    return {
      index,
      path: item.path,
      handlers: item.handlers,
      shown: item.shown,
      world: world.map((v) => Math.round(v * 1000) / 1000),
      size: size.map((v) => Math.round(v * 1000) / 1000),
      center: center ? center.map((v) => Math.round(v)) : null,
      pixel: pixel ? pixel.map((v) => Math.round(v * 10) / 10) : null,
      reachable: pixel !== null,
      why: pixel ? null : (why ?? "it lies outside the window or behind the camera"),
    }
  })
  return { ok: true, raycast: !!raycaster, pressables }
}

/**
 * The boxes of the page that lie over the board, for the report: what the game's camera has to stay clear of. A box is an element that is fixed, sticky or absolutely placed and not too big to be one (a wrapper that fills the window is
 * looked into, a box is not), leaving out whatever holds the canvas. `pointerEvents: "none"` says that a press goes through it.
 */
export function overlays() {
  const canvas = document.querySelector("canvas")
  const area = window.innerWidth * window.innerHeight
  const out = []
  const walk = (element) => {
    const style = getComputedStyle(element)
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return
    const r = element.getBoundingClientRect()
    const holdsCanvas = !!canvas && (element.contains(canvas) || canvas.contains(element))
    if (["fixed", "sticky", "absolute"].includes(style.position) && !holdsCanvas && r.width >= 8 && r.height >= 8 && r.width * r.height <= area * 0.6) {
      const classes = String(element.className && element.className.baseVal !== undefined ? element.className.baseVal : element.className || "")
        .split(/\s+/)
        .filter((name) => /^[a-z][a-z0-9-]*$/i.test(name))
        .slice(0, 3)
        .join(".")
      out.push({
        what: `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`,
        text: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 26),
        x0: Math.round(r.left),
        y0: Math.round(r.top),
        x1: Math.round(r.right),
        y1: Math.round(r.bottom),
        pointerEvents: style.pointerEvents,
      })
      return
    }
    for (const child of element.children) walk(child)
  }
  walk(document.body)
  return out
}

/** How the page sits in its window: does anything scroll sideways */
export function pageMetrics() {
  const root = document.documentElement
  return { innerWidth: window.innerWidth, innerHeight: window.innerHeight, scrollWidth: root.scrollWidth, scrollsSideways: root.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1 }
}

/** The canvas as a small grey picture, a list of numbers: two of them taken a moment apart say whether anything on the table moved */
export function sampleCanvas() {
  const probe = globalThis.__pbgoCheck
  const main = probe && probe.main()
  const canvas = main ? main.renderer.domElement : document.querySelector("canvas")
  if (!canvas) return null
  const [w, h] = [96, 60]
  const small = document.createElement("canvas")
  small.width = w
  small.height = h
  const context = small.getContext("2d", { willReadFrequently: true })
  context.drawImage(canvas, 0, 0, w, h)
  const data = context.getImageData(0, 0, w, h).data
  const grey = new Array(w * h)
  for (let i = 0; i < w * h; i++) grey[i] = Math.round(data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11)
  return grey
}

/** From now on, notes the time of the first change of the text of the page: a move is seen on the board about when the text of the history changes */
export function watchText() {
  const state = (globalThis.__pbgoText = { base: document.body.innerText, first: null })
  clearInterval(globalThis.__pbgoTextTimer)
  globalThis.__pbgoTextTimer = setInterval(() => {
    if (state.first === null && document.body.innerText !== state.base) state.first = Date.now()
  }, 40)
}

/** When the text of the page first changed since `watchText`, in ms since the epoch, or null; stops watching */
export function textChangedAt() {
  clearInterval(globalThis.__pbgoTextTimer)
  return globalThis.__pbgoText ? globalThis.__pbgoText.first : null
}

/** The text on the page, on one line */
export function pageText() {
  return document.body.innerText.replace(/\s+/g, " ").trim()
}

/** Presses (with a script click, which is what a keyboard or a screen reader does) the first button whose text matches; its text, or null */
export function clickButton(source) {
  const pattern = new RegExp(source, "i")
  const button = [...document.querySelectorAll("button, [role=button]")].find((candidate) => pattern.test(candidate.textContent || "") && !candidate.disabled)
  if (!button) return null
  button.click()
  return (button.textContent || "").trim()
}

/** The text of the first button that matches, enabled or not; null when there is none */
export function findButton(source) {
  const pattern = new RegExp(source, "i")
  const button = [...document.querySelectorAll("button, [role=button]")].find((candidate) => pattern.test(candidate.textContent || ""))
  return button ? { text: (button.textContent || "").trim(), disabled: !!button.disabled } : null
}

import type { Specimens } from "@pbgo/docs/markdown"
import {
  SceneBoardSpecimen,
  SceneCameraSpecimen,
  SceneCardSpecimen,
  SceneFlightSpecimen,
  SceneGlowsSpecimen,
  SceneLayoutsSpecimen,
  ScenePileSpecimen,
  ScenePoseMemorySpecimen,
  SceneSeatsSpecimen,
  SceneTableSpecimen,
  SceneZonesSpecimen,
} from "./specimens"

/**
 * The live 3D scenes of the engine docs (`docs/engine/05-scene/`), one for each page that explains a piece of `@pbgo/table`, built from the package itself so that they cannot drift from it. The names are the pages' to ask for. Each is a light
 * client component (its controls, drawn at once) around a frame that loads the scene, a chunk with three.js in it, only when the frame is near the window: see `frame.tsx` and `lazy.tsx`.
 */
export const sceneSpecimens: Specimens = {
  "scene-board": SceneBoardSpecimen,
  "scene-table": SceneTableSpecimen,
  "scene-camera": SceneCameraSpecimen,
  "scene-card": SceneCardSpecimen,
  "scene-glows": SceneGlowsSpecimen,
  "scene-flight": SceneFlightSpecimen,
  "scene-pose-memory": ScenePoseMemorySpecimen,
  "scene-layouts": SceneLayoutsSpecimen,
  "scene-zones": SceneZonesSpecimen,
  "scene-pile": ScenePileSpecimen,
  "scene-seats": SceneSeatsSpecimen,
}

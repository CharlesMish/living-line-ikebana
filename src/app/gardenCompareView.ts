import type { SceneSettings } from "./scene.ts";
import type { VesselAppearanceChoice } from "../study/vesselAppearance.ts";
import type { VesselProfile } from "../study/vesselProfiles.ts";
import { fromCanonicalPlantGraph, type CanonicalPlantGraph } from "../core/index.ts";
import { ThreeStudio } from "../presentation/index.ts";
import type { CameraPose } from "./camera.ts";
import type { ComparisonViewport } from "./gardenCompare.ts";

/** A disposable studio for one side of a comparison. It is not the working bowl. */
export function createStudioComparisonViewport(canvas: HTMLCanvasElement, vesselProfile?: VesselProfile, vesselAppearance?: VesselAppearanceChoice & Partial<SceneSettings>): ComparisonViewport {
  const studio = new ThreeStudio(canvas, { vesselProfile, vesselAppearance });
  if (vesselAppearance?.backdropId && vesselAppearance.perchId) studio.setPhotoStage(vesselAppearance.backdropId, vesselAppearance.perchId);
  studio.setStemFibers(vesselAppearance?.stemFibers ?? false);
  return {
    setGraphs(plants: CanonicalPlantGraph[]) {
      studio.setGraphs(plants.map((plant) => fromCanonicalPlantGraph(plant)));
    },
    applyMatchedView(pose: CameraPose, verticalFov: number, worldScale: number) {
      studio.setVerticalFieldOfView(verticalFov);
      studio.setBotanicalWorldScale(worldScale);
      studio.setCameraPose(pose, "orbit", false);
    },
    destroy() {
      studio.dispose();
    },
  };
}

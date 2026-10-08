import { configureCampaignD1Study } from "../study/campaignD1PairedLeaf.ts";
import type { SceneCommittedStore, SceneStudioDocument } from "./scenePersistence.ts";
import type { SceneSettings } from "./scene.ts";

type StartupOrderingInput = {
  root: HTMLElement;
  campaignD1: boolean;
  fresh: boolean;
  store: Pick<SceneCommittedStore, "load">;
  defaultScene: SceneSettings;
};

export function loadCampaignD1StartupDocument(input: StartupOrderingInput): {
  initialSaved: SceneStudioDocument | null;
  scene: SceneSettings;
} {
  // Registration must happen before parsing persisted bytes containing D1 records.
  configureCampaignD1Study(input.root, input.campaignD1);
  const initialSaved = input.store.load();
  if (!input.fresh && initialSaved) {
    return { initialSaved, scene: initialSaved.scene };
  }
  return { initialSaved, scene: input.defaultScene };
}

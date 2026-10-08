import {
  prepareMaterialInsertion,
  type MaterialInsertionPreparation,
  type PlantGraph,
  type Vec3,
} from "../core/index.ts";
import { prepareCampaignB2Insertion } from "./campaignB2.ts";

export const KENZAN_BASE: Vec3 = { x: 0, y: 0.55, z: 0 };
type PrepareMaterialInsertionOptions = Readonly<{
  campaignB2?: boolean;
}>;

/**
 * Shared app-level preparation for both tray pointer drag and keyboard
 * activation. The source material ID is consumed here and never enters the
 * transaction reservation or graph.
 */
export function prepareMaterialInsertionForApp(
  materialId: string,
  successfulPlantOrdinal: number,
  options: PrepareMaterialInsertionOptions = {},
): MaterialInsertionPreparation {
  if (options.campaignB2) {
    const experimental = prepareCampaignB2Insertion(
      materialId,
      successfulPlantOrdinal + 1,
      KENZAN_BASE,
    );
    if (experimental) return experimental;
  }
  return prepareMaterialInsertion(
    materialId,
    successfulPlantOrdinal + 1,
    KENZAN_BASE,
  );
}

/** The selected continuation after seating is the graph's declared root. */
export function selectedBranchIdForSeatedGraph(
  graph: Pick<PlantGraph, "rootBranchId">,
): string {
  return graph.rootBranchId;
}

/** Resource limits for persisted botanical data, including inactive history.
 * These are rejection limits, never trimming or regeneration rules. */
export const PLANT_IMPORT_LIMITS = Object.freeze({ branches: 512, organs: 1024, points: 8192, depth: 128 });
export const ARRANGEMENT_IMPORT_LIMITS = Object.freeze({ branches: 4096, organs: 8192, points: 32768 });
export interface PlantRecordCounts { branches: number; organs: number; points: number }

/** Cheap preflight before allocating graph records or walking topology. */
export function countPlantImportRecords(value: unknown): PlantRecordCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("plant graph must be an object");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.branches) || !Array.isArray(record.organs)) throw new TypeError("branches and organs must be arrays");
  const counts = { branches: record.branches.length, organs: record.organs.length, points: 0 };
  if (counts.branches > PLANT_IMPORT_LIMITS.branches || counts.organs > PLANT_IMPORT_LIMITS.organs) {
    throw new TypeError("Plant has too many botanical records to open safely.");
  }
  for (const value of record.branches) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("branch must be an object");
    const branch = value as Record<string, unknown>;
    if (!Array.isArray(branch.points) || !Array.isArray(branch.restLengths)) throw new TypeError("branch points/restLengths must be arrays");
    if (branch.points.length < 2 || branch.points.length !== branch.restLengths.length + 1) {
      throw new TypeError("branch points must contain exactly one more point than rest lengths and at least two points");
    }
    counts.points += branch.points.length;
    if (counts.points > PLANT_IMPORT_LIMITS.points || branch.restLengths.length > PLANT_IMPORT_LIMITS.points) {
      throw new TypeError("Plant has too many material points to open safely.");
    }
  }
  return counts;
}

export function assertArrangementImportSize(plants: unknown[]): void {
  const totals: PlantRecordCounts = { branches: 0, organs: 0, points: 0 };
  // Even a valid reed contributes a branch. Bound before walking an attacker-sized array.
  if (plants.length > ARRANGEMENT_IMPORT_LIMITS.branches) throw new TypeError("Arrangement has too many botanical records to open safely.");
  for (const plant of plants) {
    const counts = countPlantImportRecords(plant);
    for (const key of ["branches", "organs", "points"] as const) {
      totals[key] += counts[key];
      if (totals[key] > ARRANGEMENT_IMPORT_LIMITS[key]) throw new TypeError("Arrangement has too many botanical records to open safely.");
    }
  }
}

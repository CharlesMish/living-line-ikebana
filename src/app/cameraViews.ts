import { cloneCameraPose, type CameraPose } from "./camera.ts";

export type CameraSlot = "A" | "B";
export const CAMERA_SLOTS: readonly CameraSlot[] = ["A", "B"];

/** Working-bowl session state. No graph, storage, Garden entry or photo recipe. */
export class CameraViews {
  private slots: Partial<Record<CameraSlot, CameraPose>> = {};

  store(slot: CameraSlot, pose: CameraPose) { this.slots[slot] = cloneCameraPose(pose); }
  recall(slot: CameraSlot): CameraPose | null {
    const pose = this.slots[slot];
    return pose ? cloneCameraPose(pose) : null;
  }
  clear() { this.slots = {}; }
  matches(slot: CameraSlot, current: CameraPose): boolean {
    const saved = this.slots[slot];
    return Boolean(saved && (["position", "target", "up"] as const).every(part =>
      (["x", "y", "z"] as const).every(axis => Math.abs(saved[part][axis] - current[part][axis]) < 1e-9)));
  }
}

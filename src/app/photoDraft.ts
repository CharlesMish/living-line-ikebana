import type { StudioCameraPose, CanonicalView } from "../presentation/ThreeStudio.ts";
import type { PhotoBackdrop, PhotoFormat, PhotoPerch } from "../presentation/photoStage.ts";
import type { PhotoLightingId } from "../presentation/photoLighting.ts";
import type { PhotoAdjustments } from "../presentation/photoAdjustments.ts";

/** A working-bowl identity, not a graph hash: ordinary edits retain it. null
 * identifies read-only Garden viewing and never consumes the working draft. */
export type PhotoDraftContext = number | null;

/** Only Photograph-owned choices. Plants, insertion identity, vessel and
 * botanical tones must always come from the latest committed snapshot. */
export interface PhotoDraft {
  backdrop: PhotoBackdrop;
  perch: PhotoPerch;
  format: PhotoFormat;
  fibers: boolean;
  pose: StudioCameraPose;
  view: "current" | CanonicalView;
  zoom: number;
  horizontal: number;
  vertical: number;
  yaw: number;
  pitch: number;
  roll: number;
  lighting: PhotoLightingId;
  finish: PhotoAdjustments;
  showingOriginal: boolean;
  grid: boolean;
  title: string;
}

/** One bounded, page-session-only draft. Nothing here reads or writes storage. */
export class PhotoDraftMemory {
  private entry: { context: number; draft: PhotoDraft } | null = null;
  restore(context: PhotoDraftContext): PhotoDraft | null {
    if (context === null) return null;
    if (this.entry?.context !== context) { this.entry = null; return null; }
    return structuredClone(this.entry.draft);
  }
  remember(context: PhotoDraftContext, draft: PhotoDraft): void {
    if (context !== null) this.entry = { context, draft: structuredClone(draft) };
  }
  forget(context: PhotoDraftContext): void {
    if (context !== null) this.entry = null;
  }
  clear(): void { this.entry = null; }
}

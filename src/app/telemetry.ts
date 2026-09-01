import type { BendVariant } from "./config.ts";
import type { AcquisitionRecord } from "./metrics.ts";

const STORAGE_KEY = "ikebana-web-alpha:telemetry-v1";

/** Practical bound on phone-session growth; oldest records drop first. */
const MAX_RECORDS_PER_VARIANT = 4000;

export type PersistedVariantTelemetry = {
  acquisitions: AcquisitionRecord[];
};

export type PersistedTelemetry = {
  storageVersion: 1;
  savedAt: string;
  variants: {
    bead: PersistedVariantTelemetry;
    touch: PersistedVariantTelemetry;
  };
};

function emptyTelemetry(): PersistedTelemetry {
  return {
    storageVersion: 1,
    savedAt: new Date(0).toISOString(),
    variants: {
      bead: { acquisitions: [] },
      touch: { acquisitions: [] },
    },
  };
}

function sanitize(value: unknown): PersistedTelemetry {
  const candidate = value as Partial<PersistedTelemetry> | null;
  if (
    !candidate ||
    candidate.storageVersion !== 1 ||
    typeof candidate.savedAt !== "string" ||
    !candidate.variants ||
    !Array.isArray(candidate.variants.bead?.acquisitions) ||
    !Array.isArray(candidate.variants.touch?.acquisitions)
  ) {
    return emptyTelemetry();
  }
  return {
    storageVersion: 1,
    savedAt: candidate.savedAt,
    variants: {
      bead: { acquisitions: [...candidate.variants.bead.acquisitions] },
      touch: { acquisitions: [...candidate.variants.touch.acquisitions] },
    },
  };
}

/**
 * Durable, cross-session acquisition telemetry keyed by bend-experiment
 * variant. Lives beside `CommittedStore`'s autosave key but is a separate
 * payload: telemetry is diagnostic, not botanical, and must never gate or
 * corrupt graph persistence.
 *
 * Only ever call `append` with a fully resolved record (a miss, or a hit
 * whose transaction has already committed, cancelled, or declined). This
 * store has no notion of a pending/live transaction, so it structurally
 * cannot write a preview or a cancelled edit that reads as a commit.
 */
export class TelemetryStore {
  constructor(private readonly key: string = STORAGE_KEY) {}

  load(): PersistedTelemetry {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyTelemetry();
      return sanitize(JSON.parse(raw));
    } catch {
      return emptyTelemetry();
    }
  }

  append(variant: BendVariant, record: AcquisitionRecord): boolean {
    const current = this.load();
    const bucket = current.variants[variant].acquisitions;
    bucket.push({ ...record });
    if (bucket.length > MAX_RECORDS_PER_VARIANT) {
      bucket.splice(0, bucket.length - MAX_RECORDS_PER_VARIANT);
    }
    current.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(this.key, JSON.stringify(current));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // Storage is an optional resilience layer; telemetry loss never blocks the toy.
    }
  }
}

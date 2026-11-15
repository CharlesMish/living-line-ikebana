import type { SpentCutting } from "./invitations.ts";
import type { ArrangementObservations } from "./observe.ts";

/**
 * Invitation progress, stored beside (never inside) the working bowl and the
 * Garden. A delivery points at the Garden entry it kept; the entry itself is
 * an ordinary Garden moment with no invitation fields, so Garden backups and
 * older builds are unaffected.
 */
export interface ActiveInvitation {
  readonly invitationId: string;
  readonly startedAt: string;
  readonly spent: readonly SpentCutting[];
}

export interface InvitationDelivery {
  readonly invitationId: string;
  readonly gardenEntryId: string;
  readonly title: string;
  readonly deliveredAt: string;
  readonly noteId: string;
  readonly observations: ArrangementObservations;
}

export interface InvitationProgress {
  readonly invitationsVersion: 1;
  readonly active: ActiveInvitation | null;
  readonly deliveries: readonly InvitationDelivery[];
}

export interface ProgressStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

export const DELIVERY_LIMIT = 96;
const SPENT_LIMIT = 64;
const MAX_CHARS = 120_000;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENTRY_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const PLANT_ID = /^plant-[1-9]\d*$/;

export const EMPTY_PROGRESS: InvitationProgress = Object.freeze({ invitationsVersion: 1, active: null, deliveries: Object.freeze([]) });

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid invitation progress.");
  return value as Record<string, unknown>;
}
function date(value: unknown): string {
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error("Invalid invitation date.");
  return value;
}
function finite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1000) throw new Error("Invalid invitation measurement.");
  return value;
}
function spentList(value: unknown): SpentCutting[] {
  if (!Array.isArray(value) || value.length > SPENT_LIMIT) throw new Error("Invalid spent cuttings.");
  const ids = new Set<string>();
  return value.map((raw) => {
    const item = record(raw);
    if (typeof item.plantId !== "string" || !PLANT_ID.test(item.plantId) || ids.has(item.plantId)
      || typeof item.materialId !== "string" || !ID.test(item.materialId)) throw new Error("Invalid spent cutting.");
    ids.add(item.plantId);
    return { plantId: item.plantId, materialId: item.materialId };
  });
}

/** Explicit field allowlist: undeclared fields are dropped; a malformed declared field fails the whole document closed. */
export function parseProgress(raw: string): InvitationProgress {
  if (raw.length > MAX_CHARS) throw new Error("Invitation progress is too large.");
  const source = record(JSON.parse(raw));
  if (source.invitationsVersion !== 1 || !Array.isArray(source.deliveries) || source.deliveries.length > DELIVERY_LIMIT) {
    throw new Error("This invitation progress cannot be opened.");
  }
  let active: ActiveInvitation | null = null;
  if (source.active !== null) {
    const item = record(source.active);
    if (typeof item.invitationId !== "string" || !ID.test(item.invitationId)) throw new Error("Invalid active invitation.");
    active = { invitationId: item.invitationId, startedAt: date(item.startedAt), spent: spentList(item.spent) };
  }
  const deliveries = source.deliveries.map((raw): InvitationDelivery => {
    const item = record(raw);
    if (typeof item.invitationId !== "string" || !ID.test(item.invitationId)
      || typeof item.gardenEntryId !== "string" || !ENTRY_ID.test(item.gardenEntryId)
      || typeof item.title !== "string" || item.title.length > 80
      || typeof item.noteId !== "string" || !/^[a-z0-9-]{1,40}$/.test(item.noteId)) throw new Error("Invalid delivery.");
    const observed = record(item.observations);
    if (!Number.isSafeInteger(observed.cuttings) || (observed.cuttings as number) < 0 || (observed.cuttings as number) > 64) throw new Error("Invalid delivery.");
    return {
      invitationId: item.invitationId, gardenEntryId: item.gardenEntryId, title: item.title,
      deliveredAt: date(item.deliveredAt), noteId: item.noteId,
      observations: { cuttings: observed.cuttings as number, height: finite(observed.height), depth: finite(observed.depth), lean: finite(observed.lean) },
    };
  });
  return { invitationsVersion: 1, active, deliveries };
}

/**
 * Bounded and fail-closed, like the Garden. Unreadable data stays untouched;
 * the caller shows invitations as unavailable rather than overwriting it.
 */
export class InvitationProgressStore {
  private readable = false;
  private current: InvitationProgress = EMPTY_PROGRESS;
  constructor(
    private readonly key: string,
    private readonly storage: ProgressStorage = { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
  ) {}

  load(): InvitationProgress {
    this.readable = false;
    const raw = this.storage.getItem(this.key);
    this.current = raw === null ? EMPTY_PROGRESS : parseProgress(raw);
    this.readable = true;
    return this.current;
  }

  get progress(): InvitationProgress { return this.current; }
  get isReadable(): boolean { return this.readable; }

  private write(next: InvitationProgress): InvitationProgress {
    if (!this.readable) throw new Error("Invitation progress could not be read, so nothing was changed.");
    const raw = JSON.stringify(next);
    const validated = parseProgress(raw);
    try { this.storage.setItem(this.key, raw); }
    catch { throw new Error("Invitation progress could not be saved on this device."); }
    this.current = validated;
    return validated;
  }

  begin(invitationId: string, startedAt = new Date().toISOString()): InvitationProgress {
    return this.write({ ...this.current, active: { invitationId, startedAt, spent: [] } });
  }

  /** Records cuttings that left the bowl after being cut. No-op when nothing changed. */
  addSpent(cuttings: readonly SpentCutting[]): InvitationProgress {
    const active = this.current.active;
    if (!active || cuttings.length === 0) return this.current;
    const known = new Set(active.spent.map((cutting) => cutting.plantId));
    const additions = cuttings.filter((cutting) => !known.has(cutting.plantId));
    if (!additions.length) return this.current;
    return this.write({ ...this.current, active: { ...active, spent: [...active.spent, ...additions] } });
  }

  setAside(): InvitationProgress {
    if (!this.current.active) return this.current;
    return this.write({ ...this.current, active: null });
  }

  deliver(delivery: InvitationDelivery): InvitationProgress {
    if (this.current.deliveries.length >= DELIVERY_LIMIT) throw new Error(`Invitations can record ${DELIVERY_LIMIT} deliveries on this device, and that many are recorded.`);
    return this.write({ invitationsVersion: 1, active: null, deliveries: [...this.current.deliveries, delivery] });
  }
}

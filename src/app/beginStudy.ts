import { BEGIN_INVITATIONS, BEGIN_LINES, type BeginInvitation } from "./beginLines.ts";

/** Separate from studio-v2 and garden-v2. Clearing it reapplies the build seed. */
export const BEGIN_STUDY_KEY = "ikebana-web-alpha:begin-study-v1";
export const BEGIN_EVENT_ATTRIBUTE = "data-begin-event";
const EVENT_LIMIT = 400;

export type BeginKind = "line" | "for";
export type BeginSurface = "opening" | "after-keep";

export type BeginEvent =
  | { type: "offer-shown"; at: string; surface: BeginSurface; kind: BeginKind; itemId: string; reshow?: true }
  | { type: "begin-pressed"; at: string; kind: BeginKind; itemId: string; surface: BeginSurface }
  | { type: "begin"; at: string; kind: BeginKind; itemId: string; surface: BeginSurface }
  | { type: "begin-cancelled"; at: string; kind: BeginKind; itemId: string; surface: BeginSurface }
  | { type: "another"; at: string; surface: BeginSurface; kind: BeginKind; from: string; to: string }
  | { type: "not-now"; at: string; surface: BeginSurface; kind: BeginKind; itemId: string }
  | { type: "stop"; at: string; surface: "after-keep" }
  | { type: "note-opened"; at: string; itemId: string }
  | { type: "note-closed"; at: string; itemId: string }
  | { type: "start-edited"; at: string; itemId: string; plantId: string }
  | { type: "start-removed"; at: string; itemId: string; plantId: string }
  | { type: "start-undone"; at: string; itemId: string; plantId: string }
  | { type: "start-restored"; at: string; itemId: string; plantId: string };

export interface BeginStudyDocument {
  version: 1;
  events: BeginEvent[];
  openingIndex: number;
  afterKeepIndex: number;
  chosenInvitationId: string | null;
  noteCollapsed: boolean;
  seatedLineId: string | null;
  seatedPlantId: string | null;
}

export interface BeginStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function beginIndex(seed: number, count: number): number {
  if (!Number.isFinite(seed) || count <= 0) return 0;
  return Math.trunc(Math.abs(seed)) % count;
}

export function beginEventToken(event: BeginEvent): string {
  switch (event.type) {
    case "offer-shown": return event.reshow
      ? `offer-shown:${event.surface}:${event.itemId}:reshow`
      : `offer-shown:${event.surface}:${event.itemId}`;
    case "begin-pressed": return `begin-pressed:${event.itemId}`;
    case "begin": return `begin:${event.itemId}`;
    case "begin-cancelled": return `begin-cancelled:${event.itemId}`;
    case "another": return `another:${event.from}>${event.to}`;
    case "not-now": return `not-now:${event.surface}:${event.itemId}`;
    case "stop": return "stop:after-keep";
    case "note-opened": return `note-opened:${event.itemId}`;
    case "note-closed": return `note-closed:${event.itemId}`;
    case "start-edited": return `start-edited:${event.itemId}:${event.plantId}`;
    case "start-removed": return `start-removed:${event.itemId}:${event.plantId}`;
    case "start-undone": return `start-undone:${event.itemId}:${event.plantId}`;
    case "start-restored": return `start-restored:${event.itemId}:${event.plantId}`;
  }
}

/**
 * A seated start changed or left the bowl. The first observation adopts a
 * baseline and does not invent an edit. A repeated absence logs once.
 */
export function nextStartPlantSignal(
  state: { canonical: string | null; removalLogged: boolean },
  plantCanonical: string | null,
  operation?: string,
): { signal: "edited" | "removed" | "undone" | "restored" | null; canonical: string | null; removalLogged: boolean } {
  if (plantCanonical === null) {
    if (state.removalLogged) return { signal: null, canonical: null, removalLogged: true };
    if (operation === "undo") return { signal: "undone", canonical: null, removalLogged: true };
    return { signal: "removed", canonical: null, removalLogged: true };
  }
  if (state.canonical === null || state.removalLogged) {
    if (state.removalLogged && operation === "undo") {
      return { signal: "restored", canonical: plantCanonical, removalLogged: false };
    }
    return { signal: null, canonical: plantCanonical, removalLogged: false };
  }
  if (plantCanonical === state.canonical) {
    return { signal: null, canonical: state.canonical, removalLogged: false };
  }
  return { signal: "edited", canonical: plantCanonical, removalLogged: false };
}

const catalogOf = (kind: BeginKind) => kind === "line" ? BEGIN_LINES : BEGIN_INVITATIONS;

function freshDocument(seed: number, count: number): BeginStudyDocument {
  const index = beginIndex(seed, count);
  return {
    version: 1,
    events: [],
    openingIndex: index,
    afterKeepIndex: index,
    chosenInvitationId: null,
    noteCollapsed: false,
    seatedLineId: null,
    seatedPlantId: null,
  };
}

function parseDocument(raw: string, seed: number, count: number): BeginStudyDocument {
  const source = JSON.parse(raw) as Partial<BeginStudyDocument>;
  if (source.version !== 1 || !Array.isArray(source.events)) return freshDocument(seed, count);
  const index = (value: unknown) => Number.isInteger(value) ? beginIndex(value as number, count) : beginIndex(seed, count);
  return {
    version: 1,
    events: source.events.filter((event) => event && typeof event === "object" && typeof (event as BeginEvent).type === "string") as BeginEvent[],
    openingIndex: index(source.openingIndex),
    afterKeepIndex: index(source.afterKeepIndex),
    chosenInvitationId: typeof source.chosenInvitationId === "string" ? source.chosenInvitationId : null,
    noteCollapsed: source.noteCollapsed === true,
    seatedLineId: typeof source.seatedLineId === "string" ? source.seatedLineId : null,
    seatedPlantId: typeof source.seatedPlantId === "string" ? source.seatedPlantId : null,
  };
}

/**
 * Offer rotation and the study log. The two cursors move on their own.
 * Neither is derived from how many Garden entries exist.
 */
export class BeginSession {
  readonly kind: BeginKind;
  private readonly count: number;
  private readonly storage: BeginStorage;
  private readonly key: string;
  private readonly now: () => string;
  private document: BeginStudyDocument;
  /** The offer currently on screen. A return after this clears can log again. */
  private shownKey: string | null = null;
  /** Session only. A reload of an empty bowl may offer again. */
  openingDismissed = false;
  /** Session only. Set when Keep finishes, cleared when the player stops or begins. */
  afterKeepArmed = false;

  constructor(options: {
    kind: BeginKind;
    seed: number;
    storage: BeginStorage;
    key?: string;
    now?: () => string;
  }) {
    this.kind = options.kind;
    this.count = catalogOf(options.kind).length;
    this.storage = options.storage;
    this.key = options.key ?? BEGIN_STUDY_KEY;
    this.now = options.now ?? (() => new Date().toISOString());
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
      this.document = raw ? parseDocument(raw, options.seed, this.count) : freshDocument(options.seed, this.count);
    } catch {
      this.document = freshDocument(options.seed, this.count);
      raw = null;
    }
    if (!raw) this.persist();
  }

  snapshot(): BeginStudyDocument {
    return structuredClone(this.document);
  }

  token(): string {
    const last = this.document.events[this.document.events.length - 1];
    return last ? beginEventToken(last) : "";
  }

  item(surface: BeginSurface): { id: string; text: string } {
    const index = surface === "opening" ? this.document.openingIndex : this.document.afterKeepIndex;
    const item = catalogOf(this.kind)[index];
    return { id: item.id, text: item.text };
  }

  chosenInvitation(): BeginInvitation | null {
    if (this.kind !== "for" || !this.document.chosenInvitationId) return null;
    return BEGIN_INVITATIONS.find((item) => item.id === this.document.chosenInvitationId) ?? null;
  }

  noteCollapsed(): boolean {
    return this.document.noteCollapsed;
  }

  seatedLine(): { lineId: string; plantId: string } | null {
    if (!this.document.seatedLineId || !this.document.seatedPlantId) return null;
    return { lineId: this.document.seatedLineId, plantId: this.document.seatedPlantId };
  }

  noteShown(surface: BeginSurface, itemId: string) {
    const key = `${surface}:${itemId}`;
    if (this.shownKey === key) return;
    const seenBefore = this.document.events.some((event) =>
      event.type === "offer-shown" && event.surface === surface && event.itemId === itemId);
    this.shownKey = key;
    this.record({
      type: "offer-shown",
      at: this.now(),
      surface,
      kind: this.kind,
      itemId,
      ...(seenBefore ? { reshow: true as const } : {}),
    });
  }

  clearShown() {
    this.shownKey = null;
  }

  another(surface: BeginSurface) {
    const key = surface === "opening" ? "openingIndex" : "afterKeepIndex";
    const fromIndex = this.document[key];
    const toIndex = (fromIndex + 1) % this.count;
    const catalog = catalogOf(this.kind);
    this.document[key] = toIndex;
    this.shownKey = null;
    this.record({
      type: "another",
      at: this.now(),
      surface,
      kind: this.kind,
      from: catalog[fromIndex].id,
      to: catalog[toIndex].id,
    });
  }

  notNow(surface: BeginSurface) {
    const item = this.item(surface);
    if (surface === "opening") this.openingDismissed = true;
    else this.afterKeepArmed = false;
    this.clearShown();
    this.record({ type: "not-now", at: this.now(), surface, kind: this.kind, itemId: item.id });
  }

  stop() {
    this.afterKeepArmed = false;
    this.clearShown();
    this.record({ type: "stop", at: this.now(), surface: "after-keep" });
  }

  recordPressed(itemId: string, surface: BeginSurface) {
    this.record({ type: "begin-pressed", at: this.now(), kind: this.kind, itemId, surface });
  }

  /** The line was seated, or the invitation note was applied. */
  recordBegin(itemId: string, surface: BeginSurface) {
    this.record({ type: "begin", at: this.now(), kind: this.kind, itemId, surface });
  }

  recordCancelled(itemId: string, surface: BeginSurface) {
    this.record({ type: "begin-cancelled", at: this.now(), kind: this.kind, itemId, surface });
  }

  chooseInvitation(itemId: string) {
    this.document.chosenInvitationId = itemId;
    this.document.noteCollapsed = false;
    this.persist();
  }

  toggleNote() {
    const invitation = this.chosenInvitation();
    if (!invitation) return;
    this.document.noteCollapsed = !this.document.noteCollapsed;
    this.record(this.document.noteCollapsed
      ? { type: "note-closed", at: this.now(), itemId: invitation.id }
      : { type: "note-opened", at: this.now(), itemId: invitation.id });
  }

  rememberSeat(lineId: string, plantId: string) {
    this.document.seatedLineId = lineId;
    this.document.seatedPlantId = plantId;
    this.persist();
  }

  recordEdited() {
    const seated = this.seatedLine();
    if (!seated) return;
    this.record({ type: "start-edited", at: this.now(), itemId: seated.lineId, plantId: seated.plantId });
  }

  recordRemoved() {
    const seated = this.seatedLine();
    if (!seated) return;
    this.record({ type: "start-removed", at: this.now(), itemId: seated.lineId, plantId: seated.plantId });
  }

  recordUndone() {
    const seated = this.seatedLine();
    if (!seated) return;
    this.record({ type: "start-undone", at: this.now(), itemId: seated.lineId, plantId: seated.plantId });
  }

  recordRestored() {
    const seated = this.seatedLine();
    if (!seated) return;
    this.record({ type: "start-restored", at: this.now(), itemId: seated.lineId, plantId: seated.plantId });
  }

  /**
   * After a line or invitation is actually used, skip it on whichever cursor
   * was about to show it. The other cursor moves only when it would repeat.
   */
  commitUse(itemId: string) {
    const used = catalogOf(this.kind).findIndex((item) => item.id === itemId);
    if (used < 0) return;
    const step = (index: number) => index === used ? (index + 1) % this.count : index;
    this.document.openingIndex = step(this.document.openingIndex);
    this.document.afterKeepIndex = step(this.document.afterKeepIndex);
    this.clearShown();
    this.persist();
  }

  private record(event: BeginEvent) {
    this.document.events.push(event);
    if (this.document.events.length > EVENT_LIMIT) {
      this.document.events.splice(0, this.document.events.length - EVENT_LIMIT);
    }
    this.persist();
  }

  private persist() {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.document));
    } catch {
      /* The data attribute still carries the last event if storage is full. */
    }
  }
}

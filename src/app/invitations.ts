/**
 * Opt-in invitation copy for `?invite=material` and `?invite=occasion`.
 * Static lists only. Nothing here is written to studio, Garden, or telemetry.
 * Remembering which invitation a kept bowl answered would need a gardenVersion bump.
 */

export type InviteMode = "material" | "occasion";
export type InvitationMoment = "empty-bowl" | "garden-after-keep";

export interface InvitationEntry {
  readonly id: string;
  readonly text: string;
  /** Existing catalog id when this invitation can preselect a material. */
  readonly materialId: string | null;
}

export const INVITATION_HEADING = "An invitation";
export const INVITATION_ACTIONS = ["Begin", "Another", "Not now"] as const;

export const MATERIAL_INVITATIONS: readonly InvitationEntry[] = Object.freeze([
  Object.freeze({
    id: "reed",
    materialId: "reed",
    text: "One straight reed. What would you leave around it?",
  }),
  Object.freeze({
    id: "bare-branch",
    materialId: "bare-branch",
    text: "A bare branch, late in the year. Which way does it lean?",
  }),
  Object.freeze({
    id: "arching-trailer",
    materialId: "arching-trailer",
    text: "Something that falls instead of rises. Where does it land?",
  }),
  Object.freeze({
    id: "fern-frond",
    materialId: "fern-frond",
    text: "A fern frond in early spring. How much of it will you show?",
  }),
  Object.freeze({
    id: "berry-twig",
    materialId: "berry-twig",
    text: "A twig of berries. Is it the accent, or the whole story?",
  }),
  Object.freeze({
    id: "flowering-branch",
    materialId: "flowering-branch",
    text: "A branch in bloom. What does it need beside it?",
  }),
]);

export const OCCASION_INVITATIONS: readonly InvitationEntry[] = Object.freeze([
  Object.freeze({
    id: "coming-home-late",
    materialId: null,
    text: "For someone coming home late: something to see from the doorway.",
  }),
  Object.freeze({
    id: "narrow-kitchen-windowsill",
    materialId: null,
    text: "For a narrow kitchen windowsill.",
  }),
  Object.freeze({
    id: "quiet-reading-corner",
    materialId: null,
    text: "For a quiet corner where someone reads.",
  }),
  Object.freeze({
    id: "starting-something-new",
    materialId: null,
    text: "For a friend who is starting something new.",
  }),
  Object.freeze({
    id: "rainy-afternoon",
    materialId: null,
    text: "For a rainy afternoon, seen from a chair.",
  }),
  Object.freeze({
    id: "first-morning",
    materialId: null,
    text: "For the first morning after a long trip.",
  }),
]);

export function readInviteMode(search: string): InviteMode | null {
  const value = new URLSearchParams(search).get("invite");
  return value === "material" || value === "occasion" ? value : null;
}

export function invitationsFor(mode: InviteMode): readonly InvitationEntry[] {
  return mode === "material" ? MATERIAL_INVITATIONS : OCCASION_INVITATIONS;
}

/** Garden entry count, read only, wrapped onto the list. Non-counts start at the first entry. */
export function invitationStartIndex(gardenEntryCount: number, length: number): number {
  if (!Number.isFinite(length) || length <= 0) return 0;
  const count = Number.isSafeInteger(gardenEntryCount) && gardenEntryCount > 0 ? gardenEntryCount : 0;
  return count % length;
}

export interface InvitationCardModel {
  readonly moment: InvitationMoment;
  readonly index: number;
}

export interface InvitationSession {
  readonly card: InvitationCardModel | null;
  /** Material from a Garden Begin, applied only once a fresh empty bowl exists. */
  readonly pendingMaterialId: string | null;
}

export const CLOSED_INVITATION: InvitationSession = Object.freeze({
  card: null,
  pendingMaterialId: null,
});

export type InvitationCommand =
  | { readonly type: "show-empty-bowl"; readonly gardenEntryCount: number }
  | { readonly type: "show-after-keep"; readonly gardenEntryCount: number }
  | { readonly type: "another" }
  | { readonly type: "not-now" }
  | { readonly type: "begin" }
  | { readonly type: "garden-closed" }
  | { readonly type: "replacement-declined" }
  | { readonly type: "fresh-bowl-created" }
  | { readonly type: "bowl-gained-material" };

export type InvitationEffect =
  | { readonly type: "select-material"; readonly materialId: string }
  | { readonly type: "request-fresh-bowl" };

export interface InvitationStep {
  readonly session: InvitationSession;
  readonly effects: readonly InvitationEffect[];
}

function entryAt(mode: InviteMode, index: number): InvitationEntry {
  const list = invitationsFor(mode);
  const length = list.length;
  const safe = length === 0 ? 0 : ((Math.trunc(index) % length) + length) % length;
  return list[safe] ?? list[0]!;
}

function shown(moment: InvitationMoment, gardenEntryCount: number, session: InvitationSession, mode: InviteMode): InvitationStep {
  return {
    session: {
      card: { moment, index: invitationStartIndex(gardenEntryCount, invitationsFor(mode).length) },
      pendingMaterialId: session.pendingMaterialId,
    },
    effects: [],
  };
}

export function reduceInvitation(
  session: InvitationSession,
  command: InvitationCommand,
  mode: InviteMode,
): InvitationStep {
  const length = invitationsFor(mode).length;
  switch (command.type) {
    case "show-empty-bowl":
      return shown("empty-bowl", command.gardenEntryCount, session, mode);
    case "show-after-keep":
      return shown("garden-after-keep", command.gardenEntryCount, session, mode);
    case "another": {
      if (!session.card || length === 0) return { session, effects: [] };
      return {
        session: {
          card: { moment: session.card.moment, index: (session.card.index + 1) % length },
          pendingMaterialId: session.pendingMaterialId,
        },
        effects: [],
      };
    }
    case "not-now":
      return { session: { card: null, pendingMaterialId: session.pendingMaterialId }, effects: [] };
    case "begin": {
      if (!session.card) return { session, effects: [] };
      const entry = entryAt(mode, session.card.index);
      if (session.card.moment === "garden-after-keep") {
        return {
          session: { card: null, pendingMaterialId: entry.materialId },
          effects: [{ type: "request-fresh-bowl" }],
        };
      }
      return {
        session: { card: null, pendingMaterialId: null },
        effects: entry.materialId ? [{ type: "select-material", materialId: entry.materialId }] : [],
      };
    }
    case "garden-closed":
      if (session.card?.moment !== "garden-after-keep") return { session, effects: [] };
      return { session: { card: null, pendingMaterialId: session.pendingMaterialId }, effects: [] };
    case "replacement-declined":
      return { session: { card: session.card, pendingMaterialId: null }, effects: [] };
    case "fresh-bowl-created":
      return {
        session: { card: session.card, pendingMaterialId: null },
        effects: session.pendingMaterialId
          ? [{ type: "select-material", materialId: session.pendingMaterialId }]
          : [],
      };
    case "bowl-gained-material":
      if (session.card?.moment !== "empty-bowl") return { session, effects: [] };
      return { session: { card: null, pendingMaterialId: session.pendingMaterialId }, effects: [] };
    default:
      return { session, effects: [] };
  }
}

export function visibleInvitation(session: InvitationSession, mode: InviteMode): InvitationEntry | null {
  if (!session.card) return null;
  return entryAt(mode, session.card.index);
}

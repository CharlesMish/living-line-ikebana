import {
  INVITATION_ACTIONS,
  INVITATION_HEADING,
  visibleInvitation,
  type InvitationSession,
  type InviteMode,
} from "./invitations.ts";

export interface InvitationCardHandle {
  readonly element: HTMLElement;
  show(
    session: InvitationSession,
    mode: InviteMode,
    place: "studio" | "garden",
    before: { studio: Element; garden: Element | null },
  ): void;
  hide(): void;
  destroy(): void;
}

/** One card. E1 and E2 share its heading, sentence slot, buttons, and class. */
export function mountInvitationCard(actions: {
  onBegin(): void;
  onAnother(): void;
  onNotNow(): void;
}): InvitationCardHandle {
  const element = document.createElement("section");
  element.className = "invitation-card";
  element.setAttribute("role", "region");
  element.setAttribute("aria-labelledby", "invitation-heading");
  element.dataset.testid = "invitation-card";

  const heading = document.createElement("h2");
  heading.id = "invitation-heading";
  heading.textContent = INVITATION_HEADING;

  const sentence = document.createElement("p");
  const row = document.createElement("div");
  row.className = "invitation-actions";
  row.append(
    actionButton(INVITATION_ACTIONS[0], "begin", actions.onBegin),
    actionButton(INVITATION_ACTIONS[1], "another", actions.onAnother),
    actionButton(INVITATION_ACTIONS[2], "not-now", actions.onNotNow),
  );
  element.append(heading, sentence, row);

  return {
    element,
    show(session, mode, place, before) {
      const entry = visibleInvitation(session, mode);
      const anchor = place === "garden" ? before.garden : before.studio;
      if (!entry || !anchor?.parentNode) {
        element.remove();
        return;
      }
      element.dataset.inviteMode = mode;
      element.dataset.inviteId = entry.id;
      sentence.textContent = entry.text;
      element.classList.toggle("invitation-card--garden", place === "garden");
      anchor.before(element);
    },
    hide() {
      element.remove();
    },
    destroy() {
      element.remove();
    },
  };
}

function actionButton(label: string, action: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.inviteAction = action;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return button;
}

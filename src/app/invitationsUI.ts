import type { GuestArrangement } from "./guestArrangements.ts";
import {
  getInvitations,
  isInvitationOpen,
  kitItemLabel,
  type Invitation,
  type ReadingBand,
} from "../loop/invitations.ts";
import type { InvitationProgressStore } from "../loop/progress.ts";
import "./invitations.css";

export interface InvitationActions {
  /** Cancels any live gesture before the dialog reads or changes state. */
  pause(): void;
  isViewing(): boolean;
  plantsInBowl(): number;
  /** Cuttings left in the active kit, or null when no invitation is active. */
  kitRemaining(): ReadonlyMap<string, number> | null;
  begin(invitation: Invitation): void;
  setAside(): void;
  /** Keeps the bowl in the Garden, records the delivery and returns the host's note. Throws on failure. */
  deliver(invitation: Invitation, title: string): ReadingBand;
  viewGuest(guest: GuestArrangement): void;
  viewKept(entryId: string): boolean;
  layoutLabel(layoutId: string): string;
}

/**
 * Invitations own no botanical or Garden state. Every change goes through the
 * app: a fresh bowl uses the Garden's Keep/Replace choice, and delivering is an
 * ordinary Keep plus one progress record.
 */
export class InvitationsUI {
  private readonly controller = new AbortController();
  private readonly dialog: HTMLDialogElement;
  private readonly openButton: HTMLButtonElement | null;
  private reply: { invitation: Invitation; band: ReadingBand } | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly store: InvitationProgressStore,
    private readonly actions: InvitationActions,
    private readonly guests: readonly GuestArrangement[] = [],
  ) {
    const host = document.createElement("div");
    host.className = "invitations-host";
    host.innerHTML = `
      <dialog id="invitations-dialog" class="garden-dialog invitations-dialog" aria-labelledby="invitations-title">
        <div class="panel-heading"><div><p class="eyebrow">Requests from people and places</p><h1 id="invitations-title">Invitations</h1></div>
          <button id="invitations-close" class="icon-button" type="button" aria-label="Close Invitations">×</button></div>
        <p class="garden-intro">Someone asks for an arrangement. You get a vessel and a small kit. Choose the view they will see, then deliver it. They will tell you how it went. There is no score.</p>
        <p id="invitations-message" class="garden-message" role="status" aria-live="polite"></p>
        <section id="invitation-reply" class="invitation-reply" hidden aria-labelledby="invitation-reply-from">
          <p class="eyebrow" id="invitation-reply-from"></p>
          <blockquote id="invitation-reply-note"></blockquote>
          <div id="invitation-reply-guests" class="invitation-guests"></div>
          <p id="invitation-reply-next" class="panel-note"></p>
        </section>
        <section id="invitation-active" class="invitation-active" hidden aria-labelledby="invitation-active-title">
          <p class="eyebrow">Now arranging</p>
          <h2 id="invitation-active-title"></h2>
          <p id="invitation-active-brief" class="invitation-brief"></p>
          <p id="invitation-active-kit" class="invitation-meta"></p>
          <form id="invitation-deliver-form" class="garden-keep-form">
            <label for="invitation-name">Name it <span>(optional)</span></label>
            <div class="garden-actions"><input id="invitation-name" maxlength="80" autocomplete="off"/><button id="invitation-deliver" type="submit">Deliver this bowl</button></div>
            <p class="panel-note">Delivers the bowl from the view you are looking at now, and keeps it in your Garden. Your working bowl stays open.</p>
          </form>
          <div class="garden-actions"><button type="button" id="invitation-set-aside">Set aside</button></div>
        </section>
        <h2 class="invitations-list-heading">Requests</h2>
        <div id="invitation-list" class="invitation-list"></div>
      </dialog>`;
    root.append(host);
    this.dialog = host.querySelector<HTMLDialogElement>("#invitations-dialog")!;
    this.openButton = root.querySelector<HTMLButtonElement>("#invitations-open");
    const signal = this.controller.signal;
    this.openButton?.addEventListener("click", () => this.open(), { signal });
    this.find("#invitations-close").addEventListener("click", () => this.dialog.close(), { signal });
    this.find("#invitation-set-aside").addEventListener("click", () => this.run(() => {
      this.actions.setAside();
      this.message("Set aside. Your bowl stays open, with every material.");
      this.render();
    }), { signal });
    this.find("#invitation-deliver-form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.run(() => {
        const invitation = this.activeInvitation();
        if (!invitation) throw new Error("There is no invitation in progress.");
        const title = this.find<HTMLInputElement>("#invitation-name").value.trim();
        const band = this.actions.deliver(invitation, title || invitation.title);
        this.find<HTMLInputElement>("#invitation-name").value = "";
        this.reply = { invitation, band };
        this.message("");
        this.render();
        this.find<HTMLElement>("#invitation-reply-note").focus();
      });
    }, { signal });
    this.dialog.addEventListener("close", () => {
      this.reply = null;
      this.root.querySelector<HTMLButtonElement>("#more-toggle")?.focus();
    }, { signal });
    this.syncOpener();
  }

  private find<T extends HTMLElement = HTMLElement>(selector: string): T { return this.dialog.querySelector<T>(selector)!; }
  private message(value: unknown) { this.find("#invitations-message").textContent = value instanceof Error ? value.message : String(value); }
  private run(action: () => void) { try { action(); } catch (error) { this.message(error); } }

  private activeInvitation(): Invitation | null {
    const id = this.store.progress.active?.invitationId;
    return id ? getInvitations().find((invitation) => invitation.id === id) ?? null : null;
  }

  private materialName(materialId: string): string {
    const label = this.root.querySelector<HTMLElement>(`[data-material-choice="${materialId}"] .material-choice-name`)?.textContent?.trim();
    return (label || materialId.replaceAll("-", " ")).toLowerCase();
  }

  private kitText(invitation: Invitation, remaining?: ReadonlyMap<string, number> | null): string {
    return invitation.kit.map((item) => kitItemLabel(this.materialName(item.materialId), remaining?.get(item.materialId) ?? item.count)).join(", ");
  }

  /** The Studio menu entry names the invitation in progress, so Deliver is easy to find again. */
  syncOpener() {
    if (!this.openButton) return;
    const active = this.activeInvitation();
    const detail = this.openButton.querySelector("span");
    if (detail) detail.textContent = active ? `Now: ${active.title} · deliver or set aside` : "Requests with a small kit";
  }

  open() {
    this.actions.pause();
    this.message("");
    this.reply = null;
    try { this.store.load(); }
    catch { this.message("Invitation progress on this device could not be read. It has been left untouched, and invitations are unavailable."); }
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  render() {
    this.syncOpener();
    const readable = this.store.isReadable;
    const progress = this.store.progress;
    const delivered = new Set(progress.deliveries.map((delivery) => delivery.invitationId));
    const invitations = getInvitations();

    const reply = this.find("#invitation-reply");
    reply.hidden = !this.reply;
    if (this.reply) {
      const { invitation, band } = this.reply;
      this.find("#invitation-reply-from").textContent = `A note from ${invitation.from}`;
      const note = this.find("#invitation-reply-note");
      note.textContent = band.note;
      note.tabIndex = -1;
      const guestHost = this.find("#invitation-reply-guests");
      guestHost.replaceChildren(...this.guestButtons(invitation));
      const next = invitations.find((item) => item.opensAfter === invitation.id);
      this.find("#invitation-reply-next").textContent = next ? `New: “${next.title}” is open below. Your bowl is in the Garden.` : "Your bowl is in the Garden.";
    }

    const active = this.activeInvitation();
    const activeSection = this.find("#invitation-active");
    activeSection.hidden = !active;
    if (active) {
      this.find("#invitation-active-title").textContent = active.title;
      this.find("#invitation-active-brief").textContent = `${active.from}: “${active.brief}”`;
      this.find("#invitation-active-kit").textContent = `${this.actions.layoutLabel(active.layoutId)} · Left in your kit: ${this.kitText(active, this.actions.kitRemaining())}`;
      this.find<HTMLInputElement>("#invitation-name").placeholder = active.title;
      const viewing = this.actions.isViewing();
      const empty = this.actions.plantsInBowl() === 0;
      this.find<HTMLButtonElement>("#invitation-deliver").disabled = !readable || viewing || empty;
      this.find<HTMLButtonElement>("#invitation-set-aside").disabled = !readable || viewing;
      if (viewing) this.message("Return to your working bowl to deliver it.");
      else if (empty) this.message("Place a cutting from your kit before delivering.");
    }

    const list = this.find("#invitation-list");
    list.replaceChildren(...invitations.map((invitation) => this.card(invitation, delivered, readable, active)));
  }

  private guestButtons(invitation: Invitation): HTMLElement[] {
    const answers = this.guests.filter((guest) => guest.invitationId === invitation.id);
    if (!answers.length) return [];
    const heading = document.createElement("p");
    heading.className = "invitation-guests-heading";
    heading.textContent = answers.length === 1 ? "Another answer to the same request" : "Other answers to the same request";
    const buttons = answers.map((guest) => {
      const button = document.createElement("button");
      button.type = "button";
      const title = guest.backup.entries[0]?.title ?? "Guest arrangement";
      button.textContent = `${title} · ${guest.artist}`;
      button.setAttribute("aria-label", `View ${title} by ${guest.artist} in 3D`);
      button.addEventListener("click", () => this.run(() => { this.dialog.close(); this.actions.viewGuest(guest); }), { signal: this.controller.signal });
      return button;
    });
    return [heading, ...buttons];
  }

  private card(invitation: Invitation, delivered: ReadonlySet<string>, readable: boolean, active: Invitation | null): HTMLElement {
    const card = document.createElement("article");
    card.className = "invitation-card";
    card.dataset.invitation = invitation.id;
    const open = isInvitationOpen(invitation, delivered);
    const deliveries = this.store.progress.deliveries.filter((delivery) => delivery.invitationId === invitation.id);
    card.dataset.state = active?.id === invitation.id ? "active" : deliveries.length ? "answered" : open ? "open" : "waiting";

    const title = document.createElement("h3");
    title.textContent = invitation.title;
    const from = document.createElement("p");
    from.className = "eyebrow";
    from.textContent = invitation.from;
    card.append(title, from);

    if (!open) {
      const waiting = document.createElement("p");
      waiting.className = "panel-note";
      const previous = getInvitations().find((item) => item.id === invitation.opensAfter);
      waiting.textContent = `Opens after you answer “${previous?.title ?? "the one before"}”.`;
      card.append(waiting);
      return card;
    }

    const brief = document.createElement("p");
    brief.className = "invitation-brief";
    brief.textContent = `“${invitation.brief}”`;
    const meta = document.createElement("p");
    meta.className = "invitation-meta";
    meta.textContent = `${this.actions.layoutLabel(invitation.layoutId)} · Kit: ${this.kitText(invitation)}`;
    card.append(brief, meta);

    const latest = deliveries.at(-1);
    if (latest) {
      const answered = document.createElement("p");
      answered.className = "panel-note";
      const note = invitation.reading.bands.find((band) => band.id === latest.noteId)?.note;
      answered.textContent = `Answered ${deliveries.length === 1 ? "once" : `${deliveries.length} times`}. Last time: ${note ?? "delivered."}`;
      card.append(answered);
    }

    const buttons = document.createElement("div");
    buttons.className = "garden-actions";
    if (active?.id !== invitation.id) {
      const begin = document.createElement("button");
      begin.type = "button";
      begin.textContent = deliveries.length ? "Begin again" : "Begin";
      begin.setAttribute("aria-label", `${begin.textContent} · ${invitation.title}`);
      begin.disabled = !readable;
      begin.addEventListener("click", () => this.run(() => { this.dialog.close(); this.actions.begin(invitation); }), { signal: this.controller.signal });
      buttons.append(begin);
    }
    if (latest) {
      const look = document.createElement("button");
      look.type = "button";
      look.textContent = "Look at your answer";
      look.addEventListener("click", () => this.run(() => {
        this.dialog.close();
        if (!this.actions.viewKept(latest.gardenEntryId)) {
          this.open();
          this.message("That answer is no longer in your Garden.");
        }
      }), { signal: this.controller.signal });
      buttons.append(look);
      // Other answers appear once you have made your own.
      const guests = this.guestButtons(invitation);
      if (guests.length) {
        const host = document.createElement("div");
        host.className = "invitation-guests";
        host.append(...guests);
        card.append(buttons, host);
        return card;
      }
    }
    card.append(buttons);
    return card;
  }

  destroy() {
    this.controller.abort();
    this.dialog.closest(".invitations-host")?.remove();
  }
}

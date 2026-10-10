import type { BeginInvitation } from "./beginLines.ts";
import { BEGIN_EVENT_ATTRIBUTE, type BeginSurface } from "./beginStudy.ts";

export interface BeginOfferView {
  surface: BeginSurface;
  text: string;
  accept: string;
  another: string;
}

/**
 * The offer and the occasion note. Both stay in the document when hidden so
 * the last event attribute can still be read.
 */
export class BeginCard {
  readonly offer: HTMLElement;
  readonly note: HTMLElement;
  private readonly copy: HTMLElement;
  private readonly accept: HTMLButtonElement;
  private readonly another: HTMLButtonElement;
  private readonly stopBlock: HTMLElement;
  private readonly noteToggle: HTMLButtonElement;
  private readonly notePanel: HTMLElement;
  private readonly noteCopy: HTMLElement;
  private readonly presentation: HTMLButtonElement;

  constructor(parent: HTMLElement, signal: AbortSignal, handlers: {
    begin(surface: BeginSurface): void;
    another(surface: BeginSurface): void;
    notNow(surface: BeginSurface): void;
    stop(): void;
    toggleNote(): void;
    presentation(): void;
  }) {
    const stack = document.createElement("div");
    stack.className = "begin-stack";
    this.offer = document.createElement("aside");
    this.offer.id = "begin-offer";
    this.offer.className = "begin-offer";
    this.offer.hidden = true;
    this.offer.dataset.testid = "begin-offer";
    this.offer.setAttribute(BEGIN_EVENT_ATTRIBUTE, "");
    this.offer.innerHTML = `
      <div class="begin-stop" hidden>
        <p>This one is kept. You can stop here.</p>
        <button type="button" id="begin-stop">Stop here</button>
      </div>
      <div class="begin-choice">
        <p id="begin-copy"></p>
        <div class="begin-actions">
          <button type="button" id="begin-accept"></button>
          <button type="button" id="begin-another"></button>
          <button type="button" id="begin-dismiss">Not now</button>
        </div>
      </div>`;
    this.note = document.createElement("aside");
    this.note.id = "begin-note";
    this.note.className = "begin-note";
    this.note.hidden = true;
    this.note.dataset.testid = "begin-note";
    this.note.setAttribute("aria-label", "The occasion");
    this.note.innerHTML = `
      <button type="button" id="begin-note-toggle" aria-expanded="false"></button>
      <div id="begin-note-panel" hidden>
        <p id="begin-note-copy"></p>
        <button type="button" id="begin-presentation" hidden></button>
      </div>`;
    stack.append(this.offer, this.note);
    parent.append(stack);
    this.copy = this.offer.querySelector<HTMLElement>("#begin-copy")!;
    this.accept = this.offer.querySelector<HTMLButtonElement>("#begin-accept")!;
    this.another = this.offer.querySelector<HTMLButtonElement>("#begin-another")!;
    this.stopBlock = this.offer.querySelector<HTMLElement>(".begin-stop")!;
    this.noteToggle = this.note.querySelector<HTMLButtonElement>("#begin-note-toggle")!;
    this.notePanel = this.note.querySelector<HTMLElement>("#begin-note-panel")!;
    this.noteCopy = this.note.querySelector<HTMLElement>("#begin-note-copy")!;
    this.presentation = this.note.querySelector<HTMLButtonElement>("#begin-presentation")!;
    const on = (element: HTMLElement, action: () => void) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        action();
      }, { signal });
    };
    on(this.accept, () => handlers.begin(this.surface()));
    on(this.another, () => handlers.another(this.surface()));
    on(this.offer.querySelector<HTMLButtonElement>("#begin-dismiss")!, () => handlers.notNow(this.surface()));
    on(this.offer.querySelector<HTMLButtonElement>("#begin-stop")!, () => handlers.stop());
    on(this.noteToggle, () => handlers.toggleNote());
    on(this.presentation, () => handlers.presentation());
  }

  surface(): BeginSurface {
    return this.offer.dataset.surface === "after-keep" ? "after-keep" : "opening";
  }

  setToken(token: string) {
    this.offer.setAttribute(BEGIN_EVENT_ATTRIBUTE, token);
    this.note.setAttribute(BEGIN_EVENT_ATTRIBUTE, token);
  }

  showOffer(view: BeginOfferView) {
    this.offer.hidden = false;
    this.offer.dataset.surface = view.surface;
    this.offer.setAttribute("aria-label", view.surface === "after-keep" ? "After keeping" : "A starting offer");
    this.stopBlock.hidden = view.surface !== "after-keep";
    this.copy.textContent = view.text;
    this.accept.textContent = view.accept;
    this.another.textContent = view.another;
  }

  hideOffer() {
    this.offer.hidden = true;
  }

  showNote(invitation: BeginInvitation, collapsed: boolean) {
    this.note.hidden = false;
    this.noteToggle.textContent = collapsed ? invitation.summary : "Close";
    this.noteToggle.setAttribute("aria-expanded", String(!collapsed));
    this.noteToggle.setAttribute("aria-label", collapsed ? `Open the note: ${invitation.summary}` : "Close the note");
    this.notePanel.hidden = collapsed;
    this.noteCopy.textContent = invitation.text;
    if (invitation.presentation) {
      this.presentation.hidden = false;
      this.presentation.textContent = invitation.presentation.label;
    } else {
      this.presentation.hidden = true;
    }
  }

  hideNote() {
    this.note.hidden = true;
  }
}

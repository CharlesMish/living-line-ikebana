import "./studioMenus.css";

/** Labels/grouping only: keeps real handlers, disclosure state and approved checks. */
export function installStudioMenus(root: HTMLElement) {
  root.dataset.studioMenus = "true";
  const more = root.querySelector<HTMLButtonElement>("#more-toggle")!;
  more.querySelector("span")!.textContent = "Studio";
  more.setAttribute("aria-label", "Studio — Vessel, Photograph, Garden and Guide");
  const hint = document.createElement("small"); hint.className = "studio-destinations";
  hint.innerHTML = "<span>Vessel ·</span> <span>Photo</span>"; more.append(hint);
  const views = root.querySelector<HTMLElement>("#view-options")!;
  root.querySelector("#view-toggle span")!.textContent = "Angles";
  root.querySelector("#view-toggle")!.setAttribute("aria-label", "Angles — preset views and stem checks");
  views.setAttribute("aria-label", "Preset angles and stem checks");
  const heading = (label: string) => { const h = document.createElement("p"); h.className = "studio-menu-heading"; h.textContent = label; return h; };
  views.prepend(heading("Preset angles"));
  views.insertBefore(heading("Stem checks"), root.querySelector("#stem-overlaps-toggle"));
  const checksNote = document.createElement("p"); checksNote.className = "studio-menu-note";
  checksNote.textContent = "Inspection marks contacts. Protection can stop planting or movement.";
  views.insertBefore(checksNote, root.querySelector("#stem-overlaps-toggle"));
  const menu = root.querySelector<HTMLElement>("#more-options")!;
  menu.setAttribute("aria-label", "Vessel, Photograph, Garden and Guide");
  const vessel = root.querySelector<HTMLButtonElement>("#vessel-appearance-open")!;
  const photo = root.querySelector<HTMLButtonElement>("#photo-open")!;
  const note = document.createElement("span"); note.textContent = "Background, perch and image"; photo.append(note);
  menu.prepend(heading("Set the scene"), vessel, photo, heading("Keep and learn"));
  const layout = root.querySelector<HTMLSelectElement>("#vessel-layout")!;
  const currentLayout = layout.value;
  const options = [...layout.options];
  layout.replaceChildren();
  for (const [label, ids] of [
    ["Small pinbeds", ["pinbed-small", "pinbed-single", "vessel-pair"]],
    ["Medium pinbeds", ["pinbed-medium-oval", "petite"]],
    ["Other current options", ["original", "compact", "offset", "islands", "long-bed"]],
  ] as const) {
    const group = document.createElement("optgroup"); group.label = label;
    for (const id of ids) { const option = options.find(item => item.value === id); if (option) group.append(option); }
    layout.append(group);
  }
  layout.value = currentLayout;
}

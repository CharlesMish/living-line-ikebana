import "./styles.css";
import { IkebanaApp } from "./app/IkebanaApp";

const mount = document.querySelector<HTMLElement>("#app");
if (!mount) throw new Error("Missing #app mount");

let app: IkebanaApp | undefined;
try {
  app = new IkebanaApp(mount);
  app.start();
} catch (error) {
  try { app?.dispose(); } catch { /* The startup explanation must still appear. */ }
  console.error("Living Line could not start.", error);
  mount.dataset.ready = "false";
  const panel = document.createElement("section");
  panel.className = "startup-message";
  panel.setAttribute("role", "alert");
  const title = document.createElement("h1");
  title.textContent = "The studio could not open.";
  const note = document.createElement("p");
  note.textContent = "Living Line needs WebGL graphics. Try reloading, or open it in a browser with graphics acceleration enabled. Your saved arrangement has not been changed.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => window.location.reload());
  panel.append(title, note, retry);
  mount.replaceChildren(panel);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app?.dispose());
}

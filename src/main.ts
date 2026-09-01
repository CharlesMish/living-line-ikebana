import "./styles.css";
import { IkebanaApp } from "./app/IkebanaApp";

const mount = document.querySelector<HTMLElement>("#app");
if (!mount) throw new Error("Missing #app mount");

const app = new IkebanaApp(mount);
app.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}

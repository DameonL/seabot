import { render } from "preact";
import Main from "./Main";

const root = document.createElement("div");
document.body.appendChild(root);
render(Main(), root);
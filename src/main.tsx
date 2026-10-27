import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// NOTE: LanguageProvider lives inside App.tsx — mounting it twice created two
// independent language contexts and doubled the initial render work.
const root = document.getElementById("root");
if (!root) throw new Error("Application root element is missing");
createRoot(root).render(<App />);

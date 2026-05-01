import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./sw/register";

createRoot(document.getElementById("root")!).render(<App />);

const scheduleServiceWorkerRegistration = () => {
  if (typeof window === "undefined") return;

  const register = () => {
    void registerServiceWorker();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(register, { timeout: 2500 });
    return;
  }

  window.setTimeout(register, 1500);
};

// Register the service worker on idle so first paint keeps priority.
scheduleServiceWorkerRegistration();

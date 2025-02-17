import React from "react";
import { createRoot } from "react-dom/client";

import { AppContext } from "./lib/context";
import "./styles/index.scss";
import Root from "./views/Root";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppContext.Provider value={{ portalTarget: document.getElementById("portal-target") as HTMLDivElement }}>
      <Root />
    </AppContext.Provider>
  </React.StrictMode>,
);

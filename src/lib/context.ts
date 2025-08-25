import { Dispatch, SetStateAction, createContext } from "react";
import Sigma from "sigma";

import { ModalName } from "../views/modals";
import { ComputedData } from "./computedData";
import { Data } from "./data";
import { NavState } from "./navState";

export const PANELS = ["main", "readability"] as const;
export type Panel = (typeof PANELS)[number];

export const AppContext = createContext<{ portalTarget: HTMLDivElement }>({
  portalTarget: document.createElement("div"),
});

type GraphContextType = {
  embedMode: boolean;
  data: Data;
  graphFile: {
    name: string;
    extension: string;
    textContent: string;
  };

  isPanelExpanded: boolean;
  setIsPanelExpanded: (isPanelExpanded: boolean) => void;

  showEditionPanel: boolean;
  setShowEditionPanel: Dispatch<SetStateAction<boolean>>;
  showEdgePanel: boolean;
  setShowEdgePanel: Dispatch<SetStateAction<boolean>>;

  navState: NavState;
  computedData: ComputedData;
  hovered: string | Set<string> | undefined;

  setNavState: (newNavState: NavState) => void;
  setHovered: (hovered?: string | Set<string>) => void;

  panel: Panel;
  setPanel: (panel: Panel) => void;

  modal: ModalName | undefined;
  openModal: (modal: ModalName) => void;
  closeModal: () => void;

  sigma: Sigma | undefined;
  setSigma: (sigma: Sigma | undefined) => void;
  root: HTMLElement | undefined;
};
export const GraphContext = createContext<GraphContextType>(
  // "Fake" initial value (proper value will be given by Provider)
  null as unknown as GraphContextType
);

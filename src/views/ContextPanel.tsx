import cx from "classnames";
import React, { FC, JSX, useContext, useMemo } from "react";
import { FaHome } from "react-icons/fa";
import { MdOutlinePreview } from "react-icons/md";
import { VscSettings } from "react-icons/vsc";
import { Link } from "react-router-dom";

import Footer from "../components/Footer";
import { GraphContext } from "../lib/context";
import Filters from "./Filters";
import GraphSumUp from "./GraphSumUp";
import NodesAppearanceBlock from "./NodesAppearanceBlock";
import ReadabilityBlock from "./ReadabilityBlock";
import SelectedNodePanel from "./SelectedNodePanel";

const ContextPanel: FC = () => {
  const { navState, data, panel, setPanel } = useContext(GraphContext);

  const selectedNode = useMemo(
    () =>
      navState?.selectedNode && data?.graph.hasNode(navState.selectedNode)
        ? data.graph.getNodeAttributes(navState.selectedNode)
        : null,
    [data?.graph, navState?.selectedNode],
  );

  let content: JSX.Element;
  if (panel === "readability") {
    content = <ReadabilityBlock />;
  } else if (selectedNode) {
    content = <SelectedNodePanel node={navState?.selectedNode as string} data={selectedNode} />;
  } else {
    content = (
      <>
        <GraphSumUp />
        <NodesAppearanceBlock />
        <Filters />
      </>
    );
  }

  const selectedButtonClass = "btn-dark opacity-100";

  return (
    <section className="side-panel context-panel d-flex flex-column">
      <div className="panel-header border-dark">
        <div className="header-buttons text-end block p-3">
          <span className="text-nowrap">
            <button
              className={cx("btn ms-2 mt-1", panel === "main" ? selectedButtonClass : "btn-outline-dark")}
              onClick={() => setPanel("main")}
              disabled={panel === "main"}
            >
              <MdOutlinePreview /> Explore
            </button>
            <button
              className={cx("btn ms-2 mt-1", panel === "readability" ? selectedButtonClass : "btn-outline-dark")}
              onClick={() => setPanel("readability")}
              disabled={panel === "readability"}
            >
              <VscSettings /> Settings
            </button>
          </span>
          <span className="text-nowrap">
            {/*
            {!embedMode && (
              <button
                className={cx("btn btn-outline-dark ms-2 mt-1", !!navState.local && "text-danger")}
                title="Share this visualization"
                onClick={() => openModal(navState.local ? "publish" : "share")}
              >
                <BsShare />
              </button>
            )}
            */}
            <Link className="btn btn-outline-dark ms-2 mt-1" title="Retina's homepage" to="/">
              <FaHome />
            </Link>
          </span>
        </div>
      </div>

      <div className="panel-content">
        <div className="flex-grow-1 p-0 m-0">{content}</div>

        <hr className="m-0 flex-shrink-0" />
        <div className="flex-shrink-0">
          <Footer />
        </div>
      </div>
    </section>
  );
};

export default ContextPanel;

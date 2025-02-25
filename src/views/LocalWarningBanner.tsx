import React, { FC, useContext } from "react";
import { AiFillQuestionCircle } from "react-icons/ai";

import { GraphContext } from "../lib/context";
import { queryURLToNavState } from "../lib/navState";
import { useBlocker } from "../utils/useBlocker";

const LocalWarningBanner: FC = () => {
  const { navState, openModal } = useContext(GraphContext);

  useBlocker((tx) => {
    const newNavState = queryURLToNavState(tx.location.search);

    if (
      navState.preventBlocker ||
      !!navState.local === !!newNavState.local ||
      window.confirm(
        "You are working on a local file, and you cannot share your visualizations yet. Are you sure you want to leave that page?",
      )
    )
      tx.retry();
  }, navState.local);

  return (
    <>
      {navState.local && (
        <div className="bg-warning text-center d-flex flex-column p-2 border-bottom border-dark align-items-stretch text-md-start flex-md-row align-items-md-center">
          <div className="flex-grow-1">
            <div>
              You are currently using a <strong>local file</strong>, that only <strong>you</strong> can access.
            </div>
            <div>
              To be able to share your visualizations online, you need to first{" "}
              <strong>publish your graph file online</strong>.
            </div>
          </div>
          <button className="btn btn-outline-dark ms-md-2 flex-shrink-0" onClick={() => openModal("publish")}>
            <AiFillQuestionCircle /> Publish the graph online
          </button>
        </div>
      )}
    </>
  );
};

export default LocalWarningBanner;

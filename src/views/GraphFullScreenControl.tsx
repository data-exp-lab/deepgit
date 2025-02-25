import React, { FC, useCallback, useContext, useEffect, useState } from "react";
import { BsArrowsFullscreen, BsFullscreenExit } from "react-icons/bs";

import { GraphContext } from "../lib/context";

function toggleFullScreen(dom: HTMLElement) {
  if (!document.fullscreenEnabled) return;

  if (document.fullscreenElement !== dom) {
    dom.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

const GraphFullScreenControl: FC = () => {
  const { root } = useContext(GraphContext);

  const [isFullScreen, setFullScreen] = useState<boolean>(false);
  const refreshState = useCallback(() => {
    const isFullScreen = !!root && document.fullscreenElement === root;
    setFullScreen(isFullScreen);
  }, [root]);

  useEffect(() => {
    document.addEventListener("fullscreenchange", refreshState);
    return () => document.removeEventListener("fullscreenchange", refreshState);
  }, [refreshState]);

  if (!document.fullscreenEnabled) return null;

  return (
    <button
      className="btn btn-outline-dark graph-button"
      title="Toggle full screen"
      onClick={() => !!root && toggleFullScreen(root)}
    >
      {isFullScreen ? <BsFullscreenExit /> : <BsArrowsFullscreen />}
    </button>
  );
};

export default GraphFullScreenControl;

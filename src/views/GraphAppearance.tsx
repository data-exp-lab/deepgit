import { useSigma } from "@react-sigma/core";
import React, { FC, useContext, useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "sigma/settings";

import { LoaderFill } from "../components/Loader";
import { DEFAULT_LABEL_THRESHOLD } from "../lib/consts";
import { GraphContext } from "../lib/context";
import {
  applyEdgeColors,
  applyEdgeDirections,
  applyEdgeSizes,
  applyNodeColors,
  applyNodeLabelSizes,
  applyNodeSizes,
  applyNodeSubtitles,
  getReducers,
} from "../lib/graph";
import drawLabel, { drawHover } from "../utils/canvas";
import { inputToStateThreshold } from "../utils/threshold";

const GraphAppearance: FC = () => {
  const { data, navState, computedData, setSigma, hovered } = useContext(GraphContext);
  const {
    nodeSizeField,
    minLabelSize,
    maxLabelSize,
    subtitleFields,
    nodeSizeRatio,
    edgeSizeRatio,
    edgeColoring,
    edgeDirection,
  } = navState;
  const labelThreshold = inputToStateThreshold(navState.labelThresholdRatio || DEFAULT_LABEL_THRESHOLD);
  const { nodeColors, nodeSizes, edgeSizes, nodeSizeExtents } = computedData;
  const sigma = useSigma();

  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    setSigma(sigma);
    sigma.setSetting("defaultDrawNodeLabel", (context, data, settings) =>
      drawLabel(context, { ...sigma.getNodeDisplayData(data.key), ...data }, settings),
    );
    sigma.setSetting("defaultDrawNodeHover", (context, data, settings) =>
      drawHover(context, { ...sigma.getNodeDisplayData(data.key), ...data }, settings),
    );

    return () => setSigma(undefined);
  }, [sigma, setSigma]);

  useEffect(() => {
    const { node, edge } = getReducers(data, navState, computedData, hovered);
    sigma.setSetting("nodeReducer", node);
    sigma.setSetting("edgeReducer", edge);
    setIsRendered(true);
  }, [data, navState, computedData, hovered, sigma]);

  useEffect(() => {
    const labelDensity = labelThreshold === 0 ? Infinity : DEFAULT_SETTINGS.labelDensity;
    sigma.setSetting("labelRenderedSizeThreshold", labelThreshold);
    sigma.setSetting("labelDensity", labelDensity);
  }, [labelThreshold, sigma]);

  useEffect(() => {
    applyNodeColors(data, { nodeColors });
  }, [sigma, data, nodeColors]);

  useEffect(() => {
    applyNodeSizes(data, { nodeSizes }, { nodeSizeRatio });
  }, [sigma, data, nodeSizeRatio, nodeSizes]);

  useEffect(() => {
    applyNodeLabelSizes(data, { nodeSizeExtents }, { nodeSizeField, minLabelSize, maxLabelSize });
  }, [sigma, data, nodeSizeField, minLabelSize, maxLabelSize, nodeSizeExtents]);

  useEffect(() => {
    applyNodeSubtitles(data, { subtitleFields });
  }, [sigma, data, subtitleFields]);

  useEffect(() => {
    applyEdgeColors(data, { nodeColors }, { edgeColoring });
  }, [sigma, data, nodeColors, edgeColoring]);

  useEffect(() => {
    applyEdgeDirections(data, { edgeDirection });
  }, [sigma, data, edgeDirection]);

  useEffect(() => {
    applyEdgeSizes(data, { edgeSizes }, { edgeSizeRatio });
  }, [sigma, data, edgeSizes, edgeSizeRatio]);

  return isRendered ? null : <LoaderFill />;
};

export default GraphAppearance;

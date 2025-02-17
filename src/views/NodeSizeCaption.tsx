import { useSigma } from "@react-sigma/core";
import { FC, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { GraphContext } from "../lib/context";
import { shortenNumber } from "../utils/number";

const NodeSizeCaption: FC = () => {
  const { navState, data, computedData } = useContext(GraphContext);

  const { nodeSizeField } = navState;
  const { fieldsIndex } = data;
  const { getSize, nodeSizeExtents } = computedData;
  const sigma = useSigma();

  const sizeField = useMemo(
    () => (nodeSizeField ? fieldsIndex[nodeSizeField] : undefined),
    [fieldsIndex, nodeSizeField],
  );
  const [state, setState] = useState<{
    minValue: number;
    minRadius: number;
    maxValue: number;
    maxRadius: number;
  } | null>(null);

  const refreshState = useCallback(() => {
    if (!sigma || !sizeField || !nodeSizeExtents || !getSize) return null;

    const ratio = Math.sqrt(sigma.getCamera().ratio);

    setState({
      minValue: nodeSizeExtents[0],
      minRadius: getSize(nodeSizeExtents[0]) / ratio,
      maxValue: nodeSizeExtents[1],
      maxRadius: getSize(nodeSizeExtents[1]) / ratio,
    });
  }, [getSize, sigma, nodeSizeExtents, sizeField]);

  // Refresh caption when metric changes:
  useEffect(() => {
    refreshState();
  }, [nodeSizeExtents, sizeField, getSize, refreshState]);

  // Refresh caption on camera update:
  useEffect(() => {
    sigma.getCamera().addListener("updated", refreshState);
    return () => {
      sigma.getCamera().removeListener("updated", refreshState);
    };
  }, [nodeSizeExtents, sizeField, getSize, sigma, refreshState]);

  if (!sizeField || !state) return null;

  return (
    <div className="size-caption">
      <h4 className="fs-6">{sizeField.label}:</h4>
      <div className="nodes">
        <div>
          <div className="circle-wrapper">
            <div className="dotted-circle" style={{ width: state.minRadius * 2, height: state.minRadius * 2 }} />
          </div>
          <div className="caption text-center">{shortenNumber(state.minValue)}</div>
        </div>
        <div className="ms-2">
          <div className="circle-wrapper">
            <div className="dotted-circle" style={{ width: state.maxRadius * 2, height: state.maxRadius * 2 }} />
          </div>
          <div className="caption text-center">{shortenNumber(state.maxValue)}</div>
        </div>
      </div>
    </div>
  );
};

export default NodeSizeCaption;

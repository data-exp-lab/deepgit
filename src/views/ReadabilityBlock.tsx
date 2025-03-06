import cx from "classnames";
import { isEqual } from "lodash";
import Slider, { SliderProps } from "rc-slider";
import React, { FC, useContext, useState } from "react";
import { FaTimes, FaUndo } from "react-icons/fa";
import { FaGear } from "react-icons/fa6";
import { VscSettings } from "react-icons/vsc";

import {
  DEFAULT_EDGE_SIZE_RATIO,
  DEFAULT_LABEL_SIZE,
  DEFAULT_LABEL_THRESHOLD,
  DEFAULT_NODE_SIZE_RATIO,
  LABEL_SIZE_STEP,
  LABEL_THRESHOLD_STEP,
  MAX_LABEL_SIZE,
  MAX_LABEL_THRESHOLD,
  MAX_NODE_SIZE_RATIO,
  MIN_LABEL_SIZE,
  MIN_LABEL_THRESHOLD,
  MIN_NODE_SIZE_RATIO,
  NODE_SIZE_RATIO_STEP,
  RANGE_STYLE,
  SLIDER_STYLE,
} from "../lib/consts";
import { GraphContext } from "../lib/context";
import { NavState } from "../lib/navState";

const ReadabilityBlock: FC = () => {
  // const { navState, setNavState } = useContext(GraphContext);
  const { navState, setNavState, showEditionPanel, setShowEditionPanel } = useContext(GraphContext);
  const [initialNavState] = useState<NavState>(navState);

  const minLabelSize = typeof navState.minLabelSize === "number" ? navState.minLabelSize : DEFAULT_LABEL_SIZE;
  const maxLabelSize = typeof navState.maxLabelSize === "number" ? navState.maxLabelSize : DEFAULT_LABEL_SIZE;
  const nodeSizeRatio = typeof navState.nodeSizeRatio === "number" ? navState.nodeSizeRatio : DEFAULT_NODE_SIZE_RATIO;
  const edgeSizeRatio = typeof navState.edgeSizeRatio === "number" ? navState.edgeSizeRatio : DEFAULT_EDGE_SIZE_RATIO;
  const labelThresholdRatio =
    typeof navState.labelThresholdRatio === "number" ? navState.labelThresholdRatio : DEFAULT_LABEL_THRESHOLD;

  const cancel = () => setNavState(initialNavState);

  return (
    <div className="readability-block block">
      <h1 className="fs-4 mt-4">
        <VscSettings /> Settings
      </h1>

      <br />

      <div className="d-flex flex-row mt-1">
        <button
          type="button"
          className="btn btn-outline-dark flex-grow-1 me-1"
          onClick={cancel}
          disabled={isEqual(navState, initialNavState)}
        >
          <FaUndo /> Cancel modifications
        </button>

        {navState.role !== "v" && (
          <button
            type="button"
            className="btn btn-outline-dark flex-grow-1"
            disabled={navState.role === "d"}
            onClick={() => {
              // Toggle the edition panel
              setShowEditionPanel(!showEditionPanel);
              // Also set the role if needed
              setNavState({
                ...navState,
                role: "d",
              });
            }}
          >
            <FaGear /> Configure this graph for DeepGit
          </button>
        )}
      </div>

      <br />

      <div className="mb-3">
        <h3 className="fs-6 form-label with-end-buttons">
          <label>
            Label sizes <small>(select min and max)</small>
          </label>
          <button
            className={cx(
              "btn btn-ico btn-sm btn-outline-dark",
              typeof navState.minLabelSize !== "number" && typeof navState.maxLabelSize !== "number" && "hidden",
            )}
            disabled={typeof navState.minLabelSize !== "number" && typeof navState.maxLabelSize !== "number"}
            onClick={() => setNavState({ ...navState, minLabelSize: undefined, maxLabelSize: undefined })}
          >
            <FaTimes /> Restore default
          </button>
        </h3>
        <div className="pb-3">
          <Slider
            range
            value={[minLabelSize, maxLabelSize]}
            min={MIN_LABEL_SIZE}
            max={MAX_LABEL_SIZE}
            step={LABEL_SIZE_STEP}
            marks={{
              [MIN_LABEL_SIZE]: MIN_LABEL_SIZE,
              [MAX_LABEL_SIZE]: MAX_LABEL_SIZE,
              [minLabelSize]: minLabelSize,
              [maxLabelSize]: maxLabelSize,
            }}
            onChange={
              (([minLabelSize, maxLabelSize]: number[]) => {
                setNavState({ ...navState, minLabelSize, maxLabelSize });
              }) as SliderProps["onChange"]
            }
            // Styles:
            {...RANGE_STYLE}
          />
        </div>
      </div>

      <div className="mb-3">
        <h3 className="fs-6 form-label with-end-buttons">
          <label>Node sizes</label>
          <button
            className={cx(
              "btn btn-ico btn-sm btn-outline-dark",
              typeof navState.nodeSizeRatio !== "number" && "hidden",
            )}
            disabled={typeof navState.nodeSizeRatio !== "number"}
            onClick={() => setNavState({ ...navState, nodeSizeRatio: undefined })}
          >
            <FaTimes /> Restore default
          </button>
        </h3>
        <div className="pb-3">
          <Slider
            value={nodeSizeRatio}
            min={MIN_NODE_SIZE_RATIO}
            max={MAX_NODE_SIZE_RATIO}
            step={NODE_SIZE_RATIO_STEP}
            marks={{
              [MIN_NODE_SIZE_RATIO]: MIN_NODE_SIZE_RATIO,
              [MAX_NODE_SIZE_RATIO]: MAX_NODE_SIZE_RATIO,
              [nodeSizeRatio]: nodeSizeRatio,
            }}
            onChange={
              ((v: number) => {
                setNavState({ ...navState, nodeSizeRatio: v });
              }) as SliderProps["onChange"]
            }
            // Styles:
            {...SLIDER_STYLE}
          />
        </div>
      </div>

      <div className="mb-3">
        <h3 className="fs-6 form-label with-end-buttons">
          <label>Edge sizes</label>
          <button
            className={cx(
              "btn btn-ico btn-sm btn-outline-dark",
              typeof navState.edgeSizeRatio !== "number" && "hidden",
            )}
            disabled={typeof navState.edgeSizeRatio !== "number"}
            onClick={() => setNavState({ ...navState, edgeSizeRatio: undefined })}
          >
            <FaTimes /> Restore default
          </button>
        </h3>
        <div className="pb-3">
          <Slider
            value={edgeSizeRatio}
            min={MIN_NODE_SIZE_RATIO}
            max={MAX_NODE_SIZE_RATIO}
            step={NODE_SIZE_RATIO_STEP}
            marks={{
              [MIN_NODE_SIZE_RATIO]: MIN_NODE_SIZE_RATIO,
              [MAX_NODE_SIZE_RATIO]: MAX_NODE_SIZE_RATIO,
              [edgeSizeRatio]: edgeSizeRatio,
            }}
            onChange={
              ((v: number) => {
                setNavState({ ...navState, edgeSizeRatio: v });
              }) as SliderProps["onChange"]
            }
            // Styles:
            {...SLIDER_STYLE}
          />
        </div>
      </div>

      <div className="mb-3">
        <h3 className="fs-6 form-label with-end-buttons">
          <label>Labels on screen</label>
          <button
            className={cx(
              "btn btn-ico btn-sm btn-outline-dark",
              typeof navState.labelThresholdRatio !== "number" && "hidden",
            )}
            disabled={typeof navState.labelThresholdRatio !== "number"}
            onClick={() => setNavState({ ...navState, labelThresholdRatio: undefined })}
          >
            <FaTimes /> Restore default
          </button>
        </h3>
        <div className="pb-3">
          <Slider
            value={labelThresholdRatio}
            min={MIN_LABEL_THRESHOLD}
            max={MAX_LABEL_THRESHOLD}
            step={LABEL_THRESHOLD_STEP}
            marks={{
              [MIN_LABEL_THRESHOLD]: {
                label: "(less labels)",
                style: {
                  transform: "translateX(0)",
                },
              },
              [MAX_LABEL_THRESHOLD]: {
                label: "(more labels)",
                style: {
                  whiteSpace: "nowrap",
                  transform: "translateX(-100%)",
                },
              },
            }}
            onChange={
              ((v: number) => {
                setNavState({ ...navState, labelThresholdRatio: v });
              }) as SliderProps["onChange"]
            }
            // Styles:
            {...SLIDER_STYLE}
          />
        </div>
      </div>
    </div>
  );
};

export default ReadabilityBlock;

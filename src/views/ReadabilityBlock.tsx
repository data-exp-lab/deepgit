import cx from "classnames";
import { isEqual, keyBy, uniqBy } from "lodash";
import Slider, { SliderProps } from "rc-slider";
import React, { FC, useContext, useState, useMemo } from "react";
import { FaTimes, FaUndo } from "react-icons/fa";
import { FaGear, FaNetworkWired } from "react-icons/fa6";
import { VscSettings } from "react-icons/vsc";
import Select from "react-select";

import {
  DEFAULT_LABEL_SIZE,
  DEFAULT_LABEL_THRESHOLD,
  LABEL_SIZE_STEP,
  LABEL_THRESHOLD_STEP,
  MAX_LABEL_SIZE,
  MAX_LABEL_THRESHOLD,
  MIN_LABEL_SIZE,
  MIN_LABEL_THRESHOLD,
  RANGE_STYLE,
  SLIDER_STYLE,
  DEFAULT_SELECT_PROPS,
} from "../lib/consts";
import { GraphContext } from "../lib/context";
import { NavState } from "../lib/navState";

interface Option {
  value: string;
  label: string;
  field?: string;
}

const ReadabilityBlock: FC = () => {
  // const { navState, setNavState } = useContext(GraphContext);
  const { navState, setNavState, setShowEditionPanel, setShowEdgePanel, data } = useContext(GraphContext);
  const [initialNavState] = useState<NavState>(navState);

  const minLabelSize = typeof navState.minLabelSize === "number" ? navState.minLabelSize : DEFAULT_LABEL_SIZE;
  const maxLabelSize = typeof navState.maxLabelSize === "number" ? navState.maxLabelSize : DEFAULT_LABEL_SIZE;
  const labelThresholdRatio =
    typeof navState.labelThresholdRatio === "number" ? navState.labelThresholdRatio : DEFAULT_LABEL_THRESHOLD;

  const { fields, fieldsIndex } = data;

  const subtitleOptions: Option[] = useMemo(
    () =>
      uniqBy(
        fields.map((key) => {
          const field = fieldsIndex[key];
          return {
            value: `${key}-field`,
            label: field.label,
            field: key,
          };
        }),
        ({ field }) => fieldsIndex[field].rawFieldId,
      ),
    [fields, fieldsIndex],
  );
  const optionsIndex = keyBy(subtitleOptions, "field");
  const selectedOptions = (navState.subtitleFields || []).map((f) => optionsIndex[f]);

  const cancel = () => setNavState(initialNavState);

  return (
    <div className="readability-block block">
      <h1 className="fs-4 mt-4">
        <VscSettings /> Settings
      </h1>

      <br />

      <div className="d-flex flex-row mt-1">
        {navState.role !== "v" && (
          <>
            <button
              type="button"
              className="btn btn-outline-dark flex-grow-1 me-1"
              disabled={navState.role === "d"}
              onClick={() => {
                // Close edge panel if open, then open edition panel
                setShowEdgePanel(false);
                setShowEditionPanel(true);
                // Set the role if needed
                setNavState({
                  ...navState,
                  role: "d",
                });
              }}
            >
              <FaGear /> Configure Explore
            </button>
            <button
              type="button"
              className="btn btn-outline-dark flex-grow-1 me-1"
              disabled={navState.role === "d"}
              onClick={() => {
                // Close edition panel if open, then open edge panel
                setShowEditionPanel(false);
                setShowEdgePanel(true);
                // Set the role if needed
                setNavState({
                  ...navState,
                  role: "d",
                });
              }}
            >
              <FaNetworkWired /> Configure Edge
            </button>
          </>
        )}
      </div>

      <div className="d-flex flex-row mt-1">
        <button
          type="button"
          className="btn btn-outline-dark flex-grow-1"
          onClick={cancel}
          disabled={isEqual(navState, initialNavState)}
        >
          <FaUndo /> Cancel modifications
        </button>
      </div>

      <br />

      <div className="mb-3">
        <h3 className="fs-6 form-label with-end-buttons">
          <label>Which node information should show up on hovered nodes?</label>
          <button
            className={cx(
              "btn btn-ico btn-sm btn-outline-dark",
              !navState.subtitleFields?.length && "hidden",
            )}
            disabled={!navState.subtitleFields?.length}
            onClick={() => setNavState({ ...navState, subtitleFields: [] })}
          >
            <FaTimes /> Restore default
          </button>
        </h3>
        <div className="pb-3" style={{ marginBottom: '2rem' }}>
          <Select
            {...DEFAULT_SELECT_PROPS}
            isMulti
            className="text-black"
            options={subtitleOptions}
            value={selectedOptions}
            onChange={(v) => setNavState({ ...navState, subtitleFields: v.map((o) => o.field) as string[] })}
            isDisabled={subtitleOptions.length < 1}
            placeholder="Select fields..."
          />
        </div>
      </div>

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

      {/* <div className="mb-3">
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
      </div> */}

      {/* <div className="mb-3">
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
      </div> */}

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

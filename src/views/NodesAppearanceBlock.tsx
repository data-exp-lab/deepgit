import cx from "classnames";
import React, { FC, useContext } from "react";
import { BsPaletteFill } from "react-icons/bs";
import { MdBubbleChart } from "react-icons/md";
import Select from "react-select";

import { DEFAULT_SELECT_PROPS } from "../lib/consts";
import { AppContext, GraphContext } from "../lib/context";

interface Option {
  value: string;
  label: string;
  field?: string;
}

const NodesAppearanceBlock: FC = () => {
  const { portalTarget } = useContext(AppContext);
  const { navState, data, setNavState } = useContext(GraphContext);
  const { fieldsIndex } = data;
  const { role, nodeColorField, nodeSizeField, colorable, sizeable, disableDefaultColor, disableDefaultSize } =
    navState;

  // console.log("NodesAppearanceBlock render:", {
  //   data: !!data,
  //   fieldsIndex: !!fieldsIndex,
  //   sizeable,
  //   disableDefaultSize,
  //   role,
  //   nodeSizeField
  // });

  const colorOptions: Option[] = [
    ...(disableDefaultColor ? [] : [{ value: "none", label: "Default (use colors from the graph file)" }]),
    ...(colorable || []).map((key) => {
      const field = fieldsIndex[key];
      return {
        value: `${key}-field`,
        label: field.label,
        field: key,
      };
    }),
  ];
  const colorOption = nodeColorField
    ? colorOptions.find((o) => o.field === nodeColorField) || colorOptions[0]
    : colorOptions[0];

  // Always include PageRank option, regardless of other conditions
  const sizeOptions: Option[] = [
    ...(disableDefaultSize ? [] : [{ value: "none", label: "Default (use sizes from the graph file)" }]),
    { value: "pagerank", label: "PageRank (importance based on connections)", field: "pagerank" },
    ...(sizeable || []).map((key) => {
      const field = fieldsIndex[key];
      return {
        value: `${key}-field`,
        label: field.label,
        field: key,
      };
    }),
  ];
  const sizeOption = nodeSizeField
    ? sizeOptions.find((o) => o.field === nodeSizeField) || sizeOptions[0]
    : sizeOptions[0];



  const showSizes = sizeOptions.length > 1;
  const showColors = colorOptions.length > 1;



  if (!showSizes && !showColors) return null;
  if (role === "v") return null;

  return (
    <div className="nodes-appearance-block block">
      <div className="d-flex flex-row align-items-start">
        {showColors && (
          <div className={cx("flex-regular-width", showSizes && "me-1")}>
            <label htmlFor="color-field-input" className="form-label">
              <h3 className="fs-6">
                <BsPaletteFill /> Color nodes by...
              </h3>
            </label>
            <Select
              {...DEFAULT_SELECT_PROPS}
              inputId="color-field-input"
              menuPortalTarget={portalTarget}
              options={colorOptions}
              value={colorOption}
              onChange={(o) => setNavState({ ...navState, nodeColorField: o?.field })}
              isDisabled={colorOptions.length <= 1}
            />
          </div>
        )}

        {showSizes && (
          <div className={cx("flex-regular-width", showColors && "ms-1")}>
            <label htmlFor="size-field-input" className="form-label">
              <h3 className="fs-6">
                <MdBubbleChart /> Size nodes by...
              </h3>
            </label>
            <Select
              {...DEFAULT_SELECT_PROPS}
              inputId="size-field-input"
              menuPortalTarget={portalTarget}
              options={sizeOptions}
              value={sizeOption}
              onChange={(o) => {
                // Handle special case for PageRank
                const fieldValue = o?.field === "pagerank" ? "pagerank" : o?.field;
                setNavState({ ...navState, nodeSizeField: fieldValue });
              }}
              isDisabled={sizeOptions.length <= 1}
            />
            {sizeOption?.field === "pagerank" && (
              <small className="form-text text-muted mt-1">
                Note: PageRank sizing will automatically reset to default when new edges are created.
              </small>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodesAppearanceBlock;

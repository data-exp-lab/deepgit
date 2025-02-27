import cx from "classnames";
import { keyBy, pull, uniqBy } from "lodash";
import React, { FC, JSX, useContext, useMemo } from "react";
import { BiSolidNetworkChart } from "react-icons/bi";
import { BsPaletteFill, BsShare } from "react-icons/bs";
import { FaTimes } from "react-icons/fa";
import { MdBubbleChart } from "react-icons/md";
import { RiFilterFill } from "react-icons/ri";
import { VscSettings } from "react-icons/vsc";
import Select from "react-select";

import { DEFAULT_SELECT_PROPS } from "../lib/consts";
import { GraphContext } from "../lib/context";
import {
  DEFAULT_EDGE_COLORING,
  DEFAULT_EDGE_DIRECTION,
  EDGE_COLORING_MODES,
  EDGE_DIRECTION_MODES,
  EdgeColoring,
  EdgeDirection,
  NavState,
} from "../lib/navState";

const EDGE_COLORING_LABELS: Record<EdgeColoring, JSX.Element> = {
  s: <div className="p-1">Use source node color</div>,
  t: <div className="p-1">Use target node color</div>,
  o: <div className="p-1">Use original color</div>,
  c: (
    <div className="p-1">
      Color all edges as grey
      <div className="text-muted">
        <small>(can be useful to keep the user focus on nodes)</small>
      </div>
    </div>
  ),
};

const EDGE_DIRECTION_LABELS: Record<EdgeDirection, JSX.Element> = {
  o: <div className="p-1">Trust the original graph file</div>,
  d: (
    <div className="p-1">
      All edges should be treated as <strong>directed</strong>
    </div>
  ),
  u: (
    <div className="p-1">
      All edges should be treated as <strong>undirected</strong>
    </div>
  ),
};

interface Option {
  value: string;
  label: string;
  field?: string;
}

const EditionPanel: FC<{ isExpanded: boolean }> = ({ isExpanded }) => {
  const { navState, data, setNavState, openModal, setPanel, setShowEditionPanel } = useContext(GraphContext);
  const { fields, fieldsIndex } = data;
  const { filterable, colorable, sizeable, subtitleFields } = navState;

  const edgeColoring = navState.edgeColoring || DEFAULT_EDGE_COLORING;
  const edgeDirection = navState.edgeDirection || DEFAULT_EDGE_DIRECTION;

  const sizeableSet = new Set<string>(sizeable);
  const colorableSet = new Set<string>(colorable);
  const filterableSet = new Set<string>(filterable);

  const sets: Record<string, Set<string>> = {
    sizeable: sizeableSet,
    colorable: colorableSet,
    filterable: filterableSet,
  };

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
  const selectedOptions = (subtitleFields || []).map((f) => optionsIndex[f]);

  return (
    <section
      className={cx(
        "side-panel edition-panel d-flex flex-column bg-dark text-white",
        isExpanded ? "expanded" : "collapsed",
      )}
    >
      <div className="panel-content scrollbar-left position-relative">
        <div className="flex-grow-1 p-0 m-0">
          <div className="editor-block block">
            <button
              className="btn btn-outline-light position-absolute"
              style={{ top: 15, right: 15 }}
              onClick={() => {
                setNavState({ ...navState, role: "x" });
                setShowEditionPanel(false); // Add this line to hide the panel
              }}
            >
              <FaTimes />
            </button>

            <h1 className="fs-4 mt-4 mb-4">
              <img
                src={import.meta.env.BASE_URL + "deepgit_logo.png"}
                alt="DeepGit logo"
                style={{ height: "1em", filter: "invert(1)" }} // Inverts colors (turns black to white)
                className="me-1 mb-1"
              />
              Welcome to DeepGit
            </h1>

            <p>
              Before sharing your graph online, you can first select various options on how users will{" "}
              <strong>read and interrogate</strong> this graph.
            </p>
            <p>
              Once you're done, simply close this panel. You will be able to access this form again later, from the{" "}
              <button
                type="button"
                className="btn btn-outline-light btn-sm btn-inline"
                onClick={() => setPanel("readability")}
              >
                <VscSettings className="small" /> Settings
              </button>{" "}
              panel.
            </p>
            {!navState.local && (
              <p className="fst-italic mb-0">
                PS: This panel is only here to help you configure DeepGit. Unless you specifically want it to be, it will
                not be visible to the users you share your graph with, if you click the{" "}
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm btn-inline"
                  onClick={() => openModal("share")}
                >
                  <BsShare className="small" /> Share
                </button>{" "}
                button to <strong>share</strong> or <strong>embed</strong> this graph.
              </p>
            )}

            <div className="sticky-top py-3 border-bottom bg-dark mb-3">
              <button
                className="btn btn-light w-100 text-center"
                onClick={() => {
                  setNavState({ ...navState, role: "x" });
                }}
              >
                Close this panel and{" "}
                <strong>
                  <BiSolidNetworkChart /> start exploring
                </strong>
              </button>
            </div>

            <div className="mb-3">
              <h3 className="form-label fs-6 mb-0">Which fields should be actionable?</h3>

              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" className="text-nowrap w-1">
                      <span className="d-flex align-items-center text-white">
                        <RiFilterFill className="me-1" /> Filter
                      </span>
                    </th>
                    <th scope="col" className="text-nowrap w-1">
                      <span className="d-flex align-items-center text-white">
                        <BsPaletteFill className="me-1" /> Colors
                      </span>
                    </th>
                    <th scope="col" className="text-nowrap w-1">
                      <span className="d-flex align-items-center text-white">
                        <MdBubbleChart className="me-1" /> Sizes
                      </span>
                    </th>
                    <th />
                  </tr>
                </thead>

                <tbody className="table-group-divider">
                  {fields.map((f) => {
                    const field = fieldsIndex[f];

                    return (
                      <tr key={f}>
                        {["filterable", "colorable", "sizeable"].map((key) => {
                          const colorOrSize = sizeableSet.has(f) || colorableSet.has(f);
                          const disabled =
                            (key === "filterable" && colorOrSize) ||
                            (key === "sizeable" && field.type !== "quanti") ||
                            (key === "colorable" && field.type !== "quali" && field.type !== "quanti");
                          const checked = sets[key].has(f) || (key === "filterable" && colorOrSize);
                          const keyToUpdate = {
                            sizeable: "size",
                            colorable: "color",
                          }[key];

                          return (
                            <td key={key} className="align-middle text-center">
                              <input
                                className="flex-shrink-0"
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={(e) =>
                                  setNavState({
                                    ...navState,
                                    [key]: e.target.checked
                                      ? ((navState as any)[key] || []).concat(f)
                                      : pull((navState as any)[key] || [], f),
                                    ...(e.target.checked && keyToUpdate ? { [keyToUpdate]: f } : {}),
                                  })
                                }
                              />
                            </td>
                          );
                        })}
                        <td className="line-height-1 text-white">
                          {field.label}
                          {field.typeLabel && <div className="text-muted">{field.typeLabel}</div>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td />
                    {["colorable", "sizeable"].map((key) => {
                      const keyToUpdate = (
                        {
                          sizeable: "disableDefaultSize",
                          colorable: "disableDefaultColor",
                        } as Record<string, keyof NavState>
                      )[key];
                      const disabled = ((navState as any)[key] || []).length < 1;
                      const checked = !navState[keyToUpdate];

                      return (
                        <td key={key} className="align-middle text-center">
                          <input
                            className="flex-shrink-0"
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => setNavState({ ...navState, [keyToUpdate]: !e.target.checked })}
                          />
                        </td>
                      );
                    })}
                    <td className="line-height-1 text-muted">Allow using default graph file colors and/or sizes</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="hovered-fields-input">
                <h3 className="form-label fs-6 mb-0">Which node information should show up on hovered nodes?</h3>
              </label>
              <Select
                {...DEFAULT_SELECT_PROPS}
                isMulti
                className="text-black"
                inputId="hovered-fields-input"
                options={subtitleOptions}
                value={selectedOptions}
                onChange={(v) => setNavState({ ...navState, subtitleFields: v.map((o) => o.field) as string[] })}
                isDisabled={subtitleOptions.length < 1}
                placeholder="Select fields..."
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="edge-coloring-input">
                <h3 className="form-label fs-6 mb-0">How should the edges be colored?</h3>
              </label>
              <Select<{ value: EdgeColoring; label: JSX.Element }>
                {...DEFAULT_SELECT_PROPS}
                className="text-black"
                inputId="edge-coloring-input"
                options={EDGE_COLORING_MODES.map((v) => ({ value: v, label: EDGE_COLORING_LABELS[v] }))}
                value={{ value: edgeColoring, label: EDGE_COLORING_LABELS[edgeColoring] }}
                onChange={(o) => o && setNavState({ ...navState, edgeColoring: o.value })}
                formatOptionLabel={(o) => o?.label}
                styles={{
                  option: (provided, state) => {
                    return {
                      ...provided,
                      background: state.isSelected ? "#f0f0f0" : state.isFocused ? "#f9f9f9" : provided.background,
                      color: undefined,
                    };
                  },
                }}
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="edge-direction-input">
                <h3 className="form-label fs-6 mb-0">What are the edge directions?</h3>
              </label>
              <Select<{ value: EdgeDirection; label: JSX.Element }>
                {...DEFAULT_SELECT_PROPS}
                className="text-black"
                inputId="edge-direction-input"
                options={EDGE_DIRECTION_MODES.map((v) => ({ value: v, label: EDGE_DIRECTION_LABELS[v] }))}
                value={{ value: edgeDirection, label: EDGE_DIRECTION_LABELS[edgeDirection] }}
                onChange={(o) => o && setNavState({ ...navState, edgeDirection: o.value })}
                formatOptionLabel={(o) => o?.label}
                styles={{
                  option: (provided, state) => {
                    return {
                      ...provided,
                      background: state.isSelected ? "#f0f0f0" : state.isFocused ? "#f9f9f9" : provided.background,
                      color: undefined,
                    };
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EditionPanel;

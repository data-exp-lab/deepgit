import cx from "classnames";
import { map, mapKeys, omitBy, startCase, uniq } from "lodash";
import React, { FC, useContext } from "react";
import { BiRadioCircleMarked } from "react-icons/bi";
import { FaTimes } from "react-icons/fa";
import Linkify from "react-linkify";
import { Coordinates } from "sigma/types";

import Connection from "../components/Connection";
import Node from "../components/Node";
import { ANIMATION_DURATION, DEFAULT_LINKIFY_PROPS, isHiddenRetinaField, removeRetinaPrefix } from "../lib/consts";
import { GraphContext } from "../lib/context";
import { NodeData } from "../lib/data";

const HIDDEN_KEYS = new Set(["x", "y", "z", "size", "label", "color"]);

const SelectedNodePanel: FC<{ node: string; data: NodeData }> = ({ node, data: { attributes } }) => {
  const {
    navState,
    setNavState,
    data: { graph },
    sigma,
    computedData: { filteredNodes },
  } = useContext(GraphContext);

  if (!attributes) return null;

  const currentAttributes = graph.getNodeAttributes(node);
  const filteredAttributes = mapKeys(
    omitBy(attributes, (_, key) => isHiddenRetinaField(key) || HIDDEN_KEYS.has(key)),
    (_, key) => removeRetinaPrefix(key),
  );
  const visibleNeighbors: string[] = [];
  const hiddenNeighbors: string[] = [];
  uniq(graph.neighbors(node)).forEach((n) => {
    if (filteredNodes && !filteredNodes.has(n)) hiddenNeighbors.push(n);
    else visibleNeighbors.push(n);
  });

  const isHidden = filteredNodes && !filteredNodes.has(node);

  return (
    <div className="selected-nodes-block block">
      <h1 className="fs-4 mt-4">
        <span className={cx("me-2", isHidden ? "circle" : "disc")} style={{ background: currentAttributes.color }} />
        <Linkify {...DEFAULT_LINKIFY_PROPS}>{currentAttributes.label}</Linkify>
        {isHidden ? (
          <>
            {" "}
            <small className="text-muted">(currently filtered out)</small>
          </>
        ) : null}
      </h1>

      <br />

      <div>
        <button
          className="btn btn-outline-dark mt-1 me-2"
          onClick={() => setNavState({ ...navState, selectedNode: undefined })}
        >
          <FaTimes /> Unselect
        </button>
        <button
          className="btn btn-outline-dark mt-1"
          onClick={() => {
            if (!sigma) return;
            const nodePosition = sigma.getNodeDisplayData(node) as Coordinates;
            sigma.getCamera().animate(
              { ...nodePosition, ratio: 0.3 },
              {
                duration: ANIMATION_DURATION,
              },
            );
          }}
        >
          <BiRadioCircleMarked /> Show on graph
        </button>
      </div>

      <br />

      {map(filteredAttributes, (value, key) => (
        <h2 key={key} className="fs-5 ellipsis">
          <small className="text-muted">{startCase(key)}:</small>{" "}
          <span title={value}>
            {typeof value === "number"
              ? value.toLocaleString()
              : typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))
                ? <a href={value} target="_blank" rel="noreferrer">{value}</a>
                : <Linkify {...DEFAULT_LINKIFY_PROPS}>{String(value)}</Linkify>}
          </span>
        </h2>
      ))}

      <hr />

      {!(visibleNeighbors.length + hiddenNeighbors.length) && <p className="text-muted">This node has no neighbor.</p>}

      {!!visibleNeighbors.length && (
        <>
          <div className="text-muted mb-2 mt-4">
            This node has {visibleNeighbors.length > 1 ? visibleNeighbors.length + " neighbors" : "one neighbor"}{" "}
            visible in this graph:
          </div>
          <ul className="list-unstyled">
            {visibleNeighbors.map((neighbor) => (
              <li key={neighbor} className="d-flex flex-row align-items-center">
                <Connection origin={node} edges={graph.edges(node, neighbor)} />
                <Node link node={neighbor} className="text-ellipsis" attributes={graph.getNodeAttributes(neighbor)} />
              </li>
            ))}
          </ul>
        </>
      )}

      {!!hiddenNeighbors.length && (
        <>
          <div className="text-muted mb-2 mt-4">
            This node{visibleNeighbors.length ? " also" : ""} has{" "}
            {hiddenNeighbors.length > 1 ? hiddenNeighbors.length + " neighbors " : "one neighbor "}
            that {hiddenNeighbors.length > 1 ? "are" : "is"} currently filtered out:
          </div>
          <ul className="list-unstyled">
            {hiddenNeighbors.map((neighbor) => (
              <li key={neighbor} className="d-flex flex-row align-items-center">
                <Connection origin={node} edges={graph.edges(node, neighbor)} />
                <Node link node={neighbor} className="text-ellipsis" attributes={graph.getNodeAttributes(neighbor)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default SelectedNodePanel;

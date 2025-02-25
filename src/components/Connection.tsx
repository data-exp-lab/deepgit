import React, { FC, useContext } from "react";

import { GraphContext } from "../lib/context";

const Connection: FC<{ origin: string; edges: string[] }> = ({ origin, edges }) => {
  const { data } = useContext(GraphContext);
  const { graph } = data;

  const edge = edges.length === 1 ? edges[0] : null;

  if (!edges.length) return null;

  if (edge) {
    if (graph.getEdgeAttribute(edge, "directed")) {
      if (graph.source(edge) === origin) {
        return (
          <span className="d-flex flex-row align-items-center">
            <span className="line" />
            <span className="triangle triangle-right" />
          </span>
        );
      } else {
        return (
          <span className="d-flex flex-row align-items-center">
            <span className="triangle triangle-left" />
            <span className="line" />
          </span>
        );
      }
    } else {
      return (
        <span className="d-flex flex-row align-items-center">
          <span className="line" />
        </span>
      );
    }
  }

  return (
    <span className="d-flex flex-row align-items-center">
      <span className="line">
        <small className="count text-muted">{edges.length}</small>
      </span>
    </span>
  );
};

export default Connection;

import { map, startCase } from "lodash";
import React, { FC, useCallback, useContext, useMemo } from "react";
import { BiNetworkChart } from "react-icons/bi";
import { FaFileDownload } from "react-icons/fa";
import { MdOutlineOpenInNew } from "react-icons/md";
import { RiFilterOffFill } from "react-icons/ri";
import Linkify from "react-linkify";

import { DEFAULT_LINKIFY_PROPS } from "../lib/consts";
import { GraphContext } from "../lib/context";
import { Data } from "../lib/data";
import { cleanNavState, navStateToQueryURL } from "../lib/navState";
import { saveFileFromURL } from "../utils/file";

const GraphSumUp: FC = () => {
  const { origin, pathname } = window.location;
  const { embedMode, navState, data, computedData, setNavState, graphFile } = useContext(GraphContext);

  const { graph } = data;
  const attributes = useMemo(() => graph.getAttributes(), [graph]);
  const { filteredNodes, filteredEdges } = computedData;

  const nodesTotal = graph.order;
  const edgesTotal = graph.size;
  const nodesVisible = filteredNodes ? filteredNodes.size : nodesTotal;
  const edgesVisible = filteredEdges ? filteredEdges.size : edgesTotal;
  const hasFilter = nodesVisible < nodesTotal;

  const downloadData = useCallback(() => {
    if (navState.local && graphFile) {
      // For local file, create a Blob and download it using a temporary URL.
      const blob = new Blob([graphFile.textContent], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = graphFile.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // For a public URL, use the existing saveFileFromURL.
      const url = navState.url || "";
      saveFileFromURL(url, url.replace(/(^.*[\\/]|[?#].*$)/g, ""));
    }
  }, [navState.local, navState.url, graphFile]);

  const graphURL = useMemo(() => {
    return origin + pathname + `#/graph?` + navStateToQueryURL(cleanNavState(navState, data as Data));
  }, [data, navState, origin, pathname]);

  return (
    <div className="graph-sumup-block block">
      <h1 className="fs-4 mt-4">
        <BiNetworkChart /> Graph overview
      </h1>

      <br />

      {navState.showGraphMeta && (
        <>
          {map(attributes, (value, key) => (
            <h2 key={key} className="fs-5 ellipsis">
              <small className="text-muted">{startCase(key)}:</small>{" "}
              <span title={value}>
                <Linkify {...DEFAULT_LINKIFY_PROPS}>{value}</Linkify>
              </span>
            </h2>
          ))}

          <br />
        </>
      )}

      <h2 className="fs-5">
        {nodesVisible.toLocaleString()} node{nodesVisible > 1 ? "s" : ""}
        {hasFilter ? (
          <small className="ms-2">{((nodesVisible / nodesTotal) * 100).toFixed(1)}% of full graph</small>
        ) : null}
      </h2>
      <h2 className="fs-5">
        {edgesVisible.toLocaleString()} edge{edgesVisible > 1 ? "s" : ""}
        {hasFilter ? (
          <small className="ms-2">{((edgesVisible / edgesTotal) * 100).toFixed(1)}% of full graph</small>
        ) : null}
      </h2>

      <br />

      <div>
        {embedMode && (
          <a
            className="btn btn-outline-dark me-2 mt-1"
            href={graphURL}
            target="_blank"
            rel="noreferrer"
            title="Open in a new tab"
          >
            <MdOutlineOpenInNew />
          </a>
        )}
        {/* <button className="btn btn-outline-dark me-2 mt-1" onClick={downloadData}>
          <FaFileDownload /> Download the Graph File (.gexf)
        </button> */}
        {navState.role !== "v" && (
          <button
            className="btn btn-outline-dark mt-1"
            disabled={!navState.filters}
            onClick={() => setNavState({ ...navState, filters: undefined })}
          >
            <RiFilterOffFill /> Clear all filters
          </button>
        )}
      </div>
    </div>
  );
};

export default GraphSumUp;

import { useSigma } from "@react-sigma/core";
import { downloadAsPNG } from "@sigma/export-image";
import cx from "classnames";
import { keyBy, take } from "lodash";
import React, { FC, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BiRadioCircleMarked } from "react-icons/bi";
import { BsSearch, BsZoomIn, BsZoomOut } from "react-icons/bs";
import { FaFileImage, FaDownload } from "react-icons/fa";
import { OptionProps } from "react-select";
import AsyncSelect from "react-select/async";
import { Coordinates } from "sigma/types";

import Node from "../components/Node";
import { ANIMATION_DURATION, DEFAULT_SELECT_PROPS, MAX_OPTIONS, RETINA_FIELD_PREFIX } from "../lib/consts";
import { AppContext, GraphContext } from "../lib/context";
import { NodeData } from "../lib/data";
import { normalize, slugify } from "../utils/string";
import GraphFullScreenControl from "./GraphFullScreenControl";

const TYPE_NODE = "node" as const;
const TYPE_MESSAGE = "message" as const;

interface NodeOption {
  type: typeof TYPE_NODE;
  value: string;
  label: string;
  node: NodeData;
}
interface MessageOption {
  type: typeof TYPE_MESSAGE;
  value: string;
  label: string;
  isDisabled: true;
}
type Option = NodeOption | MessageOption;

function cropOptions(options: Option[]): Option[] {
  const moreOptionsCount = options.length - MAX_OPTIONS;
  return moreOptionsCount > 1
    ? take(options, MAX_OPTIONS).concat({
      type: TYPE_MESSAGE,
      value: RETINA_FIELD_PREFIX + "more-values",
      label: `...and ${moreOptionsCount > 1 ? moreOptionsCount + " more nodes" : "one more node"}`,
      isDisabled: true,
    })
    : options;
}

function doesMatch(normalizedQuery: string, searchableNormalizedStrings: string[]): boolean {
  return searchableNormalizedStrings.some((str) => str.includes(normalizedQuery));
}

const OptionComponent = ({ data, innerProps, className, isFocused }: OptionProps<Option, false>) => {
  return (
    <div {...innerProps} className={className} onMouseMove={undefined} onMouseOver={undefined}>
      {data.type === TYPE_NODE && (
        <Node
          node={data.value}
          attributes={data.node}
          className={cx("search-node hoverable p-1", isFocused && "active-node")}
        />
      )}
      {data.type === TYPE_MESSAGE && <div className="p-2 text-muted">{data.label}</div>}
    </div>
  );
};

const IndicatorComponent = () => {
  return (
    <div className="text-center" style={{ width: "2em" }}>
      <BsSearch />
    </div>
  );
};

const GraphSearch: FC = () => {
  const sigma = useSigma();
  const { portalTarget } = useContext(AppContext);
  const {
    setNavState,
    navState,
    data,
    computedData: { filteredNodes },
  } = useContext(GraphContext);
  const [nodesIndex, setNodesIndex] = useState<Record<string, string[]>>({});

  // Index nodes on mount:
  useEffect(() => {
    setNodesIndex(
      data.graph.reduceNodes(
        (iter, node, attributes) => ({
          ...iter,
          [node]: [normalize(node), normalize(attributes.label)],
        }),
        {},
      ),
    );
  }, [data.graph]);

  const options: Option[] = useMemo(
    () =>
      data.graph
        .mapNodes((node, attributes) => {
          return {
            type: TYPE_NODE,
            value: node,
            label: attributes.label,
            node: attributes,
          };
        })
        .filter((n) => !filteredNodes || filteredNodes.has(n.value)),
    [data.graph, filteredNodes],
  );
  const firstOptions = useMemo(() => cropOptions(options), [options]);
  const optionsSet = keyBy(options, "value");
  const selectNode = useCallback(
    (option: Option | null) => {
      if (!option) {
        setNavState({ ...navState, selectedNode: undefined });
      } else {
        setNavState({ ...navState, selectedNode: option.value });
        const nodePosition = sigma.getNodeDisplayData(option.value) as Coordinates;
        sigma.getCamera().animate(
          { ...nodePosition, ratio: 0.5 },
          {
            duration: ANIMATION_DURATION,
          },
        );
      }
    },
    [navState, setNavState, sigma],
  );
  const filterOptions = useCallback(
    (query: string, callback: (options: Option[]) => void) => {
      const normalizedQuery = normalize(query);
      callback(
        cropOptions(
          options.filter(
            (option) => option.type === TYPE_NODE && doesMatch(normalizedQuery, nodesIndex[option.value] || []),
          ),
        ),
      );
    },
    [nodesIndex, options],
  );

  return (
    <AsyncSelect<Option>
      {...DEFAULT_SELECT_PROPS}
      isClearable
      menuPortalTarget={portalTarget}
      className="mb-2"
      placeholder="Search for nodes..."
      defaultOptions={firstOptions}
      loadOptions={filterOptions}
      value={navState.selectedNode ? optionsSet[navState.selectedNode] || null : null}
      onChange={(option: Option | null) => selectNode(option?.type === TYPE_NODE ? option : null)}
      components={{
        Option: OptionComponent,
        DropdownIndicator: IndicatorComponent,
      }}
      styles={{
        control: (styles) => {
          return {
            ...styles,
            width: "200px",
          };
        },
      }}
    />
  );
};

const GraphControls: FC = () => {
  const sigma = useSigma();
  const graph = sigma.getGraph();
  const { graphFile, navState, hovered, computedData, openModal } = useContext(GraphContext);

  const zoom = useCallback(
    (ratio?: number): void => {
      if (sigma) {
        if (!ratio) {
          sigma.getCamera().animatedReset({ duration: ANIMATION_DURATION });
        } else if (ratio > 0) {
          sigma.getCamera().animatedZoom({ duration: ANIMATION_DURATION, factor: 1.5 });
        } else if (ratio < 0) {
          sigma.getCamera().animatedUnzoom({ duration: ANIMATION_DURATION, factor: 1.5 });
        }
      }
    },
    [sigma],
  );

  const downloadImage = useCallback(() => {
    const slug = slugify(graph.getAttribute("title") || "graph");
    downloadAsPNG(sigma, {
      fileName: slug,
      backgroundColor: "white",
    });
  }, [graph, sigma]);

  // Helper function to format XML with proper indentation
  const formatXML = (xml: string): string => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");

    // Create a new document with proper formatting
    const serializer = new XMLSerializer();
    const formatted = serializer.serializeToString(xmlDoc);

    // Add line breaks and indentation for better readability
    return formatted
      .replace(/></g, '>\n<')
      .replace(/^\s*\n/gm, '')
      .split('\n')
      .map((line, index) => {
        const indent = '  '.repeat(Math.max(0, (line.match(/</g) || []).length - (line.match(/\//g) || []).length - 1));
        return indent + line.trim();
      })
      .join('\n');
  };

  const downloadGraph = useCallback(() => {
    if (graphFile) {
      // Parse the existing GEXF content
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(graphFile.textContent, "text/xml");

      // Get the graph element
      const graphElement = xmlDoc.querySelector('graph');
      if (!graphElement) return;

      // Create sets for highlighted nodes and edges
      const highlightedNodesSet = new Set<string>();
      const highlightedEdgesSet = new Set<string>();

      // Only use filtered nodes - ignore hover and selection states
      if (computedData.filteredNodes) {
        // Use the filtered nodes as the base - these are the active/visible nodes
        computedData.filteredNodes.forEach(node => {
          highlightedNodesSet.add(node);
        });
      } else {
        // If no filters are applied, include all nodes
        graph.forEachNode((node) => {
          highlightedNodesSet.add(node);
        });
      }

      // Only include the filtered nodes
      const nodesToAdd = new Set<string>();
      highlightedNodesSet.forEach(node => {
        if (graph.hasNode(node)) {
          nodesToAdd.add(node);
        }
      });

      // Add edges where BOTH source AND target nodes are visible (to avoid orphaned edges)
      graph.forEachEdge((edge, attributes, source, target) => {
        if (nodesToAdd.has(source) && nodesToAdd.has(target)) {
          // Include all edges between the selected/highlighted nodes
          // This ensures we get the complete subgraph structure
          highlightedEdgesSet.add(edge);
        }
      });



      // If no nodes are highlighted, download the entire graph
      if (nodesToAdd.size === 0) {
        const formattedContent = formatXML(graphFile.textContent);
        const blob = new Blob([formattedContent], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = graphFile.name || "graph.gexf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // Create a new XML document for the filtered graph
      const newXmlDoc = parser.parseFromString(graphFile.textContent, "text/xml");
      const newGraphElement = newXmlDoc.querySelector('graph');
      if (!newGraphElement) return;

      // Remove all existing nodes and edges
      const existingNodes = newXmlDoc.querySelectorAll('node');
      const existingEdges = newXmlDoc.querySelectorAll('edge');

      existingNodes.forEach(node => {
        const nodeId = node.getAttribute('id');
        if (nodeId && !nodesToAdd.has(nodeId)) {
          node.remove();
        }
      });

      // Improved edge matching: match by source and target instead of just edge ID
      existingEdges.forEach(edge => {
        const edgeId = edge.getAttribute('id');
        const source = edge.getAttribute('source');
        const target = edge.getAttribute('target');

        // Check if this edge should be included based on source and target nodes
        const shouldInclude = source && target && nodesToAdd.has(source) && nodesToAdd.has(target);

        if (!shouldInclude) {
          edge.remove();
        }
      });

      // Count remaining edges and nodes
      const remainingNodes = newXmlDoc.querySelectorAll('node');
      const remainingEdges = newXmlDoc.querySelectorAll('edge');

      // Add missing edges that exist in the graph but not in the GEXF file
      const existingEdgeIds = new Set<string>();
      remainingEdges.forEach(edge => {
        const edgeId = edge.getAttribute('id');
        if (edgeId) existingEdgeIds.add(edgeId);
      });

      // Add edges that are in the graph but missing from the GEXF
      highlightedEdgesSet.forEach(edgeId => {
        if (!existingEdgeIds.has(edgeId)) {
          // Get edge data from the graph
          const edgeData = graph.getEdgeAttributes(edgeId);
          const [source, target] = graph.extremities(edgeId);

          // Create new edge element
          const edgeElement = newXmlDoc.createElement('edge');
          edgeElement.setAttribute('id', edgeId);
          edgeElement.setAttribute('source', source);
          edgeElement.setAttribute('target', target);

          // Add edge attributes if they exist
          if (edgeData && Object.keys(edgeData).length > 0) {
            const attvaluesElement = newXmlDoc.createElement('attvalues');
            Object.entries(edgeData).forEach(([key, value]) => {
              if (key !== 'id' && key !== 'source' && key !== 'target') {
                const attvalueElement = newXmlDoc.createElement('attvalue');
                attvalueElement.setAttribute('for', key);
                attvalueElement.setAttribute('value', String(value));
                attvaluesElement.appendChild(attvalueElement);
              }
            });
            if (attvaluesElement.children.length > 0) {
              edgeElement.appendChild(attvaluesElement);
            }
          }

          // Add the edge to the graph element
          newGraphElement.appendChild(edgeElement);
        }
      });

      // Serialize the filtered XML
      const serializer = new XMLSerializer();
      const filteredGexfContent = serializer.serializeToString(newXmlDoc);

      // Format the XML content
      const formattedContent = formatXML(filteredGexfContent);

      // Create and download the filtered file
      const blob = new Blob([formattedContent], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Create filename with indication that it's filtered
      const baseName = graphFile.name || "graph";
      const extension = graphFile.extension || "gexf";
      const filteredName = `${baseName}_highlighted.${extension}`;

      a.download = filteredName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [graphFile, graph, navState.selectedNode, hovered]);

  return (
    <>
      <GraphSearch />

      <button className="btn btn-outline-dark graph-button mt-3" onClick={() => zoom(1)} title="Zoom in">
        <BsZoomIn />
      </button>
      <button className="btn btn-outline-dark graph-button" onClick={() => zoom(-1)} title="Zoom out">
        <BsZoomOut />
      </button>
      <button className="btn btn-outline-dark graph-button" onClick={() => zoom()} title="Reset zoom">
        <BiRadioCircleMarked />
      </button>

      <GraphFullScreenControl />

      <button className="btn btn-outline-dark graph-button mt-3" onClick={downloadImage} title="Download as image">
        <FaFileImage />
      </button>

      <button className="btn btn-outline-dark graph-button mt-3" onClick={downloadGraph} title="Download filtered graph file (.gexf) - entire graph if no filters, filtered subgraph if filters applied">
        <FaDownload />
      </button>
    </>
  );
};

export default GraphControls;

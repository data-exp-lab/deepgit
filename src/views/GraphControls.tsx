import { useSigma } from "@react-sigma/core";
import { downloadAsPNG } from "@sigma/export-image";
import cx from "classnames";
import { keyBy, take } from "lodash";
import React, { FC, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BiRadioCircleMarked } from "react-icons/bi";
import { BsSearch, BsZoomIn, BsZoomOut } from "react-icons/bs";
import { FaFileImage } from "react-icons/fa";
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
    </>
  );
};

export default GraphControls;

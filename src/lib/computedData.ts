import chroma from "chroma-js";
import _, { max, min, sortBy } from "lodash";
import { Dimensions } from "sigma/types";

import { findRanges } from "../utils/number";
import { calculatePageRank } from "../utils/graphAlgorithms";
import {
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIZE_RATIO,
  EDGE_SIZE_MAX,
  EDGE_SIZE_MIN,
  GRADIENT,
  MAX_PALETTE_SIZE,
  NODE_DEFAULT_SIZE,
  NODE_SIZE_MAX,
  NODE_SIZE_MIN,
  PALETTES,
} from "./consts";
import { Data, countRanges, countTerms, filterNodes, getFilterableFields, getValue } from "./data";
import { NavState } from "./navState";

export interface TermsValue {
  id: string;
  label: string;
  globalCount: number;
  filteredCount: number;
}
export interface RangeValue {
  min: number;
  max: number;
  label: string;
  globalCount: number;
  filteredCount: number;
}
export interface TermsMetric {
  type: "quali";
  field: string;
  values: TermsValue[];
}
export interface RangeMetric {
  type: "quanti";
  field: string;
  unit: number;
  min: number;
  max: number;
  ranges: RangeValue[];
}
export interface SearchMetrics {
  type: "content";
  field: string;
  samples: string[];
}
export type Metric = TermsMetric | RangeMetric | SearchMetrics;
export interface ComputedData {
  filteredNodes?: Set<string> | null; // Only present when there are filters
  filteredEdges?: Set<string> | null; // Only present when there are filters
  metrics: Record<string, Metric>;

  // Color and size providers:
  // Only present when there is a selected color field
  nodeColors?: Record<string, string> | null;
  getColor?: ((value: any) => string) | null;
  // Only present when there is a selected size field
  getSize?: ((value: any) => number) | null;
  nodeSizes: Record<string, number>;
  edgeSizes: Record<string, number>;
  nodeSizeExtents: [number, number];
  edgeSizeExtents: [number, number];
}

export function getEmptyComputedData(): ComputedData {
  return {
    metrics: {},
    nodeSizes: {},
    edgeSizes: {},
    nodeSizeExtents: [0, Infinity],
    edgeSizeExtents: [0, Infinity],
  };
}

export function getNodeColors(
  { graph, fieldsIndex }: Data,
  { nodeColorField }: Pick<NavState, "nodeColorField">,
): Pick<ComputedData, "getColor" | "nodeColors"> {
  const result: Pick<ComputedData, "getColor" | "nodeColors"> = {};

  if (typeof nodeColorField === "string") {
    result.nodeColors = {};
    const field = fieldsIndex[nodeColorField];
    let getColor: ComputedData["getColor"] = null;

    if (field.type === "quali") {
      const values = sortBy(field.values, (v) => -v.count);
      const palette = PALETTES[Math.min(values.length, MAX_PALETTE_SIZE)];
      const colorsDict: Record<string, string> = values.reduce(
        (iter, v, i) => ({ ...iter, [v.id]: palette[i] || DEFAULT_NODE_COLOR }),
        {},
      );
      getColor = (value: any) => colorsDict[value] || DEFAULT_NODE_COLOR;
    } else if (field.type === "quanti") {
      const gradient = chroma.scale(GRADIENT).domain([0, 1]);
      getColor = (value: any) =>
        typeof value === "number" ? gradient((value - field.min) / (field.max - field.min)).hex() : DEFAULT_NODE_COLOR;
    }

    if (getColor) {
      graph.forEachNode((node, nodeData) => {
        result.nodeColors![node] = getColor!(getValue(nodeData, field));
      });

      result.getColor = getColor;
    }
  }

  return result;
}

export function getNodeSizes(
  { graph, fieldsIndex }: Data,
  { nodeSizeField, nodeSizeRatio }: NavState,
  { width, height }: Dimensions,
): Pick<ComputedData, "getSize" | "nodeSizes" | "nodeSizeExtents"> {
  let nodeSizes: ComputedData["nodeSizes"];
  let getSize: ComputedData["getSize"] = null;
  let nodeSizeExtents: ComputedData["nodeSizeExtents"] = [0, Infinity];

  const ratio = nodeSizeRatio || DEFAULT_NODE_SIZE_RATIO;
  const screenSizeRatio = Math.min(width, height) / 1000;
  const graphSizeRatio = 1 / Math.log10(graph.order + 2);

  if (typeof nodeSizeField === "string") {
    nodeSizes = {};

    // Check if it's the PageRank option
    if (nodeSizeField === "pagerank") {
      try {
        // Calculate PageRank scores
        const pageRankScores = calculatePageRank(graph);
        const scores = Object.values(pageRankScores);
        const minScore = min(scores) as number;
        const maxScore = max(scores) as number;

        getSize = (value: any) => {
          const size =
            typeof value === "number"
              ? ((NODE_SIZE_MAX - NODE_SIZE_MIN) * (value - minScore)) / (maxScore - minScore) + NODE_SIZE_MIN
              : NODE_DEFAULT_SIZE;
          return size * ratio * screenSizeRatio * graphSizeRatio;
        };

        graph.forEachNode((node) => {
          const score = pageRankScores[node] || 0;
          nodeSizes![node] = getSize!(score);
        });

        nodeSizeExtents = [minScore, maxScore];
      } catch (error) {
        // Fallback to default sizing
        nodeSizes = {};
        const values = graph.mapNodes((_node, attributes) => attributes.rawSize);
        nodeSizeExtents = [min(values) as number, max(values) as number];
        graph.forEachNode((node, { rawSize }) => {
          nodeSizes[node] =
            (((NODE_SIZE_MAX - NODE_SIZE_MIN) * (rawSize - nodeSizeExtents[0])) /
              (nodeSizeExtents[1] - nodeSizeExtents[0]) +
              NODE_SIZE_MIN) *
            ratio *
            screenSizeRatio *
            graphSizeRatio;
        });
      }
    } else {
      // Handle regular field-based sizing
      const field = fieldsIndex[nodeSizeField];

      if (field.type === "quanti") {
        getSize = (value: any) => {
          const size =
            typeof value === "number"
              ? ((NODE_SIZE_MAX - NODE_SIZE_MIN) * (value - field.min)) / (field.max - field.min) + NODE_SIZE_MIN
              : NODE_DEFAULT_SIZE;
          return size * ratio * screenSizeRatio * graphSizeRatio;
        };
        graph.forEachNode((node, nodeData) => {
          nodeSizes![node] = getSize!(getValue(nodeData, field));
        });
        nodeSizeExtents = [field.min, field.max];
      }
    }
  } else {
    nodeSizes = {};
    const values = graph.mapNodes((_node, attributes) => attributes.rawSize);
    nodeSizeExtents = [min(values) as number, max(values) as number];
    graph.forEachNode((node, { rawSize }) => {
      nodeSizes[node] =
        (((NODE_SIZE_MAX - NODE_SIZE_MIN) * (rawSize - nodeSizeExtents[0])) /
          (nodeSizeExtents[1] - nodeSizeExtents[0]) +
          NODE_SIZE_MIN) *
        ratio *
        screenSizeRatio *
        graphSizeRatio;
    });
  }

  if (nodeSizeExtents[0] === nodeSizeExtents[1]) nodeSizeExtents[0] = 0;

  return { getSize, nodeSizes, nodeSizeExtents };
}

export function getEdgeSizes(
  { graph, edgesSizeField }: Data,
  { edgeSizeRatio }: NavState,
  { width, height }: Dimensions,
): Pick<ComputedData, "edgeSizeExtents" | "edgeSizes"> {
  const ratio = edgeSizeRatio || DEFAULT_NODE_SIZE_RATIO;
  const screenSizeRatio = Math.min(width, height) / 1000;
  const graphSizeRatio = 1 / Math.log10(graph.order + 2);

  const values = graph.mapEdges((_edge, { attributes }) => attributes[edgesSizeField]);
  const edgeSizeExtents: ComputedData["edgeSizeExtents"] = [min(values) as number, max(values) as number];
  if (edgeSizeExtents[0] === edgeSizeExtents[1]) edgeSizeExtents[0] = 0;

  const edgeSizes: ComputedData["edgeSizes"] = {};
  graph.forEachEdge((edge, { attributes }) => {
    edgeSizes[edge] =
      (((EDGE_SIZE_MAX - EDGE_SIZE_MIN) * ((attributes[edgesSizeField] || edgeSizeExtents[0]) - edgeSizeExtents[0])) /
        (edgeSizeExtents[1] - edgeSizeExtents[0]) +
        EDGE_SIZE_MIN) *
      ratio *
      screenSizeRatio *
      graphSizeRatio;
  });

  if (edgeSizeExtents[0] === edgeSizeExtents[1]) edgeSizeExtents[0] = 0;

  return { edgeSizes, edgeSizeExtents };
}

export function getMetrics(
  data: Data,
  navState: Pick<NavState, "filters" | "filterable" | "colorable" | "sizeable">,
  currentMetrics?: ComputedData["metrics"],
): Pick<ComputedData, "metrics" | "filteredNodes" | "filteredEdges"> {
  const { graph } = data;

  const allFilterable = getFilterableFields(data, navState);

  currentMetrics = currentMetrics || {};
  const metrics: ComputedData["metrics"] = {};

  // 1. Filter nodes and edges:
  const nodes = filterNodes(data, navState);
  const nodesArray = nodes ? Array.from(nodes) : null;
  const filteredNodes = nodes;
  const filteredEdges = nodes
    ? new Set(graph.filterEdges((_edge, _attributes, source, target) => nodes.has(source) && nodes.has(target)))
    : null;

  // 2. Count metrics:
  allFilterable?.forEach((field) => {
    if (!field) return; // Skip if field is undefined
    const oldMetric = currentMetrics![field.id];

    switch (field.type) {
      case "quali": {
        const globalCounts: Record<string, number> = oldMetric &&
          (oldMetric as TermsMetric).values &&
          Array.isArray((oldMetric as TermsMetric).values)
          ? (oldMetric as TermsMetric).values.reduce((iter, v) => ({ ...iter, [v.id]: v.globalCount }), {})
          : countTerms(graph, field);
        const counts = nodesArray ? countTerms(graph, field, nodesArray) : globalCounts;
        metrics[field.id] = {
          type: "quali",
          field: field.id,
          values: sortBy(
            Object.values(field.values || {}).map((value) => ({
              id: value.id,
              label: value.label,
              globalCount: globalCounts[value.id] || 0,
              filteredCount: counts[value.id] || 0,
            })),
            (o) => -o.globalCount,
          ),
        };
        break;
      }
      case "quanti": {
        if (oldMetric && (oldMetric as RangeMetric).ranges) {
          const { unit, ranges, min, max } = oldMetric as RangeMetric;
          const newRanges = Array.isArray(ranges) ? ranges.map((v) => [v.min, v.max] as [number, number]) : [];
          const counts = nodesArray ? countRanges(graph, field, newRanges, nodesArray) : null;
          metrics[field.id] = {
            type: "quanti",
            field: field.id,
            unit,
            min,
            max,
            ranges: Array.isArray(ranges) ? ranges.map((v, i) => ({
              ...v,
              filteredCount: (Array.isArray(counts) ? counts[i] : v.globalCount) || 0,
            })) : [],
          };
        } else {
          const { ranges, unit } = findRanges(field.min, field.max);
          const globalCounts = countRanges(graph, field, ranges);
          const counts = nodesArray ? countRanges(graph, field, ranges, nodesArray) : (Array.isArray(globalCounts) ? globalCounts : []);
          const values = graph
            .mapNodes((_n, nodeData) => getValue(nodeData, field))
            .filter((v) => typeof v === "number");

          if (values.length)
            metrics[field.id] = {
              type: "quanti",
              field: field.id,
              unit,
              min: min(values) as number,
              max: max(values) as number,
              ranges: Array.isArray(ranges) ? ranges.map(([min, max], i) => ({
                min,
                max,
                label: `${min} - ${max}`,
                globalCount: Array.isArray(globalCounts) ? globalCounts[i] : 0,
                filteredCount: Array.isArray(counts) ? counts[i] : 0,
              })) : [],
            };
        }
        break;
      }
      case "content": {
        metrics[field.id] = oldMetric || {
          type: "content",
          field: field.id,
          samples: _(graph.nodes())
            .map((node) => getValue(graph.getNodeAttributes(node), field))
            .filter((str) => !!str)
            .uniq()
            .take(3)
            .value(),
        };
        break;
      }
    }
  });

  return { metrics, filteredNodes, filteredEdges };
}

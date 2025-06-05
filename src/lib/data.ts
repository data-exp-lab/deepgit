import { MultiGraph } from "graphology";
import gexf from "graphology-gexf/browser";
import graphml from "graphology-graphml/browser";
import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import circular from "graphology-layout/circular";
import AbstractGraph from "graphology-types";
import { constant, flatMap, groupBy, isNil, keyBy, mapValues, max, min, omitBy, uniq } from "lodash";
import { NodeDisplayData } from "sigma/types";

import { isNumber } from "../utils/number";
import { minimize, normalize } from "../utils/string";
import {
  DEFAULT_EDGE_COLOR,
  DEFAULT_NODE_COLOR,
  NODE_DEFAULT_SIZE,
  RESERVED_FIELDS,
  RETINA_FIELD_PREFIX,
  RETINA_NUMBER_FIELD_PREFIX,
  RETINA_STRING_FIELD_PREFIX,
  removeRetinaPrefix,
} from "./consts";
import { BAD_EXTENSION } from "./errors";
import { FILTER_FIELD_TYPES, Filter, NavState } from "./navState";

/**
 * Types:
 * ******
 */
export interface BaseField {
  type: string;
  label: string;
  typeLabel?: string;
  computed?: boolean;
  id: string;
  rawFieldId: string;
  nullValuesCount: number;
}
export interface ContentField extends BaseField {
  type: "content";
}
export interface QuantiField extends BaseField {
  type: "quanti";
  min: number;
  max: number;
}
export interface QualiField extends BaseField {
  type: "quali";
  values: Record<
    string,
    {
      id: string;
      label: string;
      count: number;
    }
  >;
}
export type Field = QualiField | QuantiField | ContentField;
export type FieldType = Field["type"];
export type TypedField = Partial<{
  content: ContentField;
  quanti: QuantiField;
  quali: QualiField;
}>;

export type CustomNodeDisplayData = NodeDisplayData & { trueColor: string };

export type RawData = Record<string, any>;

export interface NodeData {
  x: number;
  y: number;
  label: string;
  size: number;
  rawSize: number; // size from graph file or default size
  color: string;
  rawColor: string; // color from graph file or default color

  // For render only:
  italic?: true; // for missing labels

  labelSize: number;
  subtitles: string[];

  // Everything computed and cached by Retina:
  computed: {
    degree: number;
  };

  // Everything from the graph file:
  attributes: RawData;
}

export interface EdgeData {
  size: number;
  rawSize: number; // size from graph file or default size
  color: string;
  label?: string;
  rawColor: string; // color from graph file or default color
  type?: "arrow";

  directed?: boolean; // `undefined` if not determined

  // Optional state:
  hidden?: boolean;

  // Everything from the graph file:
  attributes: RawData;
}

export type RawGraph = AbstractGraph;
export type RetinaGraph = MultiGraph<NodeData, EdgeData>;

export interface Data {
  graph: RetinaGraph;
  fields: string[]; // A (sorted) array of field keys
  fieldsIndex: Record<string, Field>; // The actual field contents
  edgeFields: string[];
  edgeFieldsIndex: Record<string, Field>;
  // TODO:
  // - Move that edgeSizeField value into navState
  // - Add an input to select it
  edgesSizeField: string;
  hasEdges: boolean;
}

export interface Report {
  missingNodeSizes?: number;
  missingNodeColors?: number;
  missingNodeLabels?: number;
  missingNodePositions?: number;
  missingEdgeSizes?: number;
  missingEdgeColors?: number;
}

/**
 * Loading graph:
 * **************
 */
export const Loaders: { [extension: string]: (text: string) => RawGraph } = {
  gexf: (text) => gexf.parse(MultiGraph, text, { addMissingNodes: true }),
  graphml: (text) => graphml.parse(MultiGraph, text, { addMissingNodes: true }),
};
export async function loadGraphURL(path: string): Promise<{ name: string; extension: string; textContent: string }> {
  const name = (path.split("/").pop() || "").toLowerCase();
  const extension = (name.split(".").pop() || "").toLowerCase();
  const textContent = await fetch(path).then((res) => res.text());

  return { name, extension, textContent };
}
export async function loadGraphFile(file: File): Promise<{ name: string; extension: string; textContent: string }> {
  const name = file.name;
  const extension = (name.split(".").pop() || "").toLowerCase();
  const textContent = await file.text();

  return { name, extension, textContent };
}
export async function readGraph({
  extension,
  textContent,
}: {
  name: string;
  extension: string;
  textContent: string;
}): Promise<{ graph: RawGraph; hasEdges: boolean }> {
  if (!Loaders[extension]) {
    const e = new Error(`Graph file extension ".${extension}" not recognized.`);
    e.name = BAD_EXTENSION;
    throw e;
  }

  const graph = Loaders[extension](textContent);
  // Check if the graph has any edges
  const hasEdges = graph.size > 0;
  return { graph, hasEdges };
}

export function prepareGraph(rawGraph: { graph: RawGraph; hasEdges: boolean }): { graph: RetinaGraph; report: Report; hasEdges: boolean } {
  const { graph: rawGraphData, hasEdges } = rawGraph;
  const graph = new MultiGraph<NodeData, EdgeData>();
  const report: Report = {};

  rawGraphData.forEachNode((node, attributes) => {
    const { x, y, size, color, label } = attributes;

    if (typeof attributes.x !== "number" || typeof attributes.y !== "number")
      report.missingNodePositions = (report.missingNodePositions || 0) + 1;
    if (typeof attributes.size !== "number") report.missingNodeSizes = (report.missingNodeSizes || 0) + 1;
    if (typeof attributes.color !== "string") report.missingNodeColors = (report.missingNodeColors || 0) + 1;
    if (typeof attributes.label !== "string") report.missingNodeLabels = (report.missingNodeLabels || 0) + 1;

    const newNodeAttributes: NodeData = {
      x: typeof x === "number" ? x : 0,
      y: typeof y === "number" ? y : 0,
      label: typeof label === "string" ? label : node,
      size: typeof size === "number" ? size : NODE_DEFAULT_SIZE,
      rawSize: typeof size === "number" ? size : NODE_DEFAULT_SIZE,
      color: typeof color === "string" ? color : DEFAULT_NODE_COLOR,
      rawColor: typeof color === "string" ? color : DEFAULT_NODE_COLOR,

      italic: typeof label !== "string" || undefined,

      labelSize: NODE_DEFAULT_SIZE,
      subtitles: [],

      attributes,

      computed: {
        degree: NaN,
      },
    };

    graph.addNode(node, newNodeAttributes);
  });
  rawGraphData.forEachEdge((edge, attributes, source, target) => {
    const { size, color, label } = attributes;
    const directed = rawGraphData.isDirected(edge);

    if (typeof attributes.size !== "number") report.missingEdgeSizes = (report.missingEdgeSizes || 0) + 1;
    if (typeof attributes.color !== "string") report.missingEdgeColors = (report.missingEdgeColors || 0) + 1;

    const newEdgeAttributes: EdgeData = {
      size: typeof size === "number" ? size : NODE_DEFAULT_SIZE,
      rawSize: typeof size === "number" ? size : NODE_DEFAULT_SIZE,
      color: typeof color === "string" ? color : DEFAULT_EDGE_COLOR,
      rawColor: typeof color === "string" ? color : DEFAULT_EDGE_COLOR,
      label: typeof label === "string" ? label : undefined,
      directed,

      hidden: false,
      type: undefined,

      attributes,
    };

    if (directed) graph.addDirectedEdgeWithKey(edge, source, target, newEdgeAttributes);
    else graph.addUndirectedEdgeWithKey(edge, source, target, newEdgeAttributes);
  });

  // For positions however, we need to run FA2 for some time first:
  // TODO: Try running this in a worker instead
  if (report.missingNodePositions) {
    circular.assign(graph);

    forceAtlas2.assign(graph, {
      settings: forceAtlas2.inferSettings(graph),
      iterations: 150,
    });

    noverlap.assign(graph, { maxIterations: 150 });
  }

  return { graph, report, hasEdges };
}

/**
 * Initializing graph data:
 * ************************
 */
export function inferFieldTypes(values: (string | number)[], nodesCount: number): FieldType[] {
  const types: FieldType[] = [];

  // If all values are numbers, it's quantitative
  if (values.every((v) => isNumber(v))) {
    types.push("quanti");
  } else {
    // Only consider qualitative if it's not quantitative
    const uniqValuesCount = uniq(values).length;
    if (uniqValuesCount > 1 && uniqValuesCount < Math.max(Math.pow(nodesCount, 0.75), 5)) {
      types.push("quali");
    }
  }

  // If no types were assigned, it's content
  if (!types.length) types.push("content");

  return types;
}

export function getValue(node: NodeData, field: Field): any {
  return field.computed ? (node.computed as any)[field.rawFieldId] : node.attributes[field.rawFieldId];
}

export function getFields(graph: RetinaGraph, type: "node" | "edge", hasEdges: boolean): Field[] {
  let fields: Record<string, (string | number)[]> = {};

  // Inject computed fields (here, only "Degree" for now):
  const computedFields: Field[] = [];
  if (type === "node" && hasEdges) {  // Only add degree if the GEXF has edges
    const degreeExtent: [number, number] = [Infinity, -Infinity];
    graph.forEachNode((node) => {
      graph.updateNodeAttribute(node, "computed", (o) => {
        const degree = graph.degree(node);
        degreeExtent[0] = Math.min(degreeExtent[0], degree);
        degreeExtent[1] = Math.max(degreeExtent[1], degree);
        return { ...o, degree };
      });
    });
    computedFields.push({
      type: "quanti",
      id: RETINA_FIELD_PREFIX + "degree",
      computed: true,
      rawFieldId: "degree",
      label: "Degree",
      min: degreeExtent[0],
      max: degreeExtent[1],
      nullValuesCount: 0,
    });
  }

  // Identify all values:
  graph[type === "node" ? "forEachNode" : "forEachEdge"]((_, { attributes }) => {
    for (const key in attributes) {
      const value = attributes[key];
      if (!isNil(value)) {
        if (!fields[key]) fields[key] = [];
        // Special handling for date fields
        if (key === "createdAt_year" || key === "createdAt_month") {
          fields[key].push(value);
        } else if (key === "createdAt") {
          fields[key].push(value);
        } else if (key === "topics") {
          // Split topics by '|', collect all unique topics
          const topicsArr = typeof value === 'string' ? value.split('|').map(t => t.trim()).filter(Boolean) : [];
          fields[key].push(...topicsArr);
        } else {
          fields[key].push(attributes[key]);
        }
      }
    }
  });

  // Remove reserved fields:
  fields = omitBy(fields, (_, field) => RESERVED_FIELDS.has(field));

  // Minimize field IDs:
  const keys = Object.keys(fields).concat(computedFields.map((o) => o.id));
  const minimized: Record<string, string> = minimize(
    keys.map(removeRetinaPrefix).map((s) => normalize(s || "").trim()),
  ).reduce(
    (iter, mini, i) => ({
      ...iter,
      [keys[i]]: mini,
    }),
    {},
  );

  // Update computed fields IDs:
  computedFields.forEach((field) => (field.id = minimized[field.id]));

  // Infer field types:
  const totalRowsCount = type === "node" ? graph.order : graph.size;
  const inferedFields: Field[] = flatMap(fields, (values, key) => {
    // Special handling for year and month fields - always quantitative
    if (key === "createdAt_year" || key === "createdAt_month") {
      const numbers = values.map(v => +v) as number[];
      return [{
        type: "quanti",
        id: minimized[key],
        rawFieldId: key,
        label: key === "createdAt_year" ? "Creation Year" : "Creation Month",
        typeLabel: undefined,
        nullValuesCount: totalRowsCount - values.length,
        min: min(numbers) as number,
        max: max(numbers) as number,
      }];
    }
    // Special handling for topics: always qualitative, unique values
    if (key === "topics") {
      const uniqTopics = uniq(values as string[]);
      return [{
        type: "quali",
        id: minimized[key],
        rawFieldId: key,
        label: "topics",
        typeLabel: undefined,
        nullValuesCount: 0,
        values: mapValues(groupBy(uniqTopics, v => v), (a, v) => ({
          id: v,
          label: v,
          count: 0, // will be counted in countTerms
        })),
      }];
    }

    const types =
      key.indexOf(RETINA_NUMBER_FIELD_PREFIX) === 0
        ? (["quanti"] as FieldType[])
        : key.indexOf(RETINA_STRING_FIELD_PREFIX) === 0
          ? (["quali"] as FieldType[])
          : inferFieldTypes(values, totalRowsCount);

    return types.map((type) => {
      const id = minimized[key];
      const label = removeRetinaPrefix(key);

      switch (type) {
        case "quali":
          return {
            type,
            id: types.length > 1 ? `${id}-s` : id,
            rawFieldId: key,
            label,
            typeLabel: types.length > 1 ? "as qualitative values" : undefined,
            nullValuesCount: totalRowsCount - values.length,
            values: mapValues(groupBy(values), (a, v) => ({
              id: v,
              label: v,
              count: a.length,
            })),
          };
        case "quanti": {
          const numbers = values.filter((v) => isNumber(v)).map((v) => +v) as number[];
          return {
            type,
            id: types.length > 1 ? `${id}-n` : id,
            rawFieldId: key,
            label,
            typeLabel: types.length > 1 ? "as quantitative values" : undefined,
            nullValuesCount: totalRowsCount - values.length,
            min: min(numbers) as number,
            max: max(numbers) as number,
          };
        }
        case "content":
        default:
          return {
            type: "content",
            id: types.length > 1 ? `${id}-t` : id,
            rawFieldId: key,
            label,
            nullValuesCount: totalRowsCount - values.length,
            typeLabel: types.length > 1 ? "as searchable text" : undefined,
          };
      }
    });
  });

  // Sort fields to put topics first
  const sortedFields = [...inferedFields, ...computedFields].sort((a, b) => {
    if (a.rawFieldId === 'topics') return -1;
    if (b.rawFieldId === 'topics') return 1;
    return 0;
  });

  return sortedFields;
}

export function enrichData(graph: RetinaGraph, hasEdges: boolean): Data {
  const fields = getFields(graph, "node", hasEdges);
  const edgeFields = getFields(graph, "edge", hasEdges);

  // Reindex number fields as numbers:
  const fieldsToReindex = uniq(
    fields.filter((field) => field.type === "quanti" && !field.computed).map((field) => field.rawFieldId),
  );
  if (fieldsToReindex.length) {
    graph.forEachNode((node) => {
      graph.updateNodeAttribute(node, "attributes", (attributes = {}) => ({
        ...attributes,
        ...fieldsToReindex.reduce((iter, key) => ({ ...iter, [key]: +attributes[key] }), {}),
      }));
    });
  }
  const edgeFieldsToReindex = uniq(
    edgeFields.filter((field) => field.type === "quanti" && !field.computed).map((field) => field.rawFieldId),
  );
  if (edgeFieldsToReindex.length) {
    graph.forEachEdge((edge) => {
      graph.updateEdgeAttribute(edge, "attributes", (attributes = {}) => ({
        ...attributes,
        ...fieldsToReindex.reduce((iter, key) => ({ ...iter, [key]: +attributes[key] }), {}),
      }));
    });
  }

  // Guess edge size field:
  const ACCEPTABLE_SIZE_FIELDS = new Set(["size", "weight"]);
  const edgesSizeField =
    edgeFields.find((field) => ACCEPTABLE_SIZE_FIELDS.has(field.rawFieldId.toLowerCase()) && field.type === "quanti")
      ?.rawFieldId || "size";

  return {
    graph,
    fieldsIndex: keyBy(fields, "id"),
    fields: fields.map((field) => field.id),
    edgeFieldsIndex: keyBy(edgeFields, "id"),
    edgeFields: edgeFields.map((field) => field.id),
    edgesSizeField,
    hasEdges,
  };
}

/**
 * Filtering data:
 * ***************
 */
export function countTerms(graph: RetinaGraph, field: Field, nodes?: string[] | null): Record<string, number> {
  const counts: Record<string, number> = {};
  const nodesToSearch = nodes || graph.nodes();

  nodesToSearch.forEach((n) => {
    const v = getValue(graph.getNodeAttributes(n), field);
    if (field.rawFieldId === 'topics' && typeof v === 'string') {
      v.split('|').map(t => t.trim()).filter(Boolean).forEach(topic => {
        counts[topic] = (counts[topic] || 0) + 1;
      });
    } else if (!isNil(v)) {
      counts[v] = (counts[v] || 0) + 1;
    }
  });

  return counts;
}
export function countRanges(
  graph: RetinaGraph,
  field: Field,
  ranges: [number, number][],
  nodes?: string[] | null,
): number[] {
  const counts: number[] = ranges.map(constant(0));
  const nodesToSearch = nodes || graph.nodes();

  nodesToSearch.forEach((n) => {
    const v = getValue(graph.getNodeAttributes(n), field);
    if (typeof v === "number") {
      const matchIndex = ranges.findIndex(([min, max]) => v >= min && v < max);
      if (matchIndex >= 0) counts[matchIndex]++;
    }
  });

  return counts;
}

export function filterNode(nodeData: NodeData, filters: Filter[], fieldsIndex: Record<string, Field>): boolean {
  return filters.every((filter) => {
    const field = fieldsIndex[filter.field];
    if (!field || field.type !== FILTER_FIELD_TYPES[filter.type]) return false;

    const value = getValue(nodeData, field);

    switch (filter.type) {
      case "range":
        return (
          typeof value === "number" &&
          (typeof filter.min !== "number" || filter.min <= value) &&
          (typeof filter.max !== "number" || filter.max > value)
        );
      case "terms":
        if (field.rawFieldId === 'topics' && typeof value === 'string') {
          const topicsArr = value.split('|').map(t => t.trim()).filter(Boolean);
          return filter.values.some(val => topicsArr.includes(val));
        }
        return !isNil(value) && filter.values.includes(value + "");
      case "search":
        return value && normalize(value).includes(filter.normalizedValue);
      default:
        return false;
    }
  });
}

export function filterNodes(data: Data, { filters }: Pick<NavState, "filters">): Set<string> | null {
  const { graph, fieldsIndex } = data;

  if (!filters || !filters.length) return null;
  return new Set(graph.filterNodes((node, attributes) => filterNode(attributes, filters, fieldsIndex)));
}

/**
 * Various views:
 * **************
 */
export function getFilterableFields(
  data: Data,
  { filterable, colorable, sizeable }: Pick<NavState, "filterable" | "colorable" | "sizeable">,
): Field[] {
  const { fields, fieldsIndex } = data;
  const filterableSet = new Set<string>([...(filterable || []), ...(colorable || []), ...(sizeable || [])]);

  return fields.filter((f) => filterableSet.has(f)).map((f) => fieldsIndex[f]);
}

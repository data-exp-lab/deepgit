import { clamp, groupBy, isNil, keyBy, map, omitBy, uniq } from "lodash";

import { arrayify } from "../utils/array";
import { normalize } from "../utils/string";
import { queryStringToRecord, urlSearchParamsToString } from "../utils/url";
import {
  DEFAULT_EDGE_SIZE_RATIO,
  DEFAULT_LABEL_SIZE,
  DEFAULT_LABEL_THRESHOLD,
  DEFAULT_NODE_SIZE_RATIO,
  MAX_EDGE_SIZE_RATIO,
  MAX_LABEL_SIZE,
  MAX_LABEL_THRESHOLD,
  MAX_NODE_SIZE_RATIO,
  MIN_EDGE_SIZE_RATIO,
  MIN_LABEL_SIZE,
  MIN_LABEL_THRESHOLD,
  MIN_NODE_SIZE_RATIO,
} from "./consts";
import { Data, FieldType, QualiField, Report } from "./data";

export interface SearchFilter {
  type: "search";
  field: string;
  value: string;
  normalizedValue: string;
}
export interface TermsFilter {
  type: "terms";
  field: string;
  values: string[];
}
export interface RangeFilter {
  type: "range";
  field: string;
  min?: number;
  max?: number;
}
export type Filter = SearchFilter | TermsFilter | RangeFilter;
export type FilterType = Filter["type"];

export const FILTER_FIELD_TYPES: Record<FilterType, FieldType> = {
  search: "content",
  range: "quanti",
  terms: "quali",
};

// Stand for "edit", "explore" or "view"
export const ROLES = ["d", "x", "v"] as const;
export const ROLES_SET: Set<string> = new Set(ROLES);
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = "d";

// Stand for "source", "target", "original" or "constant"
export const EDGE_COLORING_MODES = ["c", "o", "s", "t"] as const;
export const EDGE_COLORING_MODES_SET: Set<string> = new Set(EDGE_COLORING_MODES);
export type EdgeColoring = (typeof EDGE_COLORING_MODES)[number];
export const DEFAULT_EDGE_COLORING: EdgeColoring = "c";

// Stand for "original", "directed" or "undirected"
export const EDGE_DIRECTION_MODES = ["o", "d", "u"] as const;
export const EDGE_DIRECTION_MODES_SET: Set<string> = new Set(EDGE_DIRECTION_MODES);
export type EdgeDirection = (typeof EDGE_DIRECTION_MODES)[number];
export const DEFAULT_EDGE_DIRECTION: EdgeDirection = "o";

export interface NavState {
  url?: string | undefined;
  local?: boolean | undefined;
  role?: Role | undefined;

  // Editor state:
  sizeable?: string[] | undefined;
  colorable?: string[] | undefined;
  filterable?: string[] | undefined;
  subtitleFields?: string[] | undefined;
  disableDefaultSize?: boolean | undefined;
  disableDefaultColor?: boolean | undefined;
  showGraphMeta?: boolean | undefined;

  // Viewer state:
  nodeSizeField?: string | undefined;
  nodeColorField?: string | undefined;
  filters?: Filter[] | undefined;
  selectedNode?: string | undefined;
  nodeSizeRatio?: number | undefined;
  edgeSizeRatio?: number | undefined;
  useEdgeWeights?: boolean | undefined;
  labelThresholdRatio?: number | undefined;
  minLabelSize?: number | undefined;
  maxLabelSize?: number | undefined;
  edgeColoring?: EdgeColoring | undefined;
  edgeDirection?: EdgeDirection | undefined;

  // Only for some specific transitions:
  preventBlocker?: boolean;
}

export function cleanFilter(filter: Filter, data: Data): Filter | null {
  const field = data.fieldsIndex[filter.field];
  if (!field || field.type !== FILTER_FIELD_TYPES[filter.type]) return null;

  if (filter.type === "terms") {
    const valuesIndex = (field as QualiField).values;
    const values = filter.values.filter((v) => valuesIndex[v]);
    return values.length ? { ...filter, values } : null;
  } else if (filter.type === "range") {
    return typeof filter.min === "number" || typeof filter.max === "number" ? filter : null;
  } else {
    return filter.value ? filter : null;
  }
}

export function cleanNavState(state: NavState, data: Data): NavState {
  const { graph, fieldsIndex } = data;
  const {
    sizeable,
    colorable,
    filterable,
    subtitleFields,
    nodeColorField,
    nodeSizeField,
    filters,
    selectedNode,
    nodeSizeRatio,
    edgeSizeRatio,
    edgeColoring,
    edgeDirection,
    minLabelSize,
    maxLabelSize,
    showGraphMeta,
    labelThresholdRatio,
    disableDefaultSize,
    disableDefaultColor,
  } = state;

  const cleanedSubtitleFields = uniq((subtitleFields || []).filter((f) => fieldsIndex[f]));
  const cleanedColorable = uniq((colorable || []).filter((f) => fieldsIndex[f]));
  const cleanedSizeable = uniq((sizeable || []).filter((f) => fieldsIndex[f]?.type === "quanti"));
  const cleanedFilterable = uniq(
    (filterable || []).filter((f) => fieldsIndex[f] && !cleanedSizeable.includes(f) && !cleanedColorable.includes(f)),
  );
  const cleanedSizeableIndex = keyBy(cleanedSizeable);
  const cleanedColorableIndex = keyBy(cleanedColorable);

  const cleanedDisableDefaultSize = disableDefaultSize && !!cleanedSizeable.length;
  const cleanedDisableDefaultColor = disableDefaultColor && !!cleanedColorable.length;

  const cleanedFilters = (filters || [])
    .map((filter) => cleanFilter(filter, data))
    .filter((filter) => !isNil(filter)) as Filter[];

  const cleanedMinLabelSize = clamp(
    typeof minLabelSize === "number" ? minLabelSize : DEFAULT_LABEL_SIZE,
    MIN_LABEL_SIZE,
    MAX_LABEL_SIZE,
  );
  const cleanedMaxLabelSize = clamp(
    typeof maxLabelSize === "number" ? maxLabelSize : DEFAULT_LABEL_SIZE,
    cleanedMinLabelSize,
    MAX_LABEL_SIZE,
  );

  const cleanedState: NavState = {
    local: state.local,
    url: !state.local ? state.url : undefined,
    role: state.role && ROLES_SET.has(state.role) && state.role !== DEFAULT_ROLE ? state.role : undefined,
    // Editor state:
    sizeable: cleanedSizeable.length ? cleanedSizeable : undefined,
    colorable: cleanedColorable.length ? cleanedColorable : undefined,
    filterable: cleanedFilterable.length ? cleanedFilterable : undefined,
    subtitleFields: cleanedSubtitleFields.length ? cleanedSubtitleFields : undefined,
    // Viewer state:
    nodeSizeField:
      (nodeSizeField && fieldsIndex[nodeSizeField] && cleanedSizeableIndex[nodeSizeField]
        ? nodeSizeField
        : undefined) || (cleanedDisableDefaultSize ? cleanedSizeable[0] : undefined),
    nodeColorField:
      (nodeColorField && fieldsIndex[nodeColorField] && cleanedColorableIndex[nodeColorField]
        ? nodeColorField
        : undefined) || (cleanedDisableDefaultColor ? cleanedColorable[0] : undefined),
    filters: cleanedFilters.length ? cleanedFilters : undefined,
    selectedNode: graph.hasNode(selectedNode) ? selectedNode : undefined,
    nodeSizeRatio:
      typeof nodeSizeRatio === "number" && nodeSizeRatio !== DEFAULT_NODE_SIZE_RATIO
        ? clamp(nodeSizeRatio, MIN_NODE_SIZE_RATIO, MAX_NODE_SIZE_RATIO)
        : undefined,
    edgeSizeRatio:
      typeof edgeSizeRatio === "number" && edgeSizeRatio !== DEFAULT_EDGE_SIZE_RATIO
        ? clamp(edgeSizeRatio, MIN_EDGE_SIZE_RATIO, MAX_EDGE_SIZE_RATIO)
        : undefined,
    labelThresholdRatio:
      typeof labelThresholdRatio === "number" && labelThresholdRatio !== DEFAULT_LABEL_THRESHOLD
        ? clamp(labelThresholdRatio, MIN_LABEL_THRESHOLD, MAX_LABEL_THRESHOLD)
        : undefined,
    edgeColoring:
      edgeColoring && EDGE_COLORING_MODES_SET.has(edgeColoring) && edgeColoring !== DEFAULT_EDGE_COLORING
        ? edgeColoring
        : undefined,
    edgeDirection:
      edgeDirection && EDGE_DIRECTION_MODES_SET.has(edgeDirection) && edgeDirection !== DEFAULT_EDGE_DIRECTION
        ? edgeDirection
        : undefined,
    showGraphMeta: showGraphMeta === true ? true : undefined,
    minLabelSize: cleanedMinLabelSize !== DEFAULT_LABEL_SIZE ? cleanedMinLabelSize : undefined,
    maxLabelSize: cleanedMaxLabelSize !== DEFAULT_LABEL_SIZE ? cleanedMaxLabelSize : undefined,
    disableDefaultSize: cleanedDisableDefaultSize || undefined,
    disableDefaultColor: cleanedDisableDefaultColor || undefined,
  };

  return omitBy(cleanedState, isNil) as NavState;
}

export function navStateToQueryURL(state: NavState): string {
  const params = new URLSearchParams();

  if (state.url) params.append("url", state.url);
  if (state.local) params.append("l", "1");
  if (state.role) params.append("r", state.role);
  if (state.nodeColorField) params.append("c", state.nodeColorField);
  if (state.nodeSizeField) params.append("s", state.nodeSizeField);
  if (state.selectedNode) params.append("n", state.selectedNode);
  if (state.sizeable) state.sizeable.forEach((f) => params.append("sa", f));
  if (state.colorable) state.colorable.forEach((f) => params.append("ca", f));
  if (state.filterable) state.filterable.forEach((f) => params.append("fa", f));
  if (state.subtitleFields) state.subtitleFields.forEach((f) => params.append("st", f));
  if (state.filters) {
    state.filters.forEach((filter) => {
      if (filter.type === "terms") {
        const key = `${filter.field}.t`;
        filter.values.forEach((s) => params.append(key, s));
      } else if (filter.type === "range") {
        if (typeof filter.min === "number") params.append(`${filter.field}.min`, filter.min + "");
        if (typeof filter.max === "number") params.append(`${filter.field}.max`, filter.max + "");
      } else {
        params.append(`${filter.field}.v`, filter.value + "");
      }
    });
  }
  if (state.nodeSizeRatio) params.append("nr", state.nodeSizeRatio + "");
  if (state.edgeSizeRatio) params.append("er", state.edgeSizeRatio + "");
  if (state.edgeColoring) params.append("ec", state.edgeColoring);
  if (state.edgeDirection) params.append("ed", state.edgeDirection);
  if (state.showGraphMeta) params.append("gm", "1");
  if (state.labelThresholdRatio) params.append("lt", state.labelThresholdRatio + "");
  if (state.disableDefaultSize) params.append("ds", "1");
  if (state.disableDefaultColor) params.append("dc", "1");
  if (state.minLabelSize) params.append("ls", state.minLabelSize + "");
  if (state.maxLabelSize) params.append("le", state.maxLabelSize + "");

  return urlSearchParamsToString(params);
}

export function queryURLToNavState(queryURL: string): NavState {
  const { url, l, r, s, c, n, fa, ca, sa, le, ls, nr, er, ec, ed, gm, lt, ds, dc, st, ...query } =
    queryStringToRecord(queryURL);
  const navState: NavState = {};

  if (typeof url === "string") navState.url = url;
  if (typeof l === "string") navState.local = l === "1";
  if (typeof r === "string" && ROLES_SET.has(r)) navState.role = r as Role;
  if (typeof s === "string") navState.nodeSizeField = s;
  if (typeof c === "string") navState.nodeColorField = c;
  if (typeof n === "string") navState.selectedNode = n;
  if (typeof nr === "string") navState.nodeSizeRatio = +nr;
  if (typeof er === "string") navState.edgeSizeRatio = +er;
  if (typeof ec === "string") navState.edgeColoring = ec as EdgeColoring;
  if (typeof ed === "string") navState.edgeDirection = ed as EdgeDirection;
  if (typeof gm === "string") navState.showGraphMeta = gm === "1";
  if (typeof ls === "string") navState.minLabelSize = +ls;
  if (typeof le === "string") navState.maxLabelSize = +le;
  if (typeof lt === "string") navState.labelThresholdRatio = +lt;
  if (typeof ds === "string") navState.disableDefaultSize = ds === "1";
  if (typeof dc === "string") navState.disableDefaultColor = dc === "1";
  if (sa) navState.sizeable = arrayify(sa);
  if (ca) navState.colorable = arrayify(ca);
  if (fa) navState.filterable = arrayify(fa);
  if (st) navState.subtitleFields = arrayify(st);

  const fields = groupBy(Object.keys(query), (key) => key.replace(/\.(v|t|min|max)$/, ""));
  const filters = map(fields, ([q0, q1], field): Filter => {
    // Terms case:
    if (q0 === `${field}.t`) {
      return {
        type: "terms",
        field,
        values: arrayify(query[q0]),
      };
      // Search case:
    } else if (q0 === `${field}.v`) {
      return {
        type: "search",
        field,
        value: query[q0] + "",
        normalizedValue: normalize(query[q0] + ""),
      };
      // Range case:
    } else {
      const filter: Filter = {
        type: "range",
        field,
      };
      [q0, q1].forEach((key) => {
        if (key === `${field}.min`) filter.min = +query[key];
        if (key === `${field}.max`) filter.max = +query[key];
      });
      return filter;
    }
  });
  if (filters.length) navState.filters = filters;

  return navState;
}

export function guessNavState(data: Data, report: Report): NavState {
  const { fields, fieldsIndex, graph } = data;

  const colorable = fields.filter(
    (f) => fieldsIndex[f].type === "quali" && fieldsIndex[f].nullValuesCount <= graph.order * 0.5,
  );
  const colorableRawFieldIDsSet = new Set(colorable.map((f) => fieldsIndex[f].rawFieldId));
  const sizeable = fields.filter(
    (f) =>
      fieldsIndex[f].type === "quanti" &&
      !colorableRawFieldIDsSet.has(fieldsIndex[f].rawFieldId) &&
      fieldsIndex[f].nullValuesCount <= graph.order * 0.5,
  );

  return cleanNavState(
    {
      sizeable,
      colorable,
      nodeSizeField: (report.missingNodeSizes || 0) >= graph.order * 0.5 ? sizeable[0] : undefined,
      nodeColorField: (report.missingNodeColors || 0) >= graph.order * 0.5 ? colorable[0] : undefined,
      edgeColoring: (report.missingEdgeColors || 0) >= graph.size * 0.5 ? "c" : "o",
    },
    data,
  );
}

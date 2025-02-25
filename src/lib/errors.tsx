import { flatMap, pickBy, sortBy } from "lodash";

import { Report } from "./data";
import { NotificationInput } from "./notifications";

/**
 * Errors management:
 */
export const MISSING_URL = "missing-url";
export const MISSING_FILE = "missing-file";
export const BAD_EXTENSION = "bad-ext";
export const BAD_URL = "bad-url";
export const BAD_FILE = "bad-file";
export const UNKNOWN = "unknown";

const ERRORS_DICT: Record<string, string> = {
  [MISSING_URL]: "You need to specify a graph file URL.",
  [MISSING_FILE]: "You need to specify a local file or a graph URL to load.",
  [BAD_EXTENSION]: "The extension of the given graph file is not recognized.",
  [BAD_URL]: "The graph at the given URL could not be loaded.",
  [BAD_FILE]: "The graph at the given URL could not be parsed.",
  [UNKNOWN]: "An unknown error occurred.",
};

export function getErrorMessage(errorType: string): string {
  return ERRORS_DICT[errorType] || "Something went wrong.";
}

/**
 * Reports management:
 */
const LEVELS_ORDER = {
  error: 0,
  warning: 1,
  info: 2,
};

const REPORT_DICT: Record<
  string,
  { level: "info" | "warning" | "error"; log: (count: number) => string | JSX.Element }
> = {
  missingEdgeSizes: {
    level: "info",
    log: (n) => `${n === 1 ? "One" : n} edge${n > 1 ? "s have" : " has"} no size.`,
  },
  missingEdgeColors: {
    level: "info",
    log: (n) => `${n === 1 ? "One" : n} edge${n > 1 ? "s have" : " has"} no color.`,
  },
  missingNodeSizes: {
    level: "info",
    log: (n) => `${n === 1 ? "One" : n} node${n > 1 ? "s have" : " has"} no size.`,
  },
  missingNodeColors: {
    level: "info",
    log: (n) => `${n === 1 ? "One" : n} node${n > 1 ? "s have" : " has"} no color. `,
  },
  missingNodeLabels: {
    level: "warning",
    log: (n) =>
      `${n > 1 ? n : "One"} node${n > 1 ? "s have" : " has"} no label. ${
        n > 1 ? "Their keys are" : "Its key is"
      } used instead (${n > 1 ? "they are" : "it is"} italic in the graph).`,
  },
  missingNodePositions: {
    level: "warning",
    log: (n) => (
      <>
        {n === 1 ? "One" : n} node{n > 1 ? "s have" : " has"} no position. The layout has been determined using{" "}
        <a
          href="https://graphology.github.io/standard-library/layout-forceatlas2.html"
          target="_blank"
          rel="noreferrer"
        >
          ForceAtlas2
        </a>
        . However, it would be better to load a file with the layout already computed.
      </>
    ),
  },
};

export function getReportNotification(report: Report, skipInfo?: boolean): NotificationInput | null {
  const minimalReport: Record<string, number> = pickBy(report, (val, key) => !!val && !!REPORT_DICT[key]);
  const messages = sortBy(
    flatMap(minimalReport, (val, key) => {
      const log = REPORT_DICT[key].log(val);
      const level = REPORT_DICT[key].level;

      if (skipInfo && level === "info") return [];

      return [{ message: log, level }];
    }),
    ({ level }) => LEVELS_ORDER[level] || Infinity,
  );

  if (!messages.length) return null;

  const mostImportantLevel = messages[0].level;

  return {
    type: mostImportantLevel,
    keepAlive: mostImportantLevel !== "info",
    message: (
      <>
        {messages.length > 1 ? "Some things" : "Something"} to note about the graph dataset:
        <ul className="mb-0 ps-3">
          {messages.map(({ message, level }, i) => (
            <li key={i} className={level !== "info" ? "fw-bold" : ""}>
              {message}
            </li>
          ))}
        </ul>
      </>
    ),
  };
}

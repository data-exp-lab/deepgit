import { MultiGraph } from "graphology";
import { describe, expect, test } from "vitest";

import { normalize } from "../utils/string";
import {
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
import { Data, enrichData, prepareGraph } from "./data";
import {
  DEFAULT_EDGE_COLORING,
  DEFAULT_EDGE_DIRECTION,
  DEFAULT_ROLE,
  Role,
  cleanFilter,
  cleanNavState,
  navStateToQueryURL,
  queryURLToNavState,
} from "./navState";

function data(): Data {
  const rawGraph = new MultiGraph();
  rawGraph.import({
    nodes: [
      { key: "John", attributes: { name: "Doe", age: 34, childrenCount: 2, description: "Lorem ipsum" } },
      { key: "Jack", attributes: { name: "Black", age: 56, childrenCount: 1, description: "Lorem ipsum dolor" } },
    ],
    edges: [{ source: "John", target: "Jack" }],
  });

  const { graph } = prepareGraph(rawGraph);
  return enrichData(graph);
}

describe("NavState", () => {
  describe("#cleanFilter", () => {
    test("should do nothing for valid terms filter", () => {
      expect(cleanFilter({ type: "terms", field: "n", values: ["Doe"] }, data())).toStrictEqual({
        type: "terms",
        field: "n",
        values: ["Doe"],
      });
    });
    test("should remove unexisting values from terms filters", () => {
      expect(cleanFilter({ type: "terms", field: "n", values: ["Doe", "Obama"] }, data())).toStrictEqual({
        type: "terms",
        field: "n",
        values: ["Doe"],
      });
    });
    test("should return null if no term value exists", () => {
      expect(cleanFilter({ type: "terms", field: "n", values: ["Obama"] }, data())).toStrictEqual(null);
    });
    test("should return null if the terms field does not exist", () => {
      expect(cleanFilter({ type: "terms", field: "firstName", values: ["John"] }, data())).toStrictEqual(null);
    });
    test("should return null if the terms field is not a quali field", () => {
      expect(cleanFilter({ type: "terms", field: "a-n", values: ["10"] }, data())).toStrictEqual(null);
    });

    test("should do nothing for valid range filter", () => {
      expect(cleanFilter({ type: "range", field: "a-n", min: 10 }, data())).toStrictEqual({
        type: "range",
        field: "a-n",
        min: 10,
      });
    });
    test("should return null if there is no min nor no max", () => {
      expect(cleanFilter({ type: "range", field: "a-n" }, data())).toStrictEqual(null);
    });
    test("should return null if the range field does not exist", () => {
      expect(cleanFilter({ type: "range", field: "birthYear", max: 1980 }, data())).toStrictEqual(null);
    });
    test("should return null if the range field is not a quanti field", () => {
      expect(cleanFilter({ type: "range", field: "n", max: 123 }, data())).toStrictEqual(null);
    });
  });

  describe("#cleanNavState", () => {
    test("should do nothing for valid nav state", () => {
      expect(
        cleanNavState(
          {
            sizeable: ["a-n"],
            colorable: ["n"],
            nodeSizeField: "a-n",
            nodeColorField: "n",
            selectedNode: "John",
            disableDefaultSize: true,
            disableDefaultColor: true,
            edgeColoring: "s",
          },
          data(),
        ),
      ).toStrictEqual({
        sizeable: ["a-n"],
        colorable: ["n"],
        nodeSizeField: "a-n",
        nodeColorField: "n",
        selectedNode: "John",
        disableDefaultSize: true,
        disableDefaultColor: true,
        edgeColoring: "s",
      });
    });

    test("should remove `role` if it is not a proper value", () => {
      expect(cleanNavState({ role: "woopsy" as Role }, data())).toStrictEqual({});
    });
    test("should remove `role` if it is the default value", () => {
      expect(cleanNavState({ role: DEFAULT_ROLE }, data())).toStrictEqual({});
    });
    test("should keep `role` otherwise", () => {
      expect(cleanNavState({ role: "x" }, data())).toStrictEqual({ role: "x" });
      expect(cleanNavState({ role: "v" }, data())).toStrictEqual({ role: "v" });
    });

    test("should remove `selectedNode` if it does not exist in the graph", () => {
      expect(cleanNavState({ selectedNode: "nothing" }, data())).toStrictEqual({});
    });

    test("should keep `subtitleFields` if they are valid", () => {
      expect(cleanNavState({ subtitleFields: ["a-n"] }, data())).toStrictEqual({ subtitleFields: ["a-n"] });
    });

    test("should remove `subtitleFields` if it does not exist in the graph", () => {
      expect(cleanNavState({ subtitleFields: ["nothing"] }, data())).toStrictEqual({});
    });

    test("should remove `color` if it does not exist in the graph", () => {
      expect(cleanNavState({ nodeColorField: "nothing" }, data())).toStrictEqual({});
    });

    test("should remove `color` if it is not declared in `colorable`", () => {
      expect(cleanNavState({ nodeColorField: "n", colorable: ["a-n"] }, data())).toStrictEqual({ colorable: ["a-n"] });
    });

    test("should remove `size` if it does not exist in the graph", () => {
      expect(cleanNavState({ nodeSizeField: "nothing" }, data())).toStrictEqual({});
    });

    test("should remove `size` if it is not declared in `sizeable`", () => {
      expect(cleanNavState({ nodeSizeField: "a-n", sizeable: ["c-n"] }, data())).toStrictEqual({ sizeable: ["c-n"] });
    });

    test("should remove `size` if it is not a range field", () => {
      expect(cleanNavState({ nodeSizeField: "n", sizeable: ["n"] }, data())).toStrictEqual({});
    });

    test("should remove empty `filters` array", () => {
      expect(cleanNavState({ filters: [] }, data())).toStrictEqual({});
    });

    test("should clean `filters` array", () => {
      expect(
        cleanNavState({ filters: [{ type: "terms", field: "n", values: ["Doe", "Obama"] }] }, data()),
      ).toStrictEqual({ filters: [{ type: "terms", field: "n", values: ["Doe"] }] });
    });

    test("should remove `nodeSizeRatio` if it is not a proper number", () => {
      expect(cleanNavState({ nodeSizeRatio: "5" as any }, data())).toStrictEqual({});
    });
    test("should remove `nodeSizeRatio` if it is the default correction ratio", () => {
      expect(cleanNavState({ nodeSizeRatio: DEFAULT_NODE_SIZE_RATIO }, data())).toStrictEqual({});
    });
    test("should clamp `nodeSizeRatio` if it is out of the tolerance range", () => {
      expect(cleanNavState({ nodeSizeRatio: 0.001 }, data())).toStrictEqual({ nodeSizeRatio: MIN_NODE_SIZE_RATIO });
      expect(cleanNavState({ nodeSizeRatio: 1000 }, data())).toStrictEqual({ nodeSizeRatio: MAX_NODE_SIZE_RATIO });
    });

    test("should remove `edgeSizeRatio` if it is not a proper number", () => {
      expect(cleanNavState({ edgeSizeRatio: "5" as any }, data())).toStrictEqual({});
    });
    test("should remove `edgeSizeRatio` if it is the default correction ratio", () => {
      expect(cleanNavState({ edgeSizeRatio: DEFAULT_NODE_SIZE_RATIO }, data())).toStrictEqual({});
    });
    test("should clamp `edgeSizeRatio` if it is out of the tolerance range", () => {
      expect(cleanNavState({ edgeSizeRatio: 0.001 }, data())).toStrictEqual({ edgeSizeRatio: MIN_EDGE_SIZE_RATIO });
      expect(cleanNavState({ edgeSizeRatio: 1000 }, data())).toStrictEqual({ edgeSizeRatio: MAX_EDGE_SIZE_RATIO });
    });

    test("should remove `edgeColoring` if it is not a proper value", () => {
      expect(cleanNavState({ edgeColoring: "woopsy" as any }, data())).toStrictEqual({});
    });
    test("should remove `edgeColoring` if it is the default value", () => {
      expect(cleanNavState({ edgeColoring: DEFAULT_EDGE_COLORING }, data())).toStrictEqual({});
    });
    test("should keep `edgeColoring` otherwise", () => {
      expect(cleanNavState({ edgeColoring: "o" }, data())).toStrictEqual({ edgeColoring: "o" });
      expect(cleanNavState({ edgeColoring: "s" }, data())).toStrictEqual({ edgeColoring: "s" });
      expect(cleanNavState({ edgeColoring: "t" }, data())).toStrictEqual({ edgeColoring: "t" });
    });

    test("should remove `edgeDirection` if it is not a proper value", () => {
      expect(cleanNavState({ edgeDirection: "woopsy" as any }, data())).toStrictEqual({});
    });
    test("should remove `edgeDirection` if it is the default value", () => {
      expect(cleanNavState({ edgeDirection: DEFAULT_EDGE_DIRECTION }, data())).toStrictEqual({});
    });
    test("should keep `edgeDirection` otherwise", () => {
      expect(cleanNavState({ edgeDirection: "d" }, data())).toStrictEqual({ edgeDirection: "d" });
      expect(cleanNavState({ edgeDirection: "u" }, data())).toStrictEqual({ edgeDirection: "u" });
    });

    test("should remove `showGraphMeta` if it is not `true`", () => {
      expect(cleanNavState({ showGraphMeta: false }, data())).toStrictEqual({});
      expect(cleanNavState({ showGraphMeta: 123 as any }, data())).toStrictEqual({});
    });
    test("should keep `showGraphMeta` if it is `true`", () => {
      expect(cleanNavState({ showGraphMeta: true }, data())).toStrictEqual({ showGraphMeta: true });
    });

    test("should remove min/max label size if it is not proper numbers", () => {
      expect(cleanNavState({ minLabelSize: "5" as any, maxLabelSize: "25" as any }, data())).toStrictEqual({});
    });
    test("should remove min/max label size if they are the default correction ratio", () => {
      expect(
        cleanNavState({ minLabelSize: DEFAULT_LABEL_SIZE, maxLabelSize: DEFAULT_LABEL_SIZE }, data()),
      ).toStrictEqual({});
    });
    test("should clamp min/max label size if out of the tolerance range", () => {
      expect(cleanNavState({ minLabelSize: 0.001, maxLabelSize: 0.001 }, data())).toStrictEqual({
        minLabelSize: MIN_LABEL_SIZE,
        maxLabelSize: MIN_LABEL_SIZE,
      });
      expect(cleanNavState({ minLabelSize: 1000, maxLabelSize: 1000 }, data())).toStrictEqual({
        minLabelSize: MAX_LABEL_SIZE,
        maxLabelSize: MAX_LABEL_SIZE,
      });
    });
    test("should clamp max label size if lower than min label size", () => {
      expect(cleanNavState({ minLabelSize: 7, maxLabelSize: 6 }, data())).toStrictEqual({
        minLabelSize: 7,
        maxLabelSize: 7,
      });
    });

    test("should remove `labelThresholdRatio` if it is not a proper number", () => {
      expect(cleanNavState({ labelThresholdRatio: "5" as any }, data())).toStrictEqual({});
    });
    test("should remove `labelThresholdRatio` if it is the default correction ratio", () => {
      expect(cleanNavState({ labelThresholdRatio: DEFAULT_LABEL_THRESHOLD }, data())).toStrictEqual({});
    });
    test("should clamp `labelThresholdRatio` if it is out of the tolerance range", () => {
      expect(cleanNavState({ labelThresholdRatio: 0.001 }, data())).toStrictEqual({
        labelThresholdRatio: MIN_LABEL_THRESHOLD,
      });
      expect(cleanNavState({ labelThresholdRatio: 1000 }, data())).toStrictEqual({
        labelThresholdRatio: MAX_LABEL_THRESHOLD,
      });
    });
    test("should remove `url` when `local` is true", () => {
      expect(cleanNavState({ url: "http://pouet", local: true }, data())).toStrictEqual({
        local: true,
      });
    });
    test("should remove `local` when it is not `true`", () => {
      expect(cleanNavState({ disableDefaultSize: true }, data())).toStrictEqual({});
    });
    test("should remove `disableDefaultSize` when `sizeable` is empty", () => {
      expect(cleanNavState({ disableDefaultSize: true }, data())).toStrictEqual({});
    });
    test("should remove `disableDefaultColor` when `colorable` is empty", () => {
      expect(cleanNavState({ disableDefaultColor: true }, data())).toStrictEqual({});
    });
    test("should force a `size` value when `disableDefaultSize` is true", () => {
      expect(cleanNavState({ disableDefaultSize: true, sizeable: ["a-n", "c-n"] }, data())).toStrictEqual({
        disableDefaultSize: true,
        sizeable: ["a-n", "c-n"],
        nodeSizeField: "a-n",
      });
      expect(
        cleanNavState({ disableDefaultSize: true, sizeable: ["a-n", "c-n"], nodeSizeField: "c-n" }, data()),
      ).toStrictEqual({
        disableDefaultSize: true,
        sizeable: ["a-n", "c-n"],
        nodeSizeField: "c-n",
      });
    });
    test("should force a `color` value when `disableDefaultColor` is true", () => {
      expect(cleanNavState({ disableDefaultColor: true, colorable: ["n", "a-n"] }, data())).toStrictEqual({
        disableDefaultColor: true,
        colorable: ["n", "a-n"],
        nodeColorField: "n",
      });
      expect(
        cleanNavState({ disableDefaultColor: true, colorable: ["n", "a-n"], nodeColorField: "a-n" }, data()),
      ).toStrictEqual({
        disableDefaultColor: true,
        colorable: ["n", "a-n"],
        nodeColorField: "a-n",
      });
    });
  });

  describe("#navStateToQueryURL", () => {
    test("should work with base keys", () => {
      expect(
        navStateToQueryURL({
          url: "foobar",
          role: "d",
          nodeColorField: "name",
          nodeSizeField: "age",
          selectedNode: "John",
          subtitleFields: ["age"],
        }),
      ).toBe("url=foobar&r=d&c=name&s=age&n=John&st=age");
      expect(
        navStateToQueryURL({
          local: true,
          minLabelSize: 10,
          maxLabelSize: 15,
          nodeSizeRatio: 0.5,
          edgeSizeRatio: 0.7,
          edgeColoring: "s",
          edgeDirection: "d",
          showGraphMeta: true,
          labelThresholdRatio: 2,
        }),
      ).toBe("l=1&nr=0.5&er=0.7&ec=s&ed=d&gm=1&lt=2&ls=10&le=15");
    });

    test("should work with one filter", () => {
      expect(
        navStateToQueryURL({
          filters: [{ type: "terms", field: "name", values: ["Doe"] }],
        }),
      ).toBe("name.t=Doe");
    });

    test("should work with multiple filters", () => {
      expect(
        navStateToQueryURL({
          filters: [
            { type: "terms", field: "name", values: ["Doe", "Black"] },
            { type: "range", field: "age", min: 10, max: 30 },
            { type: "search", field: "content", value: "loremipsum", normalizedValue: normalize("loremipsum") },
          ],
        }),
      ).toBe("name.t[]=Doe&name.t[]=Black&age.min=10&age.max=30&content.v=loremipsum");
    });

    test("should handle properly filters encoding", () => {
      expect(
        navStateToQueryURL({
          filters: [{ type: "terms", field: "name&firstname", values: ['Jean, "Jacques"', "José"] }],
        }),
      ).toBe("name%26firstname.t[]=Jean%2C%20%22Jacques%22&name%26firstname.t[]=Jos%C3%A9");
    });

    test("should work with filterable fields", () => {
      expect(navStateToQueryURL({ filterable: ["age", "name"] })).toBe("fa[]=age&fa[]=name");
    });
  });

  describe("#queryURLToNavState", () => {
    test("should work with base keys", () => {
      expect(queryURLToNavState("url=foobar&r=d&c=name&s=age&n=John&st[]=age")).toStrictEqual({
        url: "foobar",
        role: "d",
        nodeColorField: "name",
        nodeSizeField: "age",
        selectedNode: "John",
        subtitleFields: ["age"],
      });
      expect(queryURLToNavState("l=1&nr=0.5&er=0.7&ec=s&ed=d&gm=1&lt=2&ls=10&le=15")).toStrictEqual({
        local: true,
        minLabelSize: 10,
        maxLabelSize: 15,
        nodeSizeRatio: 0.5,
        edgeSizeRatio: 0.7,
        edgeColoring: "s",
        edgeDirection: "d",
        showGraphMeta: true,
        labelThresholdRatio: 2,
      });
    });

    test("should work with one filter", () => {
      expect(queryURLToNavState("name.t=Doe")).toStrictEqual({
        filters: [{ type: "terms", field: "name", values: ["Doe"] }],
      });
    });

    test("should work with filters", () => {
      expect(
        queryURLToNavState("name.t[]=Doe&name.t[]=Black&age.min=10&age.max=30&content.v=loremipsum"),
      ).toStrictEqual({
        filters: [
          { type: "terms", field: "name", values: ["Doe", "Black"] },
          { type: "range", field: "age", min: 10, max: 30 },
          { type: "search", field: "content", value: "loremipsum", normalizedValue: normalize("loremipsum") },
        ],
      });
    });

    test("should handle properly filters encoding", () => {
      expect(
        queryURLToNavState("name%26firstname.t[]=Jean%2C%20%22Jacques%22&name%26firstname.t[]=Jos%C3%A9"),
      ).toStrictEqual({
        filters: [{ type: "terms", field: "name&firstname", values: ['Jean, "Jacques"', "José"] }],
      });
    });

    test("should work with filterable fields", () => {
      expect(queryURLToNavState("fa=age")).toStrictEqual({ filterable: ["age"] });
      expect(queryURLToNavState("fa[]=age")).toStrictEqual({ filterable: ["age"] });
      expect(queryURLToNavState("fa=age&fa=name")).toStrictEqual({ filterable: ["age", "name"] });
      expect(queryURLToNavState("fa[]=age&fa[]=name")).toStrictEqual({ filterable: ["age", "name"] });
    });
  });
});

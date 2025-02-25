import { describe, expect, test } from "vitest";

import { buildURLSearchParams, queryStringToRecord, urlSearchParamsToString } from "./url";

describe("URL utils", () => {
  describe("#buildURLSearchParams", () => {
    test("should work 'normally' with normal single values cases", () => {
      const data = { a: "abc", b: "def" };
      expect(buildURLSearchParams(data).toString()).toStrictEqual(new URLSearchParams(data).toString());
    });

    test("should encode arrays using [] suffix", () => {
      const data = { a: "abc", b: ["def", "ghi"] };
      const params = buildURLSearchParams(data);
      expect([...params.getAll("a")]).toStrictEqual(["abc"]);
      expect([...params.getAll("b")]).toStrictEqual(["def", "ghi"]);
    });
  });

  describe("#urlSearchParamsToString", () => {
    test("should work 'normally' with normal single values cases", () => {
      const params = new URLSearchParams();
      params.append("a", "abc");
      params.append("b", "def");
      expect(urlSearchParamsToString(params)).toBe(params.toString());
    });

    test("should detect arrays", () => {
      const params = new URLSearchParams();
      params.append("a", "abc");
      params.append("b", "def");
      params.append("b", "ghi");
      expect(urlSearchParamsToString(params)).toStrictEqual("a=abc&b[]=def&b[]=ghi");
    });
  });

  describe("#queryStringToRecord", () => {
    test("should work 'normally' with normal single values cases", () => {
      expect(queryStringToRecord("a=abc&b=def")).toStrictEqual({ a: "abc", b: "def" });
    });

    test("should detect arrays", () => {
      expect(queryStringToRecord("a=abc&b[]=def&b[]=ghi")).toStrictEqual({ a: "abc", b: ["def", "ghi"] });
    });

    test("should be flexible about the `[]` suffix", () => {
      expect(queryStringToRecord("a=abc")).toStrictEqual({ a: "abc" });
      expect(queryStringToRecord("a[]=abc")).toStrictEqual({ a: "abc" });
      expect(queryStringToRecord("a=abc&a=def")).toStrictEqual({ a: ["abc", "def"] });
      expect(queryStringToRecord("a[]=abc&a[]=def")).toStrictEqual({ a: ["abc", "def"] });
    });
  });
});

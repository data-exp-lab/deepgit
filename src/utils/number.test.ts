import { times } from "lodash";
import { describe, expect, test } from "vitest";

import { findRanges, isNumber, shortenNumber } from "./number";

describe("Number utils", () => {
  describe("#findRanges", () => {
    test("should find around 10 steps", () => {
      expect(findRanges(0.3, 9.7)).toStrictEqual({ unit: 1, ranges: times(10).map((n) => [n, n + 1]) });
      expect(findRanges(3, 97)).toStrictEqual({ unit: 10, ranges: times(10).map((n) => [n * 10, (n + 1) * 10]) });
    });

    test("should look for a better 2 fit", () => {
      expect(findRanges(0.3, 19.7)).toStrictEqual({ unit: 2, ranges: times(10).map((n) => [2 * n, 2 * (n + 1)]) });
    });

    test("should look for the proper power of 10", () => {
      expect(findRanges(0.03, 0.97)).toStrictEqual({ unit: 0.1, ranges: times(10).map((n) => [n / 10, (n + 1) / 10]) });
    });

    test("should look for a better 2 or 5 fit, with the proper power of 10", () => {
      expect(findRanges(10.03, 11.97)).toStrictEqual({
        unit: 0.2,
        ranges: times(10).map((n) => [10 + n / 5, 10 + (n + 1) / 5]),
      });
    });

    test("should make an extra range if the max fits exactly the last range", () => {
      expect(findRanges(0, 8).ranges).toStrictEqual(times(9).map((n) => [n, n + 1]));
      expect(findRanges(0, 7.99).ranges).toStrictEqual(times(8).map((n) => [n, n + 1]));
    });
  });

  describe("#shortenNumber", () => {
    test("should normally print small numbers", () => {
      expect(shortenNumber(0)).toStrictEqual("0");
      expect(shortenNumber(1)).toStrictEqual("1");
      expect(shortenNumber(123)).toStrictEqual("123");
      expect(shortenNumber(1.23)).toStrictEqual("1.23");
    });

    test("should work properly with small floats", () => {
      expect(shortenNumber(0.0001)).toStrictEqual("0.0001");
      expect(shortenNumber(0.000123456)).toStrictEqual("0.000123");
      expect(shortenNumber(1.000123456)).toStrictEqual("1");
      expect(shortenNumber(1234.000123456)).toStrictEqual("1.2k");
    });

    test("should work properly over 100", () => {
      expect(shortenNumber(100)).toStrictEqual("100");
      expect(shortenNumber(1000)).toStrictEqual("1k");
      expect(shortenNumber(1234)).toStrictEqual("1.2k");
      expect(shortenNumber(12345)).toStrictEqual("12.3k");
      expect(shortenNumber(123456)).toStrictEqual("123.5k");
      expect(shortenNumber(1234567)).toStrictEqual("1.2m");
    });

    test("should work properly with negative values", () => {
      expect(shortenNumber(-1)).toStrictEqual("-1");
      expect(shortenNumber(-100)).toStrictEqual("-100");
      expect(shortenNumber(-1000)).toStrictEqual("-1k");
      expect(shortenNumber(-123)).toStrictEqual("-123");
      expect(shortenNumber(-1234)).toStrictEqual("-1.2k");
      expect(shortenNumber(-12345)).toStrictEqual("-12.3k");
      expect(shortenNumber(-123456)).toStrictEqual("-123.5k");
      expect(shortenNumber(-1234567)).toStrictEqual("-1.2m");
      expect(shortenNumber(-0.0001)).toStrictEqual("-0.0001");
      expect(shortenNumber(-0.000123456)).toStrictEqual("-0.000123");
      expect(shortenNumber(-1234.000123456)).toStrictEqual("-1.2k");
    });
  });

  describe("#isNumber", () => {
    test("should work with obvious cases", () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-123)).toBe(true);
      expect(isNumber("123")).toBe(true);
      expect(isNumber("-123")).toBe(true);

      expect(isNumber(false)).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber("abc")).toBe(false);
      expect(isNumber({ abc: 123 })).toBe(false);
      expect(isNumber([123])).toBe(false);
      expect(isNumber(new Date())).toBe(false);
    });

    test("should properly handles strings that are not optimal numbers", () => {
      expect(isNumber("   123")).toBe(true);
      expect(isNumber("123   ")).toBe(true);
      expect(isNumber("123.00")).toBe(true);
      expect(isNumber("000123")).toBe(true);
    });
  });
});

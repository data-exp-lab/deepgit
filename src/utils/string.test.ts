import { describe, expect, test } from "vitest";

import { minimize, normalize, slugify } from "./string";

describe("String utils", () => {
  describe("#slugify", () => {
    test("should replace characters that are not letters or digits by _s", () => {
      expect(slugify("123abc456!*;   lol")).toBe("123abc456_lol");
    });

    test("should toggle to lower case", () => {
      expect(slugify("LoreMIpSumdOLor")).toBe("loremipsumdolor");
    });

    test("should clean accents", () => {
      expect(slugify("pâté")).toBe("pate");
    });
  });

  describe("#normalize", () => {
    test("should not remove characters that are not letters", () => {
      expect(normalize("123abc456!*;   lol")).toBe("123abc456!*;   lol");
    });

    test("should toggle to lower case", () => {
      expect(normalize("LoreMIpSumdOLor")).toBe("loremipsumdolor");
    });

    test("should clean accents", () => {
      expect(normalize("pâté")).toBe("pate");
    });
  });

  describe("#minimize", () => {
    test("should work with normal base case", () => {
      expect(minimize(["john", "marius", "albert"].map(normalize))).toStrictEqual(["j", "m", "a"]);
    });

    test("should use two letters for similar words", () => {
      expect(minimize(["john", "marius", "maxime"].map(normalize))).toStrictEqual(["j", "mr", "mx"]);
    });

    test("should use more than two letters when necessary", () => {
      expect(minimize(["maxime", "marius", "marcellus"].map(normalize))).toStrictEqual(["mx", "mri", "mrc"]);
    });

    test("should use digits when letters don't differ enough", () => {
      expect(minimize(["creme", "crème", "crémé"].map(normalize))).toStrictEqual(["c1", "c2", "c3"]);
    });

    test("should use additional letters AND digits when needed", () => {
      expect(minimize(["cassis", "creme", "crème"].map(normalize))).toStrictEqual(["ca", "cr1", "cr2"]);
    });
  });
});

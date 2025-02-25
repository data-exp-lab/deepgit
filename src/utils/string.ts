import { forEach, groupBy, range, size } from "lodash";

/**
 * Takes a string and returns a new string with only letters and strings,
 * desaccentuated and lower-cased, and with other characters replaced by _s.
 */
export function slugify(string: string): string {
  return string
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_");
}

/**
 * Takes a string and returns a desaccentuated and lower-cased new string.
 */
export function normalize(string: string): string {
  return string
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Takes an array of strings, and returns an array of those strings as minified
 * as we could, taking the first letter, and adding letters as long as it's
 * necessary (and digits in the end when words are too similar).
 */
function _minimize(strings: string[], __internal_nested__: boolean): string[] {
  const minimized: Record<number, string> = {};
  const indexedByFirstLetter = groupBy(range(strings.length), (index) => strings[index][0] || "");
  const injectLetter = !__internal_nested__ || size(indexedByFirstLetter) > 1;

  // Deal with characters with same first letter:
  forEach(indexedByFirstLetter, (indices, firstLetter) => {
    if (indices.length === 1) {
      minimized[indices[0]] = firstLetter;
    } else if (firstLetter) {
      const superMinimized = _minimize(
        indices.map((i) => strings[i].substring(1)),
        true,
      );
      indices.forEach((indexInStrings, indexInIndices) => {
        minimized[indexInStrings] = (injectLetter ? firstLetter : "") + superMinimized[indexInIndices];
      });
    } else {
      indices.forEach((indexInStrings, i) => {
        minimized[indexInStrings] = i + 1 + "";
      });
    }
  });

  return strings.map((str, i) => minimized[i]);
}
export function minimize(strings: string[]): string[] {
  return _minimize(strings, false);
}

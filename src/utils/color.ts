import chroma from "chroma-js";

/**
 * This helper determines whether a text should be black or white considering its background color.
 */
export function getFontColor(color: string): "black" | "white" {
  return chroma(color).luminance() > 0.5 ? "black" : "white";
}

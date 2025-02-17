import { MAX_LABEL_THRESHOLD, MIN_LABEL_THRESHOLD } from "../lib/consts";

export function stateToInputThreshold(v: number): number {
  if (v === Infinity) return MIN_LABEL_THRESHOLD;
  if (v === 0) return MAX_LABEL_THRESHOLD;
  return 6 / v;
}

export function inputToStateThreshold(v: number): number {
  if (v <= MIN_LABEL_THRESHOLD) return Infinity;
  if (v >= MAX_LABEL_THRESHOLD) return 0;
  return 6 / v;
}

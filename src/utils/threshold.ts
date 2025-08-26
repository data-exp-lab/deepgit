import { MAX_LABEL_THRESHOLD, MIN_LABEL_THRESHOLD } from "../lib/consts";

export function stateToInputThreshold(v: number): number {
  if (v === Infinity) return MIN_LABEL_THRESHOLD;
  if (v === 0) return MAX_LABEL_THRESHOLD;
  return 6 / v;
}

export function inputToStateThreshold(v: number): number {
  if (v <= MIN_LABEL_THRESHOLD) return Infinity;
  if (v >= MAX_LABEL_THRESHOLD) return 0;
  // Create a smooth, continuous mapping from slider value to threshold
  // Map [MIN_LABEL_THRESHOLD, MAX_LABEL_THRESHOLD] to [Infinity, 0.1]
  const normalized = (v - MIN_LABEL_THRESHOLD) / (MAX_LABEL_THRESHOLD - MIN_LABEL_THRESHOLD);
  // Use smoothstep easing for gradual, natural-feeling control
  const eased = normalized * normalized * (3 - 2 * normalized);
  // Map to a reasonable threshold range: Infinity -> 20 -> 10 -> 5 -> 2 -> 0.1
  const threshold = Math.max(0.1, 20 * Math.pow(0.5, eased * 4));
  return threshold;
}

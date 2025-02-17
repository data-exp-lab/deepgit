import { Settings } from "sigma/settings";
import { NodeDisplayData, PartialButFor, PlainObject } from "sigma/types";

import { RETINA_HIDDEN_FIELD_PREFIX } from "../lib/consts";

/**
 * This function draw in the input canvas 2D context a rectangle.
 * It only deals with tracing the path, and does not fill or stroke.
 */
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Custom hover renderer
 */
export function drawHover(context: CanvasRenderingContext2D, data: PlainObject, settings: PlainObject) {
  const size = data.labelSize;
  const font = settings.labelFont;
  const weight = settings.labelWeight;
  const isItalic = data[RETINA_HIDDEN_FIELD_PREFIX + "italic"];
  const subtitleSize = size - 2;

  const label = data.label;
  const subtitles: string[] = data.subtitles || [];
  const color = settings.labelColor.attribute
    ? data[settings.labelColor.attribute] || settings.labelColor.color || "#000"
    : settings.labelColor.color;

  // Then we draw the label background
  context.beginPath();
  context.fillStyle = "#fff";
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 2;
  context.shadowBlur = 8;
  context.shadowColor = "#000";

  context.font = `${weight} ${size}px ${font}`;
  const labelWidth = context.measureText(label).width;
  context.font = `${weight} ${subtitleSize}px ${font}`;
  const subtitleWidth = Math.max(0, ...subtitles.map((s: string) => context.measureText(s).width));

  const textWidth = Math.max(labelWidth, subtitleWidth);

  const x = Math.round(data.x);
  const y = Math.round(data.y);
  const w = Math.round(textWidth + size / 2 + data.size + 3);
  const hLabel = Math.round(size * 0.7);
  const hSubtitle = Math.round(subtitleSize * 1.3);

  drawRoundRect(context, x, y - 0.8 * size, w, hSubtitle * subtitles.length + hLabel + 0.8 * size, 5);
  context.closePath();
  context.fill();

  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 0;

  // And finally we draw the labels
  context.fillStyle = color;
  context.font = `${isItalic ? "italic " : ""}${weight} ${size}px ${font}`;
  context.fillText(label, data.x + data.size + 3, data.y + size / 3);

  subtitles.forEach((s, i) => {
    context.fillStyle = "#666";
    context.font = `${weight} ${subtitleSize}px ${font}`;
    context.fillText(s, data.x + data.size + 3, data.y + size / 3 + hSubtitle * (i + 1));
  });
}

/**
 * Custom label renderer
 */
export default function drawLabel(
  context: CanvasRenderingContext2D,
  data: PartialButFor<NodeDisplayData, "x" | "y" | "size" | "label" | "color">,
  settings: Settings,
): void {
  const label = data.hideLabel ? null : data.label;

  if (!label) return;

  const size = data.labelSize,
    font = settings.labelFont,
    weight = settings.labelWeight,
    isItalic = data[RETINA_HIDDEN_FIELD_PREFIX + "italic"];

  context.font = `${isItalic ? "italic " : ""}${weight} ${size}px ${font}`;
  const width = context.measureText(label).width + 8;

  context.fillStyle = "#ffffff66";
  context.fillRect(data.x + data.size, data.y - (size / 3) * 2, width, size * 1.5);

  context.fillStyle = "#000";
  context.fillText(label, data.x + data.size + 3, data.y + size / 3);
}

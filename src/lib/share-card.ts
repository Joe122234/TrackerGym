import type { RecapData } from "@/domain/insights";
import { formatDeltaWeight, formatVolume, formatWeight } from "@/domain/units";

const WIDTH = 1080;
const HEIGHT = 1350;
const LIME = "#c8ff00";
const INK = "#f4f5ef";
const MUTED = "#929b8c";
const SURFACE = "#0d1110";

const FONT =
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const MONO =
  '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}…`;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    const consumed = lines.join(" ").split(/\s+/).length;
    if (consumed < words.length) {
      lines[lines.length - 1] = fitText(
        context,
        `${lines[lines.length - 1]} …`,
        maxWidth,
      );
    }
  }
  return lines;
}

function drawGrid(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "rgba(200, 255, 0, 0.045)";
  context.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, HEIGHT);
    context.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WIDTH, y);
    context.stroke();
  }
  context.restore();
}

function drawStat(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
) {
  roundRect(context, x, y, width, 132, 22);
  context.fillStyle = "rgba(255, 255, 255, 0.035)";
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.09)";
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = MUTED;
  context.font = `600 17px ${MONO}`;
  context.letterSpacing = "2px";
  context.fillText(label.toUpperCase(), x + 24, y + 38);
  context.letterSpacing = "0px";

  context.fillStyle = INK;
  context.font = `600 36px ${FONT}`;
  context.fillText(fitText(context, value, width - 48), x + 24, y + 98);
}

/**
 * Renders a recap to a local canvas. No screenshot library, no network request.
 * The result is a 1080x1350 PNG suitable for stories or a saved progress card.
 */
export function renderRecapCard(data: RecapData): string {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser.");
  }

  context.fillStyle = "#080a09";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawGrid(context);

  const glow = context.createRadialGradient(940, 110, 10, 940, 110, 560);
  glow.addColorStop(0, "rgba(200, 255, 0, 0.20)");
  glow.addColorStop(0.52, "rgba(200, 255, 0, 0.035)");
  glow.addColorStop(1, "rgba(200, 255, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = SURFACE;
  roundRect(context, 44, 44, WIDTH - 88, HEIGHT - 88, 36);
  context.fill();
  context.strokeStyle = "rgba(200, 255, 0, 0.18)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = LIME;
  roundRect(context, 92, 94, 25, 25, 7);
  context.fill();
  context.fillStyle = INK;
  context.font = `700 42px ${FONT}`;
  context.fillText("FORGE", 132, 126);

  context.fillStyle = MUTED;
  context.font = `600 17px ${MONO}`;
  context.letterSpacing = "3px";
  context.fillText("TRAINING RECAP", 700, 118);
  context.letterSpacing = "0px";

  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(92, 168);
  context.lineTo(WIDTH - 92, 168);
  context.stroke();

  context.fillStyle = LIME;
  context.font = `600 19px ${MONO}`;
  context.letterSpacing = "2.5px";
  context.fillText(data.periodLabel.toUpperCase(), 92, 236);
  context.letterSpacing = "0px";

  context.fillStyle = INK;
  context.font = `600 54px ${FONT}`;
  context.fillText(fitText(context, data.periodSubLabel, WIDTH - 184), 92, 300);

  const headlineLines = wrapText(context, data.headline, WIDTH - 184, 2);
  context.fillStyle = "#b7c0b2";
  context.font = `400 26px ${FONT}`;
  headlineLines.forEach((line, index) => {
    context.fillText(line, 92, 348 + index * 36);
  });

  const statY = 430;
  const statGap = 18;
  const statWidth = (WIDTH - 184 - statGap * 2) / 3;
  drawStat(
    context,
    92,
    statY,
    statWidth,
    data.scope === "session" ? "Sets" : "Sessions",
    data.scope === "session" ? `${data.sets}` : `${data.sessions}`,
  );
  drawStat(
    context,
    92 + statWidth + statGap,
    statY,
    statWidth,
    "Volume",
    formatVolume(data.volumeKg, data.weightUnit),
  );
  drawStat(
    context,
    92 + (statWidth + statGap) * 2,
    statY,
    statWidth,
    "PR lifts",
    `${data.prGroups.length}`,
  );

  context.fillStyle = LIME;
  context.font = `600 17px ${MONO}`;
  context.letterSpacing = "2.5px";
  context.fillText("TOP 8-REP SETS", 92, 636);
  context.letterSpacing = "0px";

  const lifts = data.topLifts.slice(0, 3);
  if (lifts.length === 0) {
    context.fillStyle = MUTED;
    context.font = `400 26px ${FONT}`;
    context.fillText("No completed top sets in this window.", 92, 700);
  } else {
    lifts.forEach((lift, index) => {
      const rowTop = 660 + index * 58;
      const baseline = rowTop + 30;
      context.fillStyle = "rgba(255, 255, 255, 0.045)";
      roundRect(context, 92, rowTop, WIDTH - 184, 50, 12);
      context.fill();

      context.fillStyle = INK;
      context.font = `500 24px ${FONT}`;
      context.fillText(fitText(context, lift.name, 560), 112, baseline);

      context.fillStyle = LIME;
      context.font = `600 24px ${MONO}`;
      const value = `${formatWeight(lift.bestWeightKg, data.weightUnit)} × ${lift.bestReps ?? "—"}`;
      context.fillText(
        value,
        WIDTH - 132 - context.measureText(value).width,
        baseline,
      );

      if (lift.deltaKg !== null && lift.deltaKg !== 0) {
        context.fillStyle = lift.deltaKg > 0 ? LIME : MUTED;
        context.font = `500 15px ${MONO}`;
        const delta = formatDeltaWeight(lift.deltaKg, data.weightUnit);
        context.fillText(delta, 112, rowTop + 44);
      }
    });
  }

  context.fillStyle = LIME;
  context.font = `600 17px ${MONO}`;
  context.letterSpacing = "2.5px";
  context.fillText("NEW MARKS", 92, 890);
  context.letterSpacing = "0px";

  if (data.prGroups.length === 0) {
    context.fillStyle = MUTED;
    context.font = `400 24px ${FONT}`;
    context.fillText("No new marks. The work still counts.", 92, 942);
  } else {
    data.prGroups.slice(0, 3).forEach((group, index) => {
      const baseline = 936 + index * 38;
      context.fillStyle = INK;
      context.font = `500 22px ${FONT}`;
      context.fillText(fitText(context, group.exerciseName, 560), 92, baseline);
      const metric = group.metrics[0];
      if (metric) {
        context.fillStyle = MUTED;
        context.font = `400 18px ${FONT}`;
        context.textAlign = "right";
        context.fillText(
          fitText(
            context,
            `${metric.label} · ${metric.value}${metric.unit}`,
            330,
          ),
          WIDTH - 92,
          baseline,
        );
        context.textAlign = "left";
      }
    });
  }

  const focusTop = 1060;
  context.fillStyle = "rgba(200, 255, 0, 0.075)";
  roundRect(context, 92, focusTop, WIDTH - 184, 146, 20);
  context.fill();
  context.strokeStyle = "rgba(200, 255, 0, 0.24)";
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = LIME;
  context.font = `600 16px ${MONO}`;
  context.letterSpacing = "2.5px";
  context.fillText("NEXT FOCUS", 116, focusTop + 34);
  context.letterSpacing = "0px";

  context.fillStyle = INK;
  context.font = `400 21px ${FONT}`;
  const focusLines = wrapText(context, data.focus, WIDTH - 232, 2);
  focusLines.forEach((line, index) => {
    context.fillText(line, 116, focusTop + 70 + index * 28);
  });

  context.fillStyle = MUTED;
  context.font = `600 15px ${MONO}`;
  context.letterSpacing = "2px";
  context.fillText("FORGED BY CONSISTENCY", 92, HEIGHT - 88);
  context.textAlign = "right";
  context.fillText("FORGE / TRAINING LOG", WIDTH - 92, HEIGHT - 88);
  context.textAlign = "left";
  context.letterSpacing = "0px";

  return canvas.toDataURL("image/png");
}

export function downloadRecapCard(data: RecapData) {
  const url = renderRecapCard(data);
  const link = document.createElement("a");
  const slug = data.periodLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  link.href = url;
  link.download = `forge-recap-${slug || "training"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function shareRecapCard(data: RecapData): Promise<boolean> {
  const url = renderRecapCard(data);
  const link = document.createElement("a");
  const slug = data.periodLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  link.href = url;
  link.download = `forge-recap-${slug || "training"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return Promise.resolve(true);
}

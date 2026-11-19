import { safeZones, lengthLimits, textLimits, speakingRates } from "./lib/data.mjs";

export { safeZones, lengthLimits, textLimits, speakingRates };

const BASE = safeZones.frame;
const isPositive = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

/** The platform ids, plus "all" for the box inside every app's published safe zone at once. */
export const platformIds = [...Object.keys(safeZones.platforms), "all"];

function frameOf(size) {
  if (size === undefined) return { width: BASE.width, height: BASE.height };
  if (!size || !isPositive(size.width) || !isPositive(size.height)) throw new RangeError("size needs a positive finite width and height");
  return { width: size.width, height: size.height };
}

function zoneOf(platform) {
  if (platform === undefined || platform === "all") return { id: "all", name: "all four apps at once", box: safeZones.clearOnEvery.box };
  if (typeof platform !== "string" || !Object.hasOwn(safeZones.platforms, platform)) {
    throw new RangeError(`Unknown platform "${platform}". Use one of: ${platformIds.join(", ")}`);
  }
  const p = safeZones.platforms[platform];
  return { id: platform, name: p.name, box: p.box };
}

/** True when the box has a button column that steps in from railTop down. */
export function hasButtonColumn(box) {
  return box.railTop < box.bottom && box.railLeft < box.right;
}

/** The clear box for one app ("all" by default), scaled to a frame size (1080 x 1920 by default). Not rounded. */
export function safeBox(platform = "all", size) {
  const frame = frameOf(size);
  const { box } = zoneOf(platform);
  const sx = frame.width / BASE.width;
  const sy = frame.height / BASE.height;
  return {
    left: box.left * sx,
    right: box.right * sx,
    top: box.top * sy,
    bottom: box.bottom * sy,
    railTop: box.railTop * sy,
    railLeft: box.railLeft * sx,
  };
}

/** The margins a box leaves on each side of a frame, and its button column if it has one. */
export function marginsOf(box, size) {
  const frame = frameOf(size);
  const m = { top: box.top, bottom: frame.height - box.bottom, left: box.left, right: frame.width - box.right };
  if (hasButtonColumn(box)) m.buttonColumn = { fromY: box.railTop, width: frame.width - box.railLeft };
  return m;
}

/** Whether a rectangle (x, y, width, height in frame pixels) is inside an app's safe zone, and if not, why. */
export function checkRect(rect, platform = "all", size) {
  const { x, y, width, height } = rect ?? {};
  if (![x, y].every((v) => typeof v === "number" && Number.isFinite(v)) || !isPositive(width) || !isPositive(height)) {
    throw new RangeError("rect needs finite x and y and a positive width and height");
  }
  const b = safeBox(platform, size);
  const right = x + width;
  const bottom = y + height;
  const problems = [];
  if (y < b.top) problems.push(`top edge ${y} is above ${round(b.top)}`);
  if (bottom > b.bottom) problems.push(`bottom edge ${bottom} is below ${round(b.bottom)}`);
  if (x < b.left) problems.push(`left edge ${x} is left of ${round(b.left)}`);
  if (right > b.right) problems.push(`right edge ${right} is right of ${round(b.right)}`);
  if (hasButtonColumn(b) && bottom > b.railTop && right > b.railLeft) {
    problems.push(`it reaches the button column (below y ${round(b.railTop)}, right of x ${round(b.railLeft)})`);
  }
  return { clear: problems.length === 0, platform: zoneOf(platform).name, problems };
}

/** The widest box centred on the frame whose lowest edge is at `bottom`, which must lie inside the safe zone's height. */
export function centredSpan(bottom, platform = "all", size) {
  const frame = frameOf(size);
  const b = safeBox(platform, size);
  if (typeof bottom !== "number" || !Number.isFinite(bottom) || bottom <= b.top || bottom > b.bottom) {
    throw new RangeError(`bottom must be below ${round(b.top)} and at most ${round(b.bottom)}`);
  }
  const edge = hasButtonColumn(b) && bottom > b.railTop ? b.railLeft : b.right;
  const inset = Math.max(b.left, frame.width - edge);
  return { left: inset, right: frame.width - inset, width: frame.width - 2 * inset };
}

/** A transparent SVG overlay: covered areas shaded, the clear box outlined, optionally a thirds grid. */
export function overlaySvg(platform = "all", size, options = {}) {
  const frame = frameOf(size);
  const { name } = zoneOf(platform);
  const b = safeBox(platform, size);
  const { width: W, height: H } = frame;
  const n = (v) => round(v, 2);
  const shade = [
    [0, 0, W, b.top],
    [0, b.bottom, W, H - b.bottom],
    [0, b.top, b.left, b.bottom - b.top],
    [b.right, b.top, W - b.right, b.railTop - b.top],
    [b.railLeft, b.railTop, W - b.railLeft, b.bottom - b.railTop],
  ].filter(([, , w, h]) => w > 0 && h > 0);
  const outline = hasButtonColumn(b)
    ? `M${n(b.left)} ${n(b.top)}H${n(b.right)}V${n(b.railTop)}H${n(b.railLeft)}V${n(b.bottom)}H${n(b.left)}Z`
    : `M${n(b.left)} ${n(b.top)}H${n(b.right)}V${n(b.bottom)}H${n(b.left)}Z`;
  const stroke = Math.max(2, Math.round(W / 360));
  const dash = `stroke-dasharray="${stroke * 4} ${stroke * 4}"`;
  const grid = options.grid
    ? [W / 3, (2 * W) / 3].map((gx) => `<line x1="${n(gx)}" y1="0" x2="${n(gx)}" y2="${H}"/>`).join("") +
      [H / 3, (2 * H) / 3].map((gy) => `<line x1="0" y1="${n(gy)}" x2="${W}" y2="${n(gy)}"/>`).join("") +
      `<line x1="${n(W / 2)}" y1="0" x2="${n(W / 2)}" y2="${H}" ${dash}/><line x1="0" y1="${n(H / 2)}" x2="${W}" y2="${n(H / 2)}" ${dash}/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<title>${name} safe zone overlay, ${W} x ${H}</title>` +
    `<g fill="#ff3b30" fill-opacity="0.35">${shade.map(([x, y, w, h]) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/>`).join("")}</g>` +
    (grid ? `<g stroke="#ffffff" stroke-opacity="0.6" stroke-width="${Math.max(1, stroke / 2)}">${grid}</g>` : "") +
    `<path d="${outline}" fill="none" stroke="#00c853" stroke-width="${stroke}"/></svg>`
  );
}

/** How many words fit in a length, at each of the three speaking-rate presets. */
export function wordsFor(seconds) {
  if (!isPositive(seconds)) throw new RangeError("seconds must be a number above 0");
  return speakingRates.rates.map((r) => ({ id: r.id, wpm: r.wpm, words: Math.floor((seconds * r.wpm) / 60) }));
}

/** Rounds for display: one decimal by default. */
export function round(v, places = 1) {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

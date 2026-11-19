// Checks the data agrees with itself and with the library, and that the CLI answers and exits as documented.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import * as lib from "./index.mjs";

const json = (name) => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), "utf8"));
const z = json("safe-zones");

for (const [name, value] of [["safe-zones", lib.safeZones], ["length-limits", lib.lengthLimits], ["text-limits", lib.textLimits], ["speaking-rates", lib.speakingRates]]) {
  assert.deepEqual(value, json(name), `lib/data.mjs is out of date for ${name}: run npm run build`);
}

const dated = (s) => typeof s.publisher === "string" && s.url.startsWith("https://") && /^\d{4}-\d{2}-\d{2}$/.test(s.checked);
for (const p of Object.values(z.platforms)) assert.ok(p.sources.length > 0 && p.sources.every(dated), `${p.name} needs dated sources`);
for (const p of [...lib.lengthLimits.platforms, ...lib.textLimits.platforms]) assert.ok(p.sources.length > 0 && p.sources.every(dated), `${p.id} needs dated sources`);
assert.ok(lib.speakingRates.rates.every((r) => dated(r.source)));
assert.ok(z.wide16x9.sources.length > 0 && z.wide16x9.sources.every(dated));

const { width: W, height: H } = z.frame;
const area = (r) => r.width * r.height;
function rectsOf(b) {
  if (!lib.hasButtonColumn(b)) return [{ x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top }];
  return [
    { x: b.left, y: b.top, width: b.right - b.left, height: b.railTop - b.top },
    { x: b.left, y: b.railTop, width: b.railLeft - b.left, height: b.bottom - b.railTop },
  ];
}
for (const zone of [...Object.values(z.platforms), z.clearOnEvery]) {
  const b = zone.box;
  assert.equal(zone.margins.top, b.top);
  assert.equal(zone.margins.bottom, H - b.bottom);
  assert.equal(zone.margins.left, b.left);
  assert.equal(zone.margins.right, W - b.right);
  if (zone.margins.buttonColumn) {
    assert.deepEqual(zone.margins.buttonColumn, { fromY: b.railTop, toY: b.bottom, width: W - b.railLeft });
  } else assert.ok(!lib.hasButtonColumn(b));
  assert.deepEqual(zone.clearRects, rectsOf(b), `${zone.name}: clearRects disagree with the box`);
}

// The every-app box is the intersection of the four, step included: sample the frame on a grid.
const inside = (b, x, y) => x >= b.left && x < b.right && y >= b.top && y < b.bottom && !(y >= b.railTop && x >= b.railLeft);
const boxes = Object.values(z.platforms).map((p) => p.box);
for (let x = 0; x < W; x += 4) for (let y = 0; y < H; y += 4) assert.equal(inside(z.clearOnEvery.box, x, y), boxes.every((b) => inside(b, x, y)), `intersection differs at ${x},${y}`);
assert.equal(z.clearOnEvery.clearRects.reduce((s, r) => s + area(r), 0), 768 * 552 + 660 * 408);

assert.deepEqual(lib.safeBox("all", { width: 720, height: 1280 }), { left: 80, right: 592, top: 192, bottom: 832, railTop: 560, railLeft: 520 });
assert.equal(lib.checkRect({ x: 140, y: 900, width: 600, height: 200 }).clear, true);
assert.equal(lib.checkRect({ x: 140, y: 900, width: 700, height: 200 }).clear, false);
assert.equal(lib.checkRect({ x: 140, y: 900, width: 700, height: 200 }, "youtube-shorts").clear, true);
assert.equal(lib.checkRect({ x: 640, y: 700, width: 200, height: 140 }).clear, true, "above the column the full width is open");
assert.equal(lib.checkRect({ x: 640, y: 700, width: 200, height: 141 }).clear, false, "one pixel into the column");
assert.equal(lib.checkRect({ x: 48, y: 350, width: 20, height: 20 }, "youtube-shorts", { width: 1081, height: 1920 }).clear, false, "no rounding before the check");
assert.deepEqual(lib.centredSpan(1248), { left: 300, right: 780, width: 480 });
assert.deepEqual(lib.centredSpan(840), { left: 192, right: 888, width: 696 });
assert.deepEqual(lib.centredSpan(841), { left: 300, right: 780, width: 480 });
assert.throws(() => lib.centredSpan(1249), RangeError);
assert.throws(() => lib.centredSpan(288), RangeError);
assert.deepEqual(lib.wordsFor(60).map((r) => r.words), [150, 183, 196]);
assert.equal(lib.checkRect({ x: 942, y: 400, width: 20, height: 20 }, "youtube-shorts", { width: 1170, height: 2080 }).clear, true, "exact scaled edge is inside");
assert.equal(lib.centredSpan(462, "tiktok", { width: 396, height: 704 }).width, 396 - 2 * 110, "exact scaled bottom is allowed");
assert.deepEqual(lib.checkRect({ x: 800, y: 1400, width: 20, height: 30 }).problems, ["bottom edge 1430 is below 1248"], "below the column's end only the bottom fails");
assert.equal(lib.checkRect({ x: 940, y: 1200, width: 50, height: 30 }, "instagram-reels").unmodelled !== null, true);
assert.throws(() => lib.wordsFor(1e306), RangeError);
assert.deepEqual(lib.wordsFor(22).map((r) => r.words), [55, 67, 71]);
assert.throws(() => lib.safeBox("snapchat"), RangeError);
assert.throws(() => lib.safeBox("toString"), RangeError);
assert.throws(() => lib.safeBox("all", { width: "1080", height: 1920 }), RangeError);
assert.throws(() => lib.wordsFor("30"), RangeError);
assert.throws(() => lib.checkRect({ x: 0, y: 0, width: Infinity, height: 1 }), RangeError);

const CLI = fileURLToPath(new URL("./bin/sfspecs.mjs", import.meta.url));
const cli = (args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
};
assert.equal(cli([]).code, 0);
assert.equal(cli(["check", "--rect", "140,900,600,200"]).code, 0);
assert.equal(cli(["check", "--rect", "140,900,700,200"]).code, 1);
for (const bad of [
  ["chek", "--rect", "140,900,600,200"],
  ["check", "--rect", "140,900,-5,200"],
  ["check", "--rect", "140,,600,200"],
  ["check", "--rect"],
  ["check", "--rect", "140,900,600,200", "--platfrom", "tiktok"],
  ["check", "--rect", "140,900,600,200", "extra"],
  ["margins", "--platform", "snapchat"],
  ["margins", "--size"],
  ["margins", "--size", "0x1920"],
  ["words", "--seconds"],
  ["words", "--seconds", "0"],
  ["span", "--bottom", "1249"],
]) assert.equal(cli(bad).code, 2, `expected exit 2 for: ${bad.join(" ")}`);
assert.match(cli(["overlay", "--platform", "tiktok"]).out, /^<svg /);
assert.match(cli(["words", "--seconds", "60"]).out, /150 words/);
assert.match(cli(["span", "--bottom", "1248"]).out, /from x 300 to 780 \(480 px wide\)/);
assert.match(cli(["margins", "--size", "720x1280"]).out, /Instagram Reels: top 179\.3, bottom 448, left 43\.3, right 43\.3\n/);
assert.match(cli(["limits"]).out.split("\nText\n")[1], /content-posting-api-reference-direct-post/);
assert.match(cli(["check", "--platform", "instagram-reels", "--rect", "940,1200,50,30"]).out, /not modelled/);
assert.match(cli(["span", "--bottom", "800", "--platform", "instagram-reels", "--size", "720x1280"]).out, /from x 43\.4 to 676\.6 \(633\.2 px wide\)/);
assert.equal(cli(["check", "--rect", "43.4,700,633.2,100", "--platform", "instagram-reels", "--size", "720x1280"]).code, 0);
assert.match(cli(["margins", "--size", "1920x1080"]).out, /not 9:16/);
assert.equal(cli(["margins", "--size", "100000x177778"]).code, 0);
console.log("ok");

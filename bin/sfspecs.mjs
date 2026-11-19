#!/usr/bin/env node
// sfspecs: safe zones, length and caption limits for vertical short video. No dependencies.
import { safeZones, lengthLimits, textLimits, speakingRates, platformIds, safeBox, marginsOf, checkRect, centredSpan, overlaySvg, wordsFor, round } from "../index.mjs";

const HELP = `sfspecs: specs for vertical short video (TikTok, YouTube Shorts, Instagram Reels, Facebook Reels)

  sfspecs margins [--platform <id|all>] [--size 1080x1920] [--json]
      The margins each app covers, scaled to your frame size.
  sfspecs check --rect x,y,width,height [--platform <id|all>] [--size 1080x1920]
      Is a caption or logo box inside the safe zone? Exit code 0 if it is, 1 if not, 2 for bad input.
  sfspecs span --bottom <y> [--platform <id|all>] [--size 1080x1920]
      The widest centred box whose lowest edge is at y.
  sfspecs overlay [--platform <id|all>] [--size 1080x1920] [--grid] > overlay.svg
      A transparent SVG overlay: covered areas shaded, the clear box outlined.
  sfspecs words --seconds 60
      How many words fit, at three speaking-rate presets.
  sfspecs limits [--json]
      Length and caption limits, with sources.

  Platforms: ${platformIds.join(", ")} (all = inside every app's published safe zone at once)
  Each figure's source and the date it was read are in data/*.json.`;

const VALUE = "value";
const FLAG = "flag";
const COMMANDS = {
  margins: { platform: VALUE, size: VALUE, json: FLAG },
  check: { rect: VALUE, platform: VALUE, size: VALUE },
  span: { bottom: VALUE, platform: VALUE, size: VALUE },
  overlay: { platform: VALUE, size: VALUE, grid: FLAG },
  words: { seconds: VALUE },
  limits: { json: FLAG },
};

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parse(argv) {
  const [command, ...rest] = argv;
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }
  if (!Object.hasOwn(COMMANDS, command)) fail(`Unknown command "${command}".\n\n${HELP}`);
  const spec = COMMANDS[command];
  const opts = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === "--help" || a === "-h") {
      process.stdout.write(`${HELP}\n`);
      process.exit(0);
    }
    if (!a.startsWith("--")) fail(`Unexpected argument "${a}".`);
    const key = a.slice(2);
    if (!Object.hasOwn(spec, key)) fail(`${command} does not take --${key}.`);
    if (Object.hasOwn(opts, key)) fail(`--${key} is given twice.`);
    if (spec[key] === FLAG) {
      opts[key] = true;
      continue;
    }
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--") || next === "") fail(`--${key} needs a value.`);
    opts[key] = next;
    i += 1;
  }
  return { command, opts };
}

function attempt(fn) {
  try {
    return fn();
  } catch (e) {
    if (e instanceof RangeError) fail(e.message);
    throw e;
  }
}

function sizeOf(raw) {
  if (raw === undefined) return { width: safeZones.frame.width, height: safeZones.frame.height };
  const m = /^(\d+)x(\d+)$/.exec(raw);
  const size = m && { width: Number(m[1]), height: Number(m[2]) };
  if (!size || ![size.width, size.height].every((v) => Number.isSafeInteger(v) && v > 0)) fail(`--size must look like 1080x1920, got ${raw}`);
  return size;
}

function numberOf(raw, name) {
  if (!/^-?\d+(\.\d+)?$/.test(raw)) fail(`${name} must be a number, got "${raw}"`);
  return Number(raw);
}

const platformOf = (raw) => raw ?? "all";

// A frame that is not exactly 9:16 gets the presets stretched to it; say so where the answer is read.
function noteStretch(frame, toStderr = false) {
  if (frame.width * 16 === frame.height * 9) return;
  const note = `Note: ${frame.width} x ${frame.height} is not 9:16, so these are the 9:16 presets stretched to it.\n`;
  (toStderr ? process.stderr : process.stdout).write(note);
}
const nameOf = (id) => (id === "all" ? "all four apps at once" : safeZones.platforms[id].name);

function cmdMargins(o) {
  const frame = sizeOf(o.size);
  const ids = o.platform === undefined ? platformIds : [o.platform];
  const rows = ids.map((id) => {
    const box = attempt(() => safeBox(id, frame));
    return { id, name: nameOf(id), box, margins: marginsOf(box, frame) };
  });
  if (o.json) return void process.stdout.write(`${JSON.stringify({ frame, ninebysixteen: frame.width * 16 === frame.height * 9, zones: rows }, null, 2)}\n`);
  noteStretch(frame);
  process.stdout.write(`Margins on ${frame.width} x ${frame.height} (px)\n`);
  for (const r of rows) {
    const m = r.margins;
    const col = m.buttonColumn ? `; from y ${round(m.buttonColumn.fromY)} down, a column ${round(m.buttonColumn.width)} px from the right edge` : "";
    process.stdout.write(`  ${r.name}: top ${round(m.top)}, bottom ${round(m.bottom)}, left ${round(m.left)}, right ${round(m.right)}${col}\n`);
  }
}

function cmdCheck(o) {
  const frame = sizeOf(o.size);
  if (o.rect === undefined) fail("check needs --rect x,y,width,height");
  const parts = o.rect.split(",");
  if (parts.length !== 4) fail("--rect must be four numbers: x,y,width,height");
  const [x, y, width, height] = parts.map((p) => numberOf(p.trim(), "--rect"));
  const result = attempt(() => checkRect({ x, y, width, height }, platformOf(o.platform), frame));
  noteStretch(frame);
  if (!result.clear) {
    process.stdout.write(`Not inside the published 9:16 ad safe zone for ${result.platform}: ${result.problems.join("; ")}.\n`);
    process.exit(1);
  }
  process.stdout.write(`Inside the published 9:16 ad safe zone for ${result.platform}${result.unmodelled ? ` (${result.unmodelled})` : ""}.\n`);
}

function cmdSpan(o) {
  const frame = sizeOf(o.size);
  if (o.bottom === undefined) fail("span needs --bottom <y>");
  const bottom = numberOf(o.bottom, "--bottom");
  const id = platformOf(o.platform);
  const s = attempt(() => centredSpan(bottom, id, frame));
  noteStretch(frame);
  const left = Math.ceil(s.left * 10) / 10;
  const right = Math.floor(s.right * 10) / 10;
  process.stdout.write(`On ${nameOf(id)}, a centred box ending at y ${bottom} can run from x ${left} to ${right} (${round(right - left)} px wide).\n`);
}

function cmdOverlay(o) {
  const frame = sizeOf(o.size);
  noteStretch(frame, true);
  process.stdout.write(`${attempt(() => overlaySvg(platformOf(o.platform), frame, { grid: Boolean(o.grid) }))}\n`);
}

function cmdWords(o) {
  if (o.seconds === undefined) fail("words needs --seconds");
  const seconds = numberOf(o.seconds, "--seconds");
  if (!(seconds > 0 && seconds <= 3600)) fail("--seconds must be greater than 0 and at most 3600");
  process.stdout.write(`Words that fit in ${seconds} s:\n`);
  for (const r of wordsFor(seconds)) {
    const what = speakingRates.rates.find((x) => x.id === r.id).what;
    process.stdout.write(`  ${r.id.padEnd(6)} ${String(r.words).padStart(5)} words  (${r.wpm} wpm: ${what})\n`);
  }
  const hook = wordsFor(speakingRates.hookSeconds).map((r) => r.words);
  process.stdout.write(`A ${speakingRates.hookSeconds} s opening line holds ${Math.min(...hook)} to ${Math.max(...hook)} words.\n`);
}

function cmdLimits(o) {
  if (o.json) return void process.stdout.write(`${JSON.stringify({ length: lengthLimits, text: textLimits }, null, 2)}\n`);
  process.stdout.write("Length\n");
  for (const p of lengthLimits.platforms) {
    process.stdout.write(`  ${p.name}: ${p.rule}.\n`);
    for (const s of p.sources) process.stdout.write(`    ${s.url}\n`);
  }
  process.stdout.write("Text\n");
  for (const p of textLimits.platforms) {
    const parts = [];
    if (p.titleMax) parts.push(`Title up to ${p.titleMax.toLocaleString("en-US")} characters`);
    if (p.descriptionMax) parts.push(`Description up to ${p.descriptionMax.toLocaleString("en-US")}`);
    if (p.captionMax) parts.push(`Caption up to ${p.captionMax.toLocaleString("en-US")} ${p.counting ?? "characters"}`);
    if (p.hashtags) parts.push(p.hashtags.over);
    if (p.note) parts.push(p.note);
    process.stdout.write(`  ${p.name}: ${parts.join(". ")}.\n`);
    for (const s of p.sources) process.stdout.write(`    ${s.url}\n`);
  }
}

const { command, opts } = parse(process.argv.slice(2));
({ margins: cmdMargins, check: cmdCheck, span: cmdSpan, overlay: cmdOverlay, words: cmdWords, limits: cmdLimits })[command](opts);

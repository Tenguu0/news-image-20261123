// The World in One Page — Monday 23 November 2026.
// A make.fun news-image-20261123 entry: draws the day's world news as one
// newspaper front page. Node 22+, standard library only. No network, no
// randomness, no clock: every run writes the same bytes.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;

const PAPER = 0xfbf7ee;
const INK = 0x161513;
const NAVY = 0x10243e;
const RED = 0xb42318;
const GOLD = 0xc9a227;
const SKY = 0xdce7f2;
const SEA = 0x7fb3d5;
const DEEPSEA = 0x2e5f7a;
const GREY = 0x6b665e;
const GREEN = 0x2e7d32;
const ORANGE = 0xe07830;
const YELLOW = 0xf2c230;
const WHITE = 0xffffff;
const CREAM = 0xf5eeda;
const DARKGREY = 0x3a3733;

const px = new Uint8Array(W * H * 3);

function fillAll(c: number): void {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = r;
    px[i * 3 + 1] = g;
    px[i * 3 + 2] = b;
  }
}

function set(x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = (c >> 16) & 255;
  px[i + 1] = (c >> 8) & 255;
  px[i + 2] = c & 255;
}

function rect(x: number, y: number, w: number, h: number, c: number): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) set(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: number): void {
  rect(x, y, w, 1, c);
}

function frame(x: number, y: number, w: number, h: number, c: number, t: number): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: number): void {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(ax, ay, c);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
}

function circle(cx: number, cy: number, r: number, c: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let xx = cx - dx; xx <= cx + dx; xx++) set(xx, cy + dy, c);
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    const inner = Math.sqrt(Math.max(0, (r - t) * (r - t) - dy * dy));
    for (let xx = cx - dx; xx <= cx + dx; xx++) {
      if (Math.abs(xx - cx) >= inner) set(xx, cy + dy, c);
    }
  }
}

// Filled triangle via edge-walk scanlines.
function triangle(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number,
): void {
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      for (let x = Math.max(0, Math.floor(lo)); x <= Math.min(W - 1, Math.ceil(hi)); x++) {
        set(x, y, c);
      }
    }
  }
}

// Filled polygon (even-odd scanlines).
function poly(pts: Array<[number, number]>, c: number): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.floor(xs[k])); x <= Math.min(W - 1, Math.ceil(xs[k + 1])); x++) {
        set(x, y, c);
      }
    }
  }
}

// Spiky starburst (explosion / sun).
function burst(cx: number, cy: number, r1: number, r2: number, spikes: number, c: number): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    pts.push([cx + Math.round(r * Math.cos(a)), cy + Math.round(r * Math.sin(a))]);
  }
  poly(pts, c);
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells. '#' = ink. Uppercase + digits + punctuation.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  "\u2014": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
};

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(x: number, y: number, scale: number, c: number, s: string): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(cx: number, y: number, scale: number, c: number, s: string): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, scale, c, s);
}

function drawTextRight(x1: number, y: number, scale: number, c: number, s: string): void {
  drawText(x1 - textWidth(s, scale), y, scale, c, s);
}

// Greedy word wrap to maxWidth pixels.
function wrap(s: string, scale: number, maxWidth: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawLines(x: number, y: number, scale: number, leading: number, c: number, lines: string[]): void {
  let yy = y;
  for (const ln of lines) {
    drawText(x, yy, scale, c, ln);
    yy += 7 * scale + leading;
  }
}

// ---------------------------------------------------------------- pictures
// Cracked globe with a NO DEAL stamp (lead: COP31).
function drawGlobe(cx: number, cy: number, r: number): void {
  circle(cx, cy, r + 4, INK);
  circle(cx, cy, r, SKY);
  // Continents as flat blobs.
  circle(cx - 34, cy - 28, 26, GREEN);
  circle(cx + 30, cy - 34, 20, GREEN);
  circle(cx + 42, cy + 26, 24, GREEN);
  circle(cx - 40, cy + 34, 18, GREEN);
  circle(cx - 8, cy + 6, 16, GREEN);
  // Crack: jagged red line across the globe.
  line(cx - 78, cy - 62, cx - 40, cy - 20, RED);
  line(cx - 40, cy - 20, cx - 58, cy + 18, RED);
  line(cx - 58, cy + 18, cx - 10, cy + 44, RED);
  line(cx - 10, cy + 44, cx + 22, cy + 66, RED);
  line(cx + 22, cy + 66, cx + 60, cy + 82, RED);
  line(cx - 76, cy - 60, cx - 38, cy - 18, RED);
  line(cx - 38, cy - 18, cx - 56, cy + 20, RED);
  line(cx - 56, cy + 20, cx - 8, cy + 46, RED);
  line(cx - 8, cy + 46, cx + 24, cy + 68, RED);
  // NO DEAL stamp across the lower globe.
  const sx = cx - 118;
  const sy = cy + 34;
  frame(sx, sy, 236, 46, RED, 4);
  drawTextCentered(cx, sy + 12, 3, RED, "NO DEAL");
}

// Tanker on fire in a strait (Hormuz). Box: (x, y, w, h).
function drawTanker(x: number, y: number, w: number, h: number): void {
  const seaY = y + Math.floor(h * 0.62);
  rect(x, seaY, w, h - (seaY - y), SEA);
  // Waves.
  for (let i = 0; i < 5; i++) {
    const wx = x + 12 + i * Math.floor((w - 24) / 5);
    line(wx, seaY + 12, wx + 22, seaY + 12, WHITE);
    line(wx + 8, seaY + 26, wx + 30, seaY + 26, WHITE);
  }
  // Hull.
  const hullY = seaY - 26;
  poly(
    [
      [x + 30, hullY],
      [x + w - 70, hullY],
      [x + w - 30, hullY + 22],
      [x + 52, hullY + 22],
    ],
    DARKGREY,
  );
  rect(x + 52, hullY + 22, w - 82, 6, RED);
  // Superstructure + funnel.
  rect(x + w - 150, hullY - 26, 62, 26, WHITE);
  rect(x + w - 150, hullY - 26, 62, 5, RED);
  rect(x + w - 96, hullY - 40, 16, 14, INK);
  // Explosion above the bow.
  burst(x + w - 96, y + 26, 26, 12, 8, ORANGE);
  burst(x + w - 96, y + 26, 15, 7, 8, YELLOW);
  // Smoke.
  circle(x + w - 130, y + 18, 10, GREY);
  circle(x + w - 150, y + 8, 8, GREY);
  // Naval mine in the water.
  const mx = x + 78;
  const my = seaY + 22;
  circle(mx, my, 9, INK);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(mx, my, mx + Math.round(14 * Math.cos(a)), my + Math.round(14 * Math.sin(a)), INK);
  }
}

// Capsized corvette, bow only above water (Libya). Box: (x, y, w, h).
function drawWarship(x: number, y: number, w: number, h: number): void {
  const seaY = y + Math.floor(h * 0.58);
  rect(x, seaY, w, h - (seaY - y), DEEPSEA);
  for (let i = 0; i < 5; i++) {
    const wx = x + 10 + i * Math.floor((w - 20) / 5);
    line(wx, seaY + 14, wx + 24, seaY + 14, WHITE);
  }
  // Capsized hull: pale slab tilted down to the right, bow poking up left.
  poly(
    [
      [x + 30, seaY - 6],
      [x + 150, seaY - 34],
      [x + 330, seaY - 2],
      [x + 340, seaY + 8],
      [x + 60, seaY + 8],
    ],
    WHITE,
  );
  // Red waterline stripe along the hull top edge.
  line(x + 40, seaY - 8, x + 160, seaY - 34, RED);
  line(x + 160, seaY - 34, x + 325, seaY - 4, RED);
  // Bow tip above the waterline, left (ink outline, white fill).
  poly(
    [
      [x + 26, seaY - 2],
      [x + 66, seaY - 50],
      [x + 100, seaY - 4],
    ],
    INK,
  );
  poly(
    [
      [x + 32, seaY - 6],
      [x + 66, seaY - 42],
      [x + 92, seaY - 8],
    ],
    WHITE,
  );
  // Mast sticking out of the water.
  line(x + 210, seaY - 18, x + 226, seaY - 52, INK);
  circle(x + 226, seaY - 54, 4, RED);
  // Smoke column.
  circle(x + 300, y + 22, 12, GREY);
  circle(x + 322, y + 10, 9, GREY);
  circle(x + 282, y + 8, 8, GREY);
  // Small fire on the hull.
  burst(x + 180, seaY - 30, 14, 6, 7, ORANGE);
}

// Broken apartment block with rubble (Ukraine). Box: (x, y, w, h), h ~ 46.
function drawRubble(x: number, y: number, w: number, h: number): void {
  const groundY = y + h - 4;
  rect(x, groundY, w, 4, GREY);
  // Standing half of the block.
  rect(x + 10, y + 8, 84, groundY - y - 8, DARKGREY);
  for (let f = 0; f < 2; f++) {
    for (let c = 0; c < 3; c++) {
      rect(x + 20 + c * 26, y + 14 + f * 13, 14, 8, YELLOW);
    }
  }
  // Sheared-off half: jagged top edge, lighter than the standing block.
  poly(
    [
      [x + 104, y + 22],
      [x + 132, y + 10],
      [x + 158, y + 22],
      [x + 186, y + 12],
      [x + 214, y + 26],
      [x + 214, groundY],
      [x + 104, groundY],
    ],
    0x8f8a82,
  );
  rect(x + 150, y + 26, 12, 8, DARKGREY);
  rect(x + 182, y + 18, 12, 8, DARKGREY);
  // Rubble pile.
  triangle(x + 140, groundY, x + 190, groundY - 16, x + 236, groundY, DARKGREY);
  triangle(x + 190, groundY, x + 226, groundY - 10, x + 258, groundY, GREY);
  // Dust cloud.
  circle(x + 232, y + 16, 7, WHITE);
  circle(x + 248, y + 9, 5, WHITE);
  // Rescuer figure: small, with a ladder line.
  line(x + 116, groundY, x + 116, groundY - 14, RED);
  circle(x + 116, groundY - 18, 4, RED);
}

// Capitol dome with a big 258 (Democrats). Box: (x, y, w, h), h ~ 46.
function drawCapitol(x: number, y: number, w: number, h: number): void {
  const baseY = y + h - 2;
  const dcx = x + Math.floor(w / 2);
  drawTextCentered(dcx, y + 1, 2, RED, "258");
  // Dome (bigger, so it reads at a glance).
  const dcy = baseY - 8;
  for (let dy = 0; dy <= 17; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, 17 * 17 - dy * dy)) * 1.6);
    hline(dcx - dx, dcy - dy, dx * 2, NAVY);
  }
  // Base + columns.
  rect(x + 40, baseY - 10, w - 80, 10, NAVY);
  for (let i = 0; i < 5; i++) {
    rect(x + 54 + i * Math.floor((w - 108) / 4), baseY - 18, 6, 9, WHITE);
  }
  rect(x + 40, baseY - 19, w - 80, 2, WHITE);
}

// Wanted poster (Chapo Isidro). Box: (x, y, w, h), h ~ 46.
function drawPoster(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, CREAM);
  frame(x, y, w, h, INK, 2);
  drawTextCentered(x + Math.floor(w / 2), y + 3, 2, INK, "WANTED");
  // Star badge.
  burst(x + Math.floor(w / 2), y + Math.floor(h / 2) + 3, 9, 4, 5, GOLD);
  drawTextCentered(x + Math.floor(w / 2), y + h - 15, 2, RED, "$5M");
}

// ---------------------------------------------------------------- layout
const M = 30; // margin

function drawStripLine(y: number, label: string, rest: string): void {
  drawText(M, y, 2, RED, label);
  drawText(M + textWidth(label, 2), y, 2, INK, rest);
}

function drawPage(): void {
  fillAll(PAPER);
  frame(16, 16, W - 32, H - 32, INK, 2);

  // Masthead.
  rect(M, M, W - 2 * M, 116, NAVY);
  drawTextCentered(W / 2, 42, 7, WHITE, "THE GLOBAL HERALD");
  rect(60, 100, W - 120, 3, GOLD);
  drawTextCentered(W / 2, 112, 2, WHITE, "MONDAY, 23 NOVEMBER 2026");

  // Lead: COP31 collapse. Picture left, text right.
  drawGlobe(197, 285, 95);
  drawText(360, 164, 2, RED, "COP31 \u2022 ANTALYA, TURKIYE");
  drawText(360, 186, 6, INK, "CLIMATE TALKS");
  drawText(360, 234, 6, INK, "COLLAPSE");
  const leadDeck = wrap(
    "AFTER TWO WEEKS, THE LONGEST CLIMATE SUMMIT EVER ENDS WITH NO DEAL AS THE FOSSIL-FUEL ROW SPLITS 194 NATIONS.",
    2,
    634,
  );
  drawLines(360, 292, 2, 6, INK, leadDeck);
  drawText(360, 362, 2, RED, '"WORST EVER COP" \u2014 POWER SHIFT AFRICA');
  drawText(360, 386, 2, INK, "EU: NO PACT THAT DOES NOT MENTION FOSSIL FUELS.");

  rect(M, 418, W - 2 * M, 2, INK);

  // Row 2: Hormuz + Libya. Picture first, then kicker + headline + deck.
  const r2y = 436;
  const colW2 = 467;
  rect(512, r2y, 1, 244, GREY);
  // Hormuz.
  drawTanker(M, r2y, colW2, 90);
  drawText(M, 534, 2, RED, "STRAIT OF HORMUZ");
  drawText(M, 556, 4, INK, "THREE TANKERS HIT");
  drawText(M, 588, 4, INK, "IN TWO DAYS");
  drawLines(
    M,
    622,
    2,
    6,
    INK,
    wrap("PROJECTILES HIT THREE TANKERS IN TWO DAYS; TWO MORE CAUGHT FIRE SUNDAY, IRAN SAYS.", 2, colW2),
  );
  // Libya.
  const bX = 527;
  drawWarship(bX, r2y, colW2, 90);
  drawText(bX, 534, 2, RED, "BENGHAZI, LIBYA");
  drawText(bX, 556, 4, INK, "RUSSIAN WARSHIP");
  drawText(bX, 588, 4, INK, "SUNK OFF LIBYA");
  drawLines(
    bX,
    622,
    2,
    6,
    INK,
    wrap("SUSPECTED UKRAINIAN SEA DRONES HIT THE MERKURY; SHE CAPSIZED, BOW ONLY ABOVE WATER.", 2, colW2),
  );

  rect(M, 694, W - 2 * M, 2, INK);

  // Row 3: Ukraine, Democrats, Chapo.
  const r3y = 710;
  const colW3 = 308;
  const c3x = [M, 358, 686];
  rect(343, r3y, 1, 178, GREY);
  rect(671, r3y, 1, 178, GREY);
  // Ukraine.
  drawText(c3x[0], r3y, 2, RED, "UKRAINE");
  drawText(c3x[0], 732, 3, INK, "BOY, 7, PULLED");
  drawText(c3x[0], 755, 3, INK, "ALIVE FROM");
  drawText(c3x[0], 778, 3, INK, "RUBBLE");
  drawRubble(c3x[0], 802, colW3, 46);
  drawLines(c3x[0], 854, 2, 6, INK, ["DRONE HITS FLATS IN DYMER;", "2 KILLED, HUNT FOR MISSING."]);
  // Democrats.
  drawText(c3x[1], r3y, 2, RED, "USA \u2022 MIDTERMS");
  drawText(c3x[1], 732, 3, INK, "DEMOCRATS WIN");
  drawText(c3x[1], 755, 3, INK, "258 SEATS");
  drawCapitol(c3x[1], 802, colW3, 46);
  drawLines(c3x[1], 854, 2, 6, INK, ["BIGGEST HOUSE MAJORITY", "SINCE 1992."]);
  // Chapo Isidro.
  drawText(c3x[2], r3y, 2, RED, "MEXICO");
  drawText(c3x[2], 732, 3, INK, "EL CHAPO ISIDRO");
  drawText(c3x[2], 755, 3, INK, "CAUGHT");
  drawPoster(c3x[2], 802, colW3, 46);
  drawLines(c3x[2], 854, 2, 6, INK, ["$5M FBI BOUNTY; 11 DEAD", "IN THE RAID."]);

  rect(M, 900, W - 2 * M, 2, INK);

  // MEANWHILE strip.
  drawText(M, 912, 2, RED, "MEANWHILE");
  drawText(M + textWidth("MEANWHILE", 2), 912, 2, INK, " \u2014 SOURCES: BBC, REUTERS, AP, CNN, AFP");
  drawStripLine(932, "SPACE:", " BEPICOLOMBO REACHES MERCURY ORBIT \u2014 2ND EVER");
  drawStripLine(949, "HEALTH:", " NHS LAUNCHES WORLD'S LARGEST AI BREAST TRIAL \u2014 700,000 WOMEN");
  drawStripLine(966, "INDONESIA:", " 3 KILLED, 36 MISSING IN CANDY FACTORY FIRE");
  drawStripLine(983, "SPORT:", " LIVERPOOL 4-0 MAN UTD \u2014 POCHETTINO DEBUT NIGHTMARE");
}

// ---------------------------------------------------------------- main
function main(): void {
  drawPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? ".";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePNG());
}

main();

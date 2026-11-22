// The picture that tastes of one ingredient — make.fun bounty entry.
// One big, glossy, ripe strawberry, close-up hero shot, rendered fully
// procedurally in code: signed-distance-style silhouette, radial gradients,
// specular gloss, water droplets, seed dimples, green calyx leaves.
// Deterministic: fixed seed, no Date, no Math.random, no network.
// Node built-ins only (fs, zlib). Writes /output/entry.png (1024x1024 RGB PNG).

const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const W = 1024;
const H = 1024;

// ---- deterministic PRNG (mulberry32, fixed seed) ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261122);

// ---- small helpers ----
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function mix3(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ---- CRC32 (PNG) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- strawberry geometry ----
// Berry centre and scale in pixel space. The berry fills most of the frame.
const CX = 512;          // berry centre x
const TOP = 150;         // top of the berry body (shoulders)
const BOT = 950;         // tip of the berry
const HALF_W = 330;      // max half-width of the body

// Half-width of the body at height fraction y (0 = top, 1 = tip).
// Wide rounded shoulders tapering to a soft point.
function bodyHalfWidth(y) {
  if (y <= 0 || y >= 1) return 0;
  const w = Math.pow(1 - Math.pow(y, 2.1), 0.62);
  // Slightly flatten the shoulders so the top reads broad, not domed.
  // Round the top corners off so the top edge is not a flat cut.
  const topRound = 0.55 + 0.45 * smoothstep(0, 0.25, y);
  return HALF_W * w * (0.94 + 0.06 * Math.cos(y * Math.PI * 0.5)) * topRound;
}
// Signed-ish distance to the body outline (negative inside), in pixels.
// y is the height fraction, x is the horizontal offset from CX.
function bodySdf(x, y) {
  const w = bodyHalfWidth(y);
  return Math.abs(x) - w;
}

// ---- seeds (achenes): deterministic jittered rows following the body ----
const SEEDS = [];
{
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const yf = 0.12 + (r / (rows - 1)) * 0.80; // height fraction
    const w = bodyHalfWidth(yf);
    const spacing = 78; // px between seeds along a row
    const n = Math.max(1, Math.floor((w * 2) / spacing));
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const jx = (rand() - 0.5) * 22;
      const jy = (rand() - 0.5) * 14;
      const sx = CX + u * (w - 40) + jx + (r % 2 === 0 ? -18 : 18);
      const sy = TOP + yf * (BOT - TOP) + jy;
      const s = 6 + rand() * 2.5; // seed radius px
      SEEDS.push({ x: sx, y: sy, r: s, tilt: (rand() - 0.5) * 0.5 });
    }
  }
}

// ---- water droplets: deterministic, on the lit upper-left area ----
const DROPS = [];
{
  const spots = [
    [0.36, 0.24, 15], [0.44, 0.33, 11], [0.30, 0.42, 9], [0.55, 0.28, 12],
    [0.62, 0.45, 10], [0.40, 0.55, 13], [0.52, 0.62, 9], [0.33, 0.66, 8],
    [0.60, 0.70, 7], [0.47, 0.76, 8], [0.28, 0.55, 6], [0.66, 0.58, 6],
  ];
  for (const [u, v, r] of spots) {
    const yf = 0.08 + v * 0.85;
    const w = bodyHalfWidth(yf);
    DROPS.push({ x: CX + (u - 0.5) * 2 * (w - 30), y: TOP + yf * (BOT - TOP), r: r * 0.7 });
  }
}

// ---- calyx leaves: 6 pointed leaves fanning from the top centre ----
const LEAVES = [];
{
  const angles = [-78, -48, -20, 8, 38, 68]; // degrees from vertical
  const lens = [150, 185, 205, 195, 175, 140];
  for (let i = 0; i < angles.length; i++) {
    LEAVES.push({ ang: (angles[i] * Math.PI) / 180, len: lens[i], w: 34 + rand() * 10 });
  }
}
// Point-in-leaf test: leaf is a pointed ellipse (lens) from origin O along
// direction (sin a, -cos a). Returns 0..1 inside (1 = centre rib), else 0.
function leafMask(px, py, leaf) {
  const ox = CX, oy = TOP + 18;
  const dx = px - ox, dy = py - oy;
  const ca = Math.cos(leaf.ang), sa = Math.sin(leaf.ang);
  // rotate into leaf frame: along = up the leaf, across = sideways
  const along = dx * sa - dy * ca; // distance up the leaf (leaf points up)
  const across = dx * ca + dy * sa;
  if (along < -6 || along > leaf.len) return 0;
  const t = along / leaf.len; // 0 base -> 1 tip
  const halfW = leaf.w * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.25 * t) + 2;
  const a = Math.abs(across) / halfW;
  if (a >= 1) return 0;
  return smoothstep(1, 0.55, a);
}

// ---- render ----
function render() {
  const buf = Buffer.alloc(W * H * 3);

  // Palette
  const BG_TOP = [16, 20, 18];
  const BG_BOT = [8, 9, 10];
  const GLOW = [52, 46, 30];      // warm halo behind the berry
  const RED_LIT = [232, 32, 40];   // bright scarlet, lit side
  const RED_MID = [176, 16, 30];   // ripe red
  const RED_DEEP = [104, 8, 20];   // deep crimson shadow
  const RED_DARK = [62, 4, 14];    // darkest crevice red
  const SEED_COL = [246, 205, 118];
  const SEED_SHADOW = [96, 18, 20];
  const LEAF_LIT = [74, 138, 52];
  const LEAF_MID = [44, 96, 34];
  const LEAF_DARK = [22, 56, 20];

  // Light direction (from upper-left), normalised.
  const LX = -0.55, LY = -0.62, LZ = 0.56;

  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const idx = (y * W + x) * 3;

      // --- background: dark vertical gradient + warm spotlight halo ---
      let col = mix3(BG_TOP, BG_BOT, ny);
      const dxc = (x - CX) / 520, dyc = (y - 480) / 520;
      const dg = Math.sqrt(dxc * dxc + dyc * dyc);
      const halo = Math.exp(-dg * dg * 2.2);
      col = mix3(col, GLOW, halo * 0.55);

      // --- soft ground shadow under the berry ---
      const shx = (x - CX) / 330, shy = (y - 968) / 42;
      const sh = Math.exp(-(shx * shx + shy * shy));
      col = mix3(col, [2, 2, 3], sh * 0.85);

      // --- berry body ---
      const yf = (y - TOP) / (BOT - TOP);
      let inBody = false, edge = 0;
      if (yf > 0 && yf < 1) {
        const d = bodySdf(x - CX, yf);
        if (d < 1.5) { inBody = true; edge = smoothstep(1.5, -1.5, d); }
      }

      if (inBody) {
        // Smooth dome normal: the surface normal's x-component varies
        // smoothly across the berry's width (u = -1 left rim .. +1 right
        // rim). The raw SDF gradient |x|-w has a sign flip at the centre
        // that prints as a vertical seam, so it is not used here.
        const u = clamp((x - CX) / Math.max(1, bodyHalfWidth(yf)), -1, 1);
        let nx2 = u;
        let ny2 = 0.18;
        let nz = Math.sqrt(Math.max(0.08, 1 - u * u - ny2 * ny2));
        const nlen = Math.hypot(nx2, ny2, nz) || 1;
        nx2 /= nlen; ny2 /= nlen; nz /= nlen;
        // Rim factor for curvature darkening toward the edges.
        const rim = Math.abs(u);

        const diff = Math.max(0, nx2 * LX + ny2 * LY + nz * LZ);
        // Blinn specular for wet gloss.
        const hx = LX, hy = LY, hz = LZ + 1;
        const hlen = Math.hypot(hx, hy, hz);
        const spec = Math.pow(Math.max(0, (nx2 * hx + ny2 * hy + nz * hz) / hlen), 90);

        // Base red: scarlet where lit (upper-left), deep crimson in shadow.
        let t = clamp(0.55 - 0.70 * nx2 - 0.45 * ny2 + 0.30 * (1 - yf), 0, 1);
        let red = mix3(RED_DEEP, RED_LIT, t);
        red = mix3(red, RED_MID, clamp(diff * 0.7, 0, 1) * 0.6);
        // Darken toward the rim (curvature) and the tip.
        red = mix3(red, RED_DARK, rim * rim * 0.65);
        red = mix3(red, RED_DARK, smoothstep(0.86, 1.0, yf) * 0.45);
        // Warm glow near the top where light catches the shoulders.
        red = mix3(red, [255, 90, 70], Math.exp(-((x - 400) * (x - 400) + (y - 300) * (y - 300)) / (2 * 150 * 150)) * 0.35);

        col = red;

        // Broad soft specular sheen (wet skin) upper-left.
        const sheen = Math.exp(-((x - 380) * (x - 380) / (2 * 190 * 190) +
                                  (y - 330) * (y - 330) / (2 * 260 * 260)));
        col = mix3(col, [255, 200, 190], sheen * 0.5);
        // Tight glossy highlight.
        col = mix3(col, [255, 245, 240], spec * 0.85);

        // --- seed dimples ---
        for (const s of SEEDS) {
          const dxs = x - s.x, dys = (y - s.y) * 1.25;
          const ds = Math.sqrt(dxs * dxs + dys * dys);
          if (ds < s.r + 5) {
            // Dimple: darker ring just outside the seed.
            if (ds > s.r) {
              const dim = smoothstep(s.r + 5, s.r + 1, ds);
              col = mix3(col, SEED_SHADOW, dim * 0.7);
            } else {
              // Seed body: pale gold, lit from upper-left.
              const lt = clamp(0.65 - (dxs / s.r) * 0.4 - (dys / s.r) * 0.3, 0, 1);
              let sc = mix3([186, 138, 66], SEED_COL, lt);
              // tiny highlight dot on the seed
              const hd = Math.hypot(dxs + s.r * 0.3, dys + s.r * 0.35);
              sc = mix3(sc, [255, 244, 210], smoothstep(s.r * 0.45, 0, hd) * 0.8);
              col = sc;
            }
          }
        }

        // --- water droplets: bright rim + white glint ---
        for (const d of DROPS) {
          const dxd = x - d.x, dyd = y - d.y;
          const dd = Math.sqrt(dxd * dxd + dyd * dyd);
          if (dd < d.r) {
            const inner = smoothstep(d.r, d.r * 0.55, dd);
            let dc = mix3(col, [255, 170, 160], 0.12 + inner * 0.22);
            // glint at upper-left of the droplet
            const gd = Math.hypot(dxd + d.r * 0.35, dyd + d.r * 0.4);
            dc = mix3(dc, [255, 255, 255], smoothstep(d.r * 0.35, 0, gd) * 0.95);
            // dark lower rim (refraction)
            const rimD = smoothstep(d.r * 0.78, d.r * 0.98, dd);
            dc = mix3(dc, [120, 30, 38], rimD * 0.35);
            col = dc;
          }
        }

        // Antialias the body edge into the background.
        if (edge < 1) {
          const bg = mix3(BG_TOP, BG_BOT, ny);
          col = mix3(bg, col, edge);
        }
      }

      // --- calyx leaves (drawn over the top of the berry) ---
      if (y < TOP + 220 && y > TOP - 210) {
        for (const leaf of LEAVES) {
          const m = leafMask(x, y, leaf);
          if (m > 0) {
            // Leaf colour: lighter toward the rib, darker toward edges/tip.
            const along = 0; // rib shading via mask falloff only
            let lc = mix3(LEAF_DARK, LEAF_MID, m);
            lc = mix3(lc, LEAF_LIT, smoothstep(0.55, 0.95, m) * 0.7);
            // Central vein: bright line down the leaf middle.
            const ox = CX, oy = TOP + 18;
            const dxl = x - ox, dyl = y - oy;
            const ca = Math.cos(leaf.ang), sa = Math.sin(leaf.ang);
            const across = dxl * ca + dyl * sa;
            const vein = Math.exp(-(across * across) / (2 * 2.2 * 2.2));
            lc = mix3(lc, [150, 205, 110], vein * 0.5 * m);
            col = mix3(col, lc, clamp(m, 0, 1));
          }
        }
      }

      // --- stem ---
      {
        const sx = x - CX, sy = y - (TOP - 118);
        if (Math.abs(sx) < 8 && sy > -60 && sy < 46) {
          const t = clamp((sy + 60) / 106, 0, 1);
          const stemCol = mix3([110, 148, 70], [58, 92, 40], t);
          const edgeS = smoothstep(8, 5, Math.abs(sx));
          col = mix3(col, stemCol, edgeS * 0.95);
        }
      }

      // --- vignette ---
      const vx = (x - 512) / 512, vy = (y - 512) / 512;
      const vig = 1 - 0.32 * Math.pow(vx * vx + vy * vy, 1.4);
      col = [col[0] * vig, col[1] * vig, col[2] * vig];

      buf[idx] = clamp(Math.round(col[0]), 0, 255);
      buf[idx + 1] = clamp(Math.round(col[1]), 0, 255);
      buf[idx + 2] = clamp(Math.round(col[2]), 0, 255);
    }
  }
  return buf;
}

function main() {
  const outDir = process.env.OUT_DIR || "/output";
  const outPath = path.join(outDir, "entry.png");
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  const rgb = render();
  const png = encodePNG(W, H, rgb);
  fs.writeFileSync(outPath, png);
  const ms = Date.now() - t0;
  console.log(`wrote ${outPath} ${png.length} bytes in ${ms}ms`);
}

main();

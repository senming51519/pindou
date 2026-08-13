const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(data) {
  let crc = 0xffffffff;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeB, data]);
  const crcV = Buffer.alloc(4);
  crcV.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crcV]);
}

function createPNG(w, h, pixels) {
  const rowBytes = w * 4;
  const raw = Buffer.alloc((rowBytes + 1) * h);
  for (let y = 0; y < h; y++) {
    const off = y * (rowBytes + 1);
    raw[off] = 0;
    for (let x = 0; x < rowBytes; x++) {
      raw[off + 1 + x] = pixels[y * rowBytes + x];
    }
  }
  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; ihdrData[9] = 6; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  return Buffer.concat([sig, chunk("IHDR", ihdrData), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function fill(pixels, w, h, r, g, b, a) {
  for (let i = 0; i < pixels.length; i += 4) { pixels[i]=r; pixels[i+1]=g; pixels[i+2]=b; pixels[i+3]=a; }
}

function blendPx(pixels, w, h, x, y, r, g, b, a) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  const a0 = pixels[i+3] / 255;
  const a1 = a / 255;
  const ao = a1 + a0 * (1 - a1);
  if (ao === 0) return;
  pixels[i]   = clamp((pixels[i] * a0 * (1 - a1) + r * a1) / ao);
  pixels[i+1] = clamp((pixels[i+1] * a0 * (1 - a1) + g * a1) / ao);
  pixels[i+2] = clamp((pixels[i+2] * a0 * (1 - a1) + b * a1) / ao);
  pixels[i+3] = clamp(ao * 255);
}

function fillCircle(pixels, w, h, cx, cy, rad, r, g, b, a) {
  const rr = rad * rad;
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      const d2 = dx*dx + dy*dy;
      if (d2 <= rr) {
        const dist = Math.sqrt(d2);
        const alpha = Math.min(1, Math.max(0, rad - dist + 0.5)) * a;
        blendPx(pixels, w, h, cx + dx, cy + dy, r, g, b, alpha);
      }
    }
  }
}

// ============ Colors ============
const C = [
  [255,80,80],   [255,150,50], [255,220,50], [80,200,80],
  [60,160,255],  [180,100,255],[255,100,180],[255,255,255],
  [60,60,60],    [150,200,255],
];

// ============ Cat pixel art (14x14) ¡ª filled background ============
// 0=transparent, 1=red, 2=orange, 3=yellow, 4=green,
// 5=blue, 6=purple, 7=pink, 8=white, 9=dark gray, 10=light blue
// All background cells now filled with white (8)
const art = [
  [8,8,8,8,8,8,8,8,8,8,8,8,8,8],
  [8,8,8,8,8,3,3,3,3,8,8,8,8,8],
  [8,8,8,8,3,3,3,3,3,3,8,8,8,8],
  [8,8,8,3,3,8,8,8,8,3,3,8,8,8],
  [8,8,3,3,8,8,8,8,8,8,3,3,8,8],
  [8,8,3,3,8,8,8,8,8,8,3,3,8,8],
  [8,3,3,3,3,3,3,3,3,3,3,3,3,8],
  [8,3,3,3,3,3,3,3,3,3,3,3,3,8],
  [8,3,3,3,3,6,3,3,6,3,3,3,3,8],
  [8,3,3,3,3,6,3,3,6,3,3,3,3,8],
  [8,8,3,3,3,3,1,1,3,3,3,3,8,8],
  [8,8,3,3,3,3,3,3,3,3,3,3,8,8],
  [8,8,8,3,3,3,3,3,3,3,3,8,8,8],
  [8,8,8,8,3,3,3,3,3,3,8,8,8,8],
];

const beadSize = 48, beadGap = 4, step = beadSize + beadGap;
const gx0 = Math.round((1024 - 14*step + beadGap) / 2);
const gy0 = Math.round((1024 - 14*step + beadGap) / 2);

function hl(c) { return c.map(v=>Math.min(255,v+55)); }

// ============ Build icon ============
const W = 1024, H = 1024;
const pix = new Uint8Array(W * H * 4);
fill(pix, W, H, 245, 235, 215, 255); // warm beige background

// Pegboard holes
const pegHole = [200, 185, 160];
for (let gy = 0; gy < 32; gy++)
  for (let gx = 0; gx < 32; gx++)
    fillCircle(pix, W, H, 16+gx*32, 16+gy*32, 3, ...pegHole, 100);

// Draw bead grid
for (let gy = 0; gy < 14; gy++) {
  for (let gx = 0; gx < 14; gx++) {
    const ci = art[gy][gx];
    if (ci === 0) continue;
    const [cr, cg, cb] = C[ci - 1];
    const cx = gx0 + gx*step + beadSize/2;
    const cy = gy0 + gy*step + beadSize/2;
    const rad = beadSize/2;
    // Main bead
    fillCircle(pix, W, H, cx, cy, rad, cr, cg, cb, 255);
    // Highlight
    const [hr, hg, hb] = hl([cr, cg, cb]);
    fillCircle(pix, W, H, cx-rad*0.25, cy-rad*0.25, rad*0.4, hr, hg, hb, 160);
    // Bright spot
    fillCircle(pix, W, H, cx-rad*0.35, cy-rad*0.35, rad*0.16, 255,255,255, 200);
    // Shadow
    fillCircle(pix, W, H, cx+rad*0.2, cy+rad*0.25, rad*0.2, 0,0,0, 30);
  }
}

// Scattered loose beads around the edge
const scatters = [
  [0.08,0.15],[0.15,0.85],[0.85,0.12],[0.92,0.82],
  [0.06,0.48],[0.94,0.44],[0.50,0.06],[0.48,0.94],
  [0.22,0.08],[0.78,0.88],[0.12,0.70],[0.88,0.28],
  [0.30,0.95],[0.70,0.04],[0.04,0.30],[0.96,0.68],
];
for (const [sx, sy] of scatters) {
  const ci = Math.floor(Math.random() * C.length);
  const [cr, cg, cb] = C[ci];
  const cx = W*sx, cy = H*sy;
  const rad = 10 + Math.random()*10;
  fillCircle(pix, W, H, cx, cy, rad, cr, cg, cb, 220);
  const [hr, hg, hb] = hl([cr, cg, cb]);
  fillCircle(pix, W, H, cx-rad*0.3, cy-rad*0.3, rad*0.35, hr, hg, hb, 140);
  fillCircle(pix, W, H, cx-rad*0.4, cy-rad*0.4, rad*0.15, 255,255,255, 180);
}

// Rounded corners
const cr = 120;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let dx = 0, dy = 0, corner = false;
    if (x < cr && y < cr) { dx = cr - x; dy = cr - y; corner = true; }
    else if (x >= W - cr && y < cr) { dx = x - (W - cr); dy = cr - y; corner = true; }
    else if (x < cr && y >= H - cr) { dx = cr - x; dy = y - (H - cr); corner = true; }
    else if (x >= W - cr && y >= H - cr) { dx = x - (W - cr); dy = y - (H - cr); corner = true; }
    if (corner) {
      const dist = Math.sqrt(dx*dx + dy*dy);
      const i = (y*W + x)*4;
      if (dist > cr) pix[i+3] = 0;
      else if (dist > cr - 3) pix[i+3] = Math.round(((cr - dist) / 3) * 255);
    }
  }
}

// Sparkle stars
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  const d = 30 + i * 5;
  fillCircle(pix, W, H, Math.round(W/2 + Math.cos(a)*d), Math.round(80 + Math.sin(a)*d), 255, 220, 50, 200);
  fillCircle(pix, W, H, Math.round(W/2 + Math.cos(a)*d - 1), Math.round(80 + Math.sin(a)*d - 1), 255, 255, 200, 220);
}

const png = createPNG(W, H, pix);
const outPath = process.env.OUTPUT_PATH || path.join(__dirname, "pindou_icon.png");
fs.writeFileSync(outPath, png);
console.log("Done! " + (png.length/1024).toFixed(1) + " KB -> " + outPath);

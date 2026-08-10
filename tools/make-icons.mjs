// Genera los iconos PNG de la app sin dependencias externas.
//   node tools/make-icons.mjs
//
// Dibuja lo mismo que icons/icon.svg: fondo oscuro redondeado, una tarjeta
// blanca ligeramente desplazada detrás y otra delante con una barra azul.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BG = [17, 20, 24, 255];
const CARD_BACK = [90, 104, 124, 255];
const CARD_FRONT = [240, 243, 247, 255];
const ACCENT = [91, 140, 247, 255];

/** Cobertura [0,1] de un píxel dentro de un rectángulo redondeado (4 muestras). */
function coverage(x, y, rect) {
  const { x0, y0, x1, y1, r } = rect;
  let hits = 0;
  for (const dx of [0.25, 0.75]) {
    for (const dy of [0.25, 0.75]) {
      const px = x + dx;
      const py = y + dy;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      const cx = Math.min(Math.max(px, x0 + r), x1 - r);
      const cy = Math.min(Math.max(py, y0 + r), y1 - r);
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) hits += 1;
    }
  }
  return hits / 4;
}

function blend(dst, i, color, alpha) {
  if (alpha <= 0) return;
  const a = alpha * (color[3] / 255);
  for (let c = 0; c < 3; c += 1) {
    dst[i + c] = Math.round(dst[i + c] * (1 - a) + color[c] * a);
  }
  dst[i + 3] = Math.round(dst[i + 3] * (1 - a) + 255 * a);
}

function render(size) {
  const px = new Uint8Array(size * size * 4);
  const s = (v) => v * size;

  const shapes = [
    { rect: { x0: 0, y0: 0, x1: size, y1: size, r: s(0.2) }, color: BG },
    { rect: { x0: s(0.26), y0: s(0.2), x1: s(0.8), y1: s(0.68), r: s(0.07) }, color: CARD_BACK },
    { rect: { x0: s(0.2), y0: s(0.32), x1: s(0.74), y1: s(0.8), r: s(0.07) }, color: CARD_FRONT },
    { rect: { x0: s(0.28), y0: s(0.44), x1: s(0.58), y1: s(0.5), r: s(0.03) }, color: ACCENT },
    { rect: { x0: s(0.28), y0: s(0.58), x1: s(0.66), y1: s(0.63), r: s(0.025) }, color: CARD_BACK },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      for (const { rect, color } of shapes) blend(px, i, color, coverage(x, y, rect));
    }
  }
  return px;
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function toPng(px, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filtro "none"
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(OUT, name), toPng(render(size), size));
  console.log(`icons/${name} (${size}x${size})`);
}

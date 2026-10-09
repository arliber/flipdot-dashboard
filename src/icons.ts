/* Procedural weather icons, authored on a 16-unit canvas and rasterised to any size. */

import type { Glyph } from './fonts';

export type IconKind = 'sun' | 'moon' | 'cloud' | 'partly' | 'rain' | 'snow' | 'storm' | 'fog';
type Shape = (u: number, v: number) => boolean;

const hyp = Math.hypot;

const cloudAt = (u: number, v: number, ox: number, oy: number, g: number): boolean =>
  hyp(u - 5 - ox, v - 10 - oy) < 3.2 + g ||
  hyp(u - 9.4 - ox, v - 7.6 - oy) < 4.2 + g ||
  hyp(u - 12.6 - ox, v - 10.4 - oy) < 2.7 + g ||
  (u > 2.4 + ox - g && u < 14 + ox + g && v > 10 + oy && v < 13.3 + oy + g);

const sunAt = (u: number, v: number, cx: number, cy: number, s: number): boolean => {
  const d = hyp(u - cx, v - cy);
  if (d < 4.2 * s) return true;
  if (d > 5.9 * s && d < 7.7 * s) {
    const a = (((Math.atan2(v - cy, u - cx) * 180) / Math.PI) % 45 + 45) % 45;
    return a < 11 || a > 34;
  }
  return false;
};

function inPoly(u: number, v: number, pts: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const SHAPES: Record<IconKind, Shape> = {
  sun: (u, v) => sunAt(u, v, 8, 8, 1),
  moon: (u, v) => hyp(u - 8, v - 8) < 6.4 && hyp(u - 11, v - 5.4) >= 5,
  cloud: (u, v) => cloudAt(u, v, 0, 0, 0),
  partly: (u, v) => cloudAt(u, v, 1.2, 1.4, 0) || (hyp(u - 5.4, v - 5.4) < 4.3 && !cloudAt(u, v, 1.2, 1.4, 1.4)),
  rain: (u, v) => cloudAt(u, v, 0, -3, 0) || (v > 11.8 && v < 15.8 && (((u + v * 0.55) % 4) + 4) % 4 < 1.15 && u > 2 && u < 14.5),
  snow: (u, v) => cloudAt(u, v, 0, -3, 0) || hyp(u - 4.5, v - 12.9) < 1.25 || hyp(u - 8.5, v - 14.9) < 1.25 || hyp(u - 12.5, v - 12.9) < 1.25,
  storm: (u, v) => cloudAt(u, v, 0, -3, 0) || inPoly(u, v, [[9.6, 10], [5.8, 13.6], [8.2, 13.6], [6.4, 16], [11, 12.2], [8.6, 12.2], [10.6, 10]]),
  fog: (u, v) => [[2, 1, 12], [6, 4, 15], [10, 1, 12], [14, 4, 15]].some(([y, a, b]) => v >= y - 0.8 && v < y + 0.8 && u > a && u < b),
};

const cache: Record<string, Glyph> = {};

export function icon(kind: IconKind, S: number): Glyph {
  const key = kind + S;
  if (cache[key]) return cache[key];
  const f = SHAPES[kind], rows: Glyph = [];
  for (let y = 0; y < S; y++) {
    let r = '';
    for (let x = 0; x < S; x++) r += f(((x + 0.5) * 16) / S, ((y + 0.5) * 16) / S) ? '#' : '.';
    rows.push(r);
  }
  return (cache[key] = rows);
}

/** Map a WMO weather code to an icon. */
export function wxKind(c: number, day: boolean): IconKind {
  if (c <= 1) return day ? 'sun' : 'moon';
  if (c === 2) return day ? 'partly' : 'cloud';
  if (c === 3) return 'cloud';
  if (c === 45 || c === 48) return 'fog';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'storm';
  return 'rain';
}

/** Map a WMO weather code to a short label. */
export function wxWord(c: number, day: boolean): string {
  if (c === 0) return day ? 'SUNNY' : 'CLEAR';
  if (c === 1) return 'FAIR';
  if (c === 2) return 'PARTLY';
  if (c === 3) return 'CLOUDY';
  if (c === 45 || c === 48) return 'FOG';
  if (c >= 51 && c <= 55) return 'DRIZZLE';
  if (c === 56 || c === 57 || c === 66 || c === 67) return 'SLEET';
  if (c === 65) return 'HEAVY RAIN';
  if (c >= 61 && c <= 64) return 'RAIN';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'SNOW';
  if (c >= 80 && c <= 82) return 'SHOWERS';
  if (c === 95) return 'STORM';
  if (c >= 96) return 'HAIL';
  return '';
}

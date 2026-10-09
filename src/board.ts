/* Canvas flip-disc board: pre-rendered disc sprites, per-disc flip scheduling and animation. */

import { COLS, ROWS, type Frame } from './fonts';
import type { DiscShape, DiscSize, DotColor, Transition } from './settings';

/** Flip duration and settle wobble, ms. */
export const FLIP = 38;
const SETTLE = 70;
/** Sprite frames per flip, and per-disc tone variants. */
const K = 12, V = 5;

export const FACES: Record<DotColor, string> = { white: '#f1f0ea', yellow: '#f6dc1e', green: '#b4f53a', orange: '#ff8f1f' };

/** Disc size presets: how much denser than a fitted 56 × 32 board the grid is. */
export const DISC_SIZES: Record<DiscSize, number> = { large: 1, medium: 1.5, small: 2, tiny: 3 };

/** A disc landing: [performance.now() time, horizontal position 0..1]. */
export type Hit = [number, number];

export class Board {
  private ctx: CanvasRenderingContext2D;
  private P = 4;
  private sprites: HTMLCanvasElement[][][] = [];
  /** Grid dimensions; at least COLS × ROWS, larger when discs are smaller than a fitted board. */
  private cols = 0;
  private rows = 0;
  private n = 0;
  private from = new Uint8Array(0);
  private to = new Uint8Array(0);
  private t0 = new Float64Array(0);
  private inActive = new Uint8Array(0);
  private variant = new Uint8Array(0);
  private active: number[] = [];
  private stuck = new Set<number>();
  private slow = new Set<number>();
  private raf = 0;

  constructor(private canvas: HTMLCanvasElement, private onHits: (hits: Hit[]) => void) {
    this.ctx = canvas.getContext('2d')!;
  }

  /**
   * Size the board to the viewport and rebuild sprites. Returns a measurement readout, and whether
   * the grid dimensions changed, which resets every disc so the caller should re-render.
   */
  layout(shape: DiscShape, color: DotColor, size: DiscSize): { specs: string; regrid: boolean } {
    const c = this.canvas, dpr = window.devicePixelRatio || 1;
    const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    const fitP = Math.floor(Math.min(W / COLS, H / ROWS));
    const density = DISC_SIZES[size] || 1;
    const P = Math.max(4, Math.floor(fitP / density));
    // a fitted board stays exactly 56 × 32; denser boards grow to fill the screen
    const cols = density === 1 ? COLS : Math.max(COLS, Math.floor(W / P));
    const rows = density === 1 ? ROWS : Math.max(ROWS, Math.floor(H / P));
    this.P = P;
    const regrid = cols !== this.cols || rows !== this.rows;
    if (regrid) this.alloc(cols, rows);
    c.width = P * cols; c.height = P * rows;
    c.style.width = (P * cols) / dpr + 'px'; c.style.height = (P * rows) / dpr + 'px';
    this.buildSprites(shape, color);
    this.drawAll();
    const ox = Math.round((W - P * cols) / 2), oy = Math.round((H - P * rows) / 2);
    const specs =
      `grid      ${cols} × ${rows} discs  (content ${COLS} × ${ROWS})\n` +
      `pitch     ${P} device px  (${(P / dpr).toFixed(2)} css px)\n` +
      `disc Ø    ${Math.round(P * 0.84)} device px\n` +
      `board     ${P * cols} × ${P * rows} device px\n` +
      `origin    ${ox}, ${oy} device px (top-left cell)\n` +
      `screen    ${W} × ${H} device px  ·  dpr ${dpr}`;
    return { specs, regrid };
  }

  private alloc(cols: number, rows: number): void {
    const n = cols * rows;
    this.cols = cols; this.rows = rows; this.n = n;
    this.from = new Uint8Array(n);
    this.to = new Uint8Array(n);
    this.t0 = new Float64Array(n).fill(-1);
    this.inActive = new Uint8Array(n);
    this.variant = Uint8Array.from({ length: n }, () => Math.floor(Math.random() * V));
    this.active = [];
    this.stuck.clear(); this.slow.clear();
  }

  private buildSprites(shape: DiscShape, color: DotColor): void {
    const P = this.P, on = FACES[color] || FACES.white;
    const tones = [0.84, 0.9, 0.95, 1, 1.05];
    const diag = shape !== 'round', notched = shape === 'notched';
    const H = ({ round: 0.42, notched: 0.465, octagon: 0.4, square: 0.38, rounded: 0.39 } as Record<string, number>)[shape] || 0.42;
    const outline = (g: CanvasRenderingContext2D, h: number) => {
      g.beginPath();
      if (shape === 'square') g.rect(-h, -h, 2 * h, 2 * h);
      else if (shape === 'rounded') {
        const c = h * 0.38;
        g.moveTo(-h + c, -h); g.arcTo(h, -h, h, h, c); g.arcTo(h, h, -h, h, c); g.arcTo(-h, h, -h, -h, c); g.arcTo(-h, -h, h, -h, c); g.closePath();
      } else if (shape === 'octagon') {
        const c = h * 0.42;
        g.moveTo(-h + c, -h); g.lineTo(h - c, -h); g.lineTo(h, -h + c); g.lineTo(h, h - c);
        g.lineTo(h - c, h); g.lineTo(-h + c, h); g.lineTo(-h, h - c); g.lineTo(-h, -h + c); g.closePath();
      } else g.arc(0, 0, h, 0, Math.PI * 2);
    };
    // squash perpendicular to the pivot axis (horizontal for round, top-left→bottom-right diagonal otherwise)
    const squash = (g: CanvasRenderingContext2D, w: number) => {
      if (diag) { g.rotate(Math.PI / 4); g.scale(1, w); g.rotate(-Math.PI / 4); } else g.scale(1, w);
    };
    const mk = (face: number, w: number, vi: number): HTMLCanvasElement => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = P;
      const g = cv.getContext('2d')!, cx = P / 2, cy = P / 2, r = P * H, tone = tones[vi];
      g.fillStyle = notched ? '#050505' : '#070707'; g.fillRect(0, 0, P, P);
      if (!notched) { g.fillStyle = 'rgba(255,255,255,0.025)'; g.fillRect(0, 0, P, Math.max(1, P * 0.04)); }
      g.save(); g.translate(cx, cy); g.fillStyle = '#010101'; outline(g, r * 1.07); g.fill(); g.restore();
      const pw = Math.max(1, P * 0.08), ph = Math.max(1, P * 0.07);
      g.fillStyle = '#1b1b1b';
      if (notched) {
        // pivots are drawn after the face
      } else if (diag) {
        const d = r * (({ square: 1.32, rounded: 1.22, octagon: 1.14 } as Record<string, number>)[shape] || 1.2);
        g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
        g.fillRect(-d - pw / 2, -ph / 2, pw, ph); g.fillRect(d - pw / 2, -ph / 2, pw, ph); g.restore();
      } else {
        g.fillRect(cx - r * 1.14, cy - ph / 2, pw, ph); g.fillRect(cx + r * 1.14 - pw, cy - ph / 2, pw, ph);
      }
      g.save(); g.translate(cx, cy); squash(g, Math.max(0.03, w)); outline(g, r); g.restore();
      g.save(); g.clip();
      const ry = r * Math.max(0.03, w);
      if (face) {
        g.fillStyle = on; g.fillRect(0, 0, P, P);
        const hl = diag
          ? g.createLinearGradient(cx - ry * 0.7, cy - ry * 0.7, cx + ry * 0.7, cy + ry * 0.7)
          : g.createLinearGradient(0, cy - ry, 0, cy + ry);
        hl.addColorStop(0, 'rgba(255,255,255,0.18)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.16)');
        g.fillStyle = hl; g.fillRect(0, 0, P, P);
        if (tone < 1) { g.fillStyle = `rgba(0,0,0,${1 - tone})`; g.fillRect(0, 0, P, P); }
        else if (tone > 1) { g.fillStyle = `rgba(255,255,255,${(tone - 1) * 1.6})`; g.fillRect(0, 0, P, P); }
      } else {
        const gr = g.createLinearGradient(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7), b = Math.round((notched ? 44 : 22) * tone);
        gr.addColorStop(0, `rgb(${b + 6},${b + 6},${b + 5})`); gr.addColorStop(1, `rgb(${b - 8},${b - 8},${b - 8})`);
        g.fillStyle = gr; g.fillRect(0, 0, P, P);
      }
      if (w < 1) { g.fillStyle = `rgba(0,0,0,${(1 - w) * 0.6})`; g.fillRect(0, 0, P, P); }
      g.restore();
      if (w < 0.35) {
        g.save(); g.translate(cx, cy); if (diag) g.rotate(Math.PI / 4);
        g.fillStyle = face ? 'rgba(160,160,150,0.55)' : '#2c2c2c';
        const L = diag && shape === 'square' ? r * 1.41 : r * 1.05;
        g.fillRect(-L, -0.5, 2 * L, 1); g.restore();
      }
      if (notched) {
        const k = r / Math.SQRT2, nr = Math.max(1, P * 0.075), pr = Math.max(0.8, P * 0.04);
        for (const s of [-1, 1]) {
          const nx = cx + s * k, ny = cy + s * k;
          g.fillStyle = '#050505'; g.beginPath(); g.arc(nx, ny, nr, 0, Math.PI * 2); g.fill();
          const pg = g.createRadialGradient(nx - pr * 0.3, ny - pr * 0.3, 0, nx, ny, pr);
          pg.addColorStop(0, '#6a6a6a'); pg.addColorStop(1, '#2a2a2a');
          g.fillStyle = pg; g.beginPath(); g.arc(nx, ny, pr, 0, Math.PI * 2); g.fill();
        }
        return cv;
      }
      g.save(); g.translate(cx, cy); if (diag) g.rotate(Math.PI / 4);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-r * 0.06, -ph * 0.3, r * 0.12, ph * 0.6); g.restore();
      return cv;
    };
    this.sprites = [0, 1].map((f) =>
      Array.from({ length: V }, (_, vi) => Array.from({ length: K }, (_, k) => mk(f, k / (K - 1), vi))),
    );
  }

  private drawDot(i: number, face: number, w: number): void {
    const k = Math.max(0, Math.min(K - 1, Math.round(w * (K - 1))));
    this.ctx.drawImage(this.sprites[face][this.variant[i]][k], (i % this.cols) * this.P, Math.floor(i / this.cols) * this.P);
  }

  private drawAll(): void {
    for (let i = 0; i < this.n; i++) this.drawDot(i, this.t0[i] >= 0 ? this.from[i] : this.to[i], 1);
  }

  private loop = (): void => {
    const now = performance.now(), keep: number[] = [];
    for (const i of this.active) {
      const t0 = this.t0[i];
      if (t0 < 0) { this.drawDot(i, this.to[i], 1); this.inActive[i] = 0; continue; }
      const e = now - t0;
      if (e < 0) { this.drawDot(i, this.from[i], 1); keep.push(i); }
      else if (e < FLIP) {
        const th = Math.PI * Math.pow(e / FLIP, 1.6);
        this.drawDot(i, th < Math.PI / 2 ? this.from[i] : this.to[i], Math.abs(Math.cos(th))); keep.push(i);
      } else if (e < FLIP + SETTLE) {
        const e2 = e - FLIP, th = 0.62 * Math.exp(-e2 / 20) * Math.abs(Math.sin((Math.PI * e2) / 22));
        this.drawDot(i, this.to[i], Math.cos(th)); keep.push(i);
      } else { this.from[i] = this.to[i]; this.t0[i] = -1; this.inActive[i] = 0; this.drawDot(i, this.to[i], 1); }
    }
    this.active = keep;
    this.raf = keep.length ? requestAnimationFrame(this.loop) : 0;
  };

  private kick(): void {
    if (this.active.length && !this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  /** Schedule disc i to flip to v at time t; returns the actual start time, or null if cancelled. */
  private schedule(i: number, v: number, t: number): number | null {
    const now = performance.now(), t0 = this.t0[i];
    if (t0 >= 0 && now < t0) {
      this.to[i] = v;
      if (v === this.from[i]) { this.t0[i] = -1; this.mark(i); return null; }
    } else if (t0 >= 0) { t = Math.max(t, t0 + FLIP); this.from[i] = this.to[i]; this.to[i] = v; }
    else { this.from[i] = this.to[i]; this.to[i] = v; }
    this.t0[i] = t; this.mark(i);
    return t;
  }

  private mark(i: number): void {
    if (!this.inActive[i]) { this.inActive[i] = 1; this.active.push(i); }
  }

  /** Animate the board towards `buf` (a COLS × ROWS frame, centred in the grid) using the given transition timing. */
  setFrame(buf: Frame, style: Transition): void {
    const now = performance.now(), hits: Hit[] = [], { cols, rows } = this;
    const ox = Math.floor((cols - COLS) / 2), oy = Math.floor((rows - ROWS) / 2);
    // keep sweep transitions the same duration on denser grids
    const sx = COLS / cols, sy = ROWS / rows;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const i = y * cols + x, fx = x - ox, fy = y - oy;
      const v = fx >= 0 && fx < COLS && fy >= 0 && fy < ROWS ? buf[fy * COLS + fx] : 0;
      if (this.stuck.has(i) || this.to[i] === v) continue;
      let d = style === 'cascade' ? y * sy * 13 + Math.random() * 4
        : style === 'scatter' ? Math.random() * 800
        : style === 'flush' ? Math.random() * 12
        : x * sx * 7 + y * sy * 0.12 + Math.random() * 1.5;
      if (this.slow.has(i)) d += 140 + Math.random() * 160;
      const t = this.schedule(i, v, now + d);
      if (t != null) hits.push([t + FLIP, x / (cols - 1)]);
    }
    this.onHits(hits);
    this.kick();
  }

  /** Pick a few stuck and slow discs to simulate a worn board. */
  rollWorn(): void {
    this.stuck.clear(); this.slow.clear();
    for (let n = 0; n < 4; n++) {
      const i = Math.floor(Math.random() * this.n);
      this.stuck.add(i);
      const v = Math.random() < 0.5 ? 1 : 0;
      if (this.to[i] !== v) this.schedule(i, v, performance.now() + 50);
    }
    for (let n = 0; n < 14; n++) this.slow.add(Math.floor(Math.random() * this.n));
    this.kick();
  }

  clearWorn(): void {
    this.stuck.clear(); this.slow.clear();
  }
}

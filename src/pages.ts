/*
 * Page renderers: each returns a frame sized to the board grid.
 * The standard 56 × 32 grid uses the original hand-placed layouts; other grids pick the largest
 * fonts and icons that fit, falling back step by step.
 */

import { BIG, COLS, DAYS, F5, F7, MID, MONS, NARROW, ROWS, R, blit, centerX, fit, fontH, newFrame, text, textW, type Font, type Frame, type Glyph } from './fonts';
import { icon, wxKind, wxWord } from './icons';
import type { DayForecast, WxState } from './weather';

const isStd = (w: number, h: number) => w === COLS && h === ROWS;

/** Digit fonts for time and temperature, largest first, with their colon placement. */
interface Num { f: Font; gap: number; sep: number; colon: Glyph; cx: number; cy: number }
const NUMS: Num[] = [
  { f: BIG, gap: 2, sep: 8, colon: R('##*2 ..*4 ##*2'), cx: 3, cy: 4 },
  { f: MID, gap: 1, sep: 4, colon: R('##*2 ..*2 ##*2'), cx: 1, cy: 2 },
  { f: NARROW, gap: 1, sep: 4, colon: R('##*2 .. ##*2'), cx: 1, cy: 2 },
  { f: F7, gap: 1, sep: 3, colon: R('# . . . #'), cx: 1, cy: 1 },
  { f: F5, gap: 1, sep: 3, colon: R('# . #'), cx: 1, cy: 1 },
];
/** Text fonts, largest first. */
const TEXTS = [F7, F5];

/** Space between a main row and the text line under it, given the spare rows. */
const spacing = (free: number) => Math.min(4, Math.max(1, Math.round(free / 3)));

/* ---------- clock ---------- */

const timeW = (n: Num, hs: string, ms: string) => textW(n.f, hs, n.gap) + n.sep + textW(n.f, ms, n.gap);

function drawTime(fr: Frame, n: Num, hs: string, ms: string, y: number, colon: boolean): void {
  const wH = textW(n.f, hs, n.gap), x = Math.floor((fr.w - timeW(n, hs, ms)) / 2);
  text(fr, n.f, hs, x, y, n.gap);
  text(fr, n.f, ms, x + wH + n.sep, y, n.gap);
  if (colon) blit(fr, n.colon, x + wH + n.cx, y + n.cy);
}

export function pageClock(w: number, h: number, hour24: boolean, blinkColon: boolean): Frame {
  const fr = newFrame(w, h), d = new Date();
  let hr = d.getHours();
  if (!hour24) hr = hr % 12 || 12;
  const hs = hour24 ? String(hr).padStart(2, '0') : String(hr), ms = String(d.getMinutes()).padStart(2, '0');
  const colon = !blinkColon || d.getSeconds() % 2 === 0;
  const day = DAYS[d.getDay()], date = `${d.getDate()} ${MONS[d.getMonth()]}`;

  if (isStd(w, h)) {
    const wH = textW(BIG, hs, 2), total = wH + 8 + textW(BIG, ms, 2);
    const x = Math.floor((COLS - total) / 2), y = 3;
    text(fr, BIG, hs, x, y, 2);
    text(fr, BIG, ms, x + wH + 8, y, 2);
    if (colon) blit(fr, NUMS[0].colon, x + wH + 3, y + 4);
    const ds = `${day} ${date}`;
    text(fr, F7, ds, centerX(F7, ds), 23);
    return fr;
  }

  // size by the widest possible time so the font doesn't jump as the minutes change
  const fits = NUMS.filter((n) => timeW(n, '88', '88') <= w - 2 && fontH(n.f) <= h);
  // biggest digits first; for each, prefer a blank row above and below
  for (const n of fits) for (const margin of [1, 0]) {
    const th = fontH(n.f);
    for (const s of [`${day} ${date}`, date, day]) for (const df of TEXTS) {
      const free = h - th - fontH(df) - 2 * margin;
      if (free < 1 || textW(df, s) > w - 2) continue;
      const sp = Math.min(free, n.f === BIG ? 4 : spacing(free)), y = Math.ceil((h - th - sp - fontH(df)) / 2);
      drawTime(fr, n, hs, ms, y, colon);
      text(fr, df, s, centerX(df, s, 1, 0, w), y + th + sp);
      return fr;
    }
  }
  // no room for the date: time alone
  const n = fits[0] ?? NUMS[NUMS.length - 1];
  drawTime(fr, n, hs, ms, Math.floor((h - fontH(n.f)) / 2), colon);
  return fr;
}

/* ---------- current weather ---------- */

export function pageNow(w: number, h: number, wx: WxState): Frame {
  const fr = newFrame(w, h);
  if (wx.status !== 'ok') return pageStatus(fr, wx);
  const kind = wxKind(wx.code, wx.day), today = wx.days[0];
  const lines = [wxWord(wx.code, wx.day), today ? `H${today.hi} L${today.lo}` : ''];
  const line = lines[Math.floor(Date.now() / 5000) % lines.length];

  if (isStd(w, h)) {
    blit(fr, icon(kind, 16), 3, 3);
    let t = `${wx.temp}°`;
    if (textW(BIG, t, 2) > 31) t = String(wx.temp);
    text(fr, BIG, t, COLS - 3 - textW(BIG, t, 2), 3, 2);
    const s = fit(F7, line, COLS - 2);
    text(fr, F7, s, centerX(F7, s), 23);
    return fr;
  }

  // icon + temperature row, then the rotating text line; prefer an untruncated line
  for (const truncate of [false, true]) for (const n of NUMS) for (const margin of [1, 0]) {
    const th = fontH(n.f);
    for (const t of [`${wx.temp}°`, String(wx.temp)]) {
      const tw = textW(n.f, t, n.gap), slack = w - th - tw;
      if (slack < 3) continue;
      for (const df of TEXTS) {
        const free = h - th - fontH(df) - 2 * margin;
        if (free < 1 || (!truncate && textW(df, line) > w - 2)) continue;
        const sp = Math.min(free, n.f === BIG ? 4 : spacing(free)), y = Math.ceil((h - th - sp - fontH(df)) / 2);
        const m = Math.min(3, Math.floor((slack - 1) / 2));
        blit(fr, icon(kind, th), m, y);
        text(fr, n.f, t, w - m - tw, y, n.gap);
        const s = fit(df, line, w - 2);
        text(fr, df, s, centerX(df, s, 1, 0, w), y + th + sp);
        return fr;
      }
    }
  }
  const t = String(wx.temp);
  text(fr, F5, t, centerX(F5, t, 1, 0, w), Math.floor((h - 5) / 2));
  return fr;
}

/* ---------- forecast ---------- */

interface RowSpec { day: Font | null; icon: number; hi: Font; lo: Font | null; rh: number }
const ROW_SPECS: RowSpec[] = [
  { day: F7, icon: 10, hi: F7, lo: F5, rh: 10 },
  { day: F7, icon: 7, hi: F7, lo: F5, rh: 7 },
  { day: F5, icon: 7, hi: F7, lo: F5, rh: 7 },
  { day: F5, icon: 7, hi: F5, lo: F5, rh: 7 },
  { day: F5, icon: 7, hi: F7, lo: null, rh: 7 },
  { day: F5, icon: 7, hi: F5, lo: null, rh: 7 },
  { day: null, icon: 7, hi: F5, lo: F5, rh: 7 },
];

const dayName = (d: DayForecast) => DAYS[new Date(d.date + 'T12:00').getDay()];

/** Widths of a row's parts, left to right. */
const rowParts = (sp: RowSpec, d: DayForecast) => [
  ...(sp.day ? [textW(sp.day, dayName(d))] : []),
  sp.icon,
  textW(sp.hi, String(d.hi)),
  ...(sp.lo ? [textW(sp.lo, String(d.lo))] : []),
];
const rowMinW = (sp: RowSpec, d: DayForecast) => { const p = rowParts(sp, d); return p.reduce((a, b) => a + b, 0) + p.length - 1; };

function drawRow(fr: Frame, sp: RowSpec, d: DayForecast, y: number, m: number): void {
  const mid = (eh: number) => y + Math.floor((sp.rh - eh) / 2);
  let left = m;
  if (sp.day) { const s = dayName(d); text(fr, sp.day, s, left, mid(fontH(sp.day))); left += textW(sp.day, s); }
  let right = fr.w - m;
  if (sp.lo) { const lo = String(d.lo); right -= textW(sp.lo, lo); text(fr, sp.lo, lo, right, mid(fontH(sp.lo))); right -= 2; }
  const hi = String(d.hi);
  right -= textW(sp.hi, hi);
  text(fr, sp.hi, hi, right, mid(fontH(sp.hi)));
  const ix = sp.day ? left + Math.floor((right - left - sp.icon) / 2) : m;
  blit(fr, icon(wxKind(d.code, true), sp.icon), ix, mid(sp.icon));
}

export function pageForecast(w: number, h: number, wx: WxState): Frame {
  const fr = newFrame(w, h);
  if (wx.status !== 'ok') return pageStatus(fr, wx);

  if (isStd(w, h)) {
    wx.days.slice(1, 4).forEach((d, r) => {
      const y0 = 1 + r * 10;
      text(fr, F7, dayName(d), 2, y0 + 1);
      blit(fr, icon(wxKind(d.code, true), 10), 22, y0);
      const lo = String(d.lo), hi = String(d.hi), lw = textW(F5, lo);
      text(fr, F5, lo, COLS - 2 - lw, y0 + 3);
      text(fr, F7, hi, COLS - 2 - lw - 3 - textW(F7, hi), y0 + 1);
    });
    return fr;
  }

  // as many days as fit (up to 3), each with the largest row style that fits
  for (let n = Math.min(3, wx.days.length - 1); n >= 1; n--) {
    const days = wx.days.slice(1, 1 + n);
    for (const sp of ROW_SPECS) {
      if (n * sp.rh > h) continue;
      const need = Math.max(...days.map((d) => rowMinW(sp, d)));
      if (need > w) continue;
      const m = w - need >= 6 ? 2 : w - need >= 2 ? 1 : 0;
      const free = h - n * sp.rh;
      // spread rows out, but keep at least one blank row between them when possible
      let gap = Math.min(3, Math.floor(free / (n + 1)));
      if (!gap && n > 1) gap = Math.min(1, Math.floor(free / (n - 1)));
      const top = Math.floor((free - (n - 1) * gap) / 2);
      days.forEach((d, r) => drawRow(fr, sp, d, top + r * (sp.rh + gap), m));
      return fr;
    }
  }
  return pageStatus(fr, { status: 'error' });
}

/* ---------- loading / error ---------- */

function pageStatus(fr: Frame, wx: WxState): Frame {
  const s = wx.status === 'error' ? 'NO DATA' : 'LOADING';
  if (isStd(fr.w, fr.h)) {
    text(fr, F7, 'WEATHER', centerX(F7, 'WEATHER'), 7);
    text(fr, F7, s, centerX(F7, s), 18);
    return fr;
  }
  const f = TEXTS.find((t) => textW(t, 'WEATHER') <= fr.w - 2 && 2 * fontH(t) + 2 <= fr.h) ?? F5;
  const fh = fontH(f), sp = spacing(fr.h - 2 * fh) + 1, y = Math.floor((fr.h - 2 * fh - sp) / 2);
  text(fr, f, 'WEATHER', centerX(f, 'WEATHER', 1, 0, fr.w), y);
  text(fr, f, s, centerX(f, s, 1, 0, fr.w), y + fh + sp);
  return fr;
}

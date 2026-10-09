/* Page renderers: each returns a 56 × 32 frame. */

import { BIG, COLS, DAYS, F5, F7, MONS, R, blit, centerX, fit, newFrame, text, textW, type Frame } from './fonts';
import { icon, wxKind, wxWord } from './icons';
import type { WxState } from './weather';

const COLON = R('##*2 ..*4 ##*2');

export function pageClock(hour24: boolean, blinkColon: boolean): Frame {
  const b = newFrame(), d = new Date();
  let h = d.getHours();
  if (!hour24) h = h % 12 || 12;
  const hs = hour24 ? String(h).padStart(2, '0') : String(h), ms = String(d.getMinutes()).padStart(2, '0');
  const wH = textW(BIG, hs, 2), total = wH + 8 + textW(BIG, ms, 2);
  const x = Math.floor((COLS - total) / 2), y = 3;
  text(b, BIG, hs, x, y, 2);
  text(b, BIG, ms, x + wH + 8, y, 2);
  if (!blinkColon || d.getSeconds() % 2 === 0) blit(b, COLON, x + wH + 3, y + 4);
  const ds = `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]}`;
  text(b, F7, ds, centerX(F7, ds), 23);
  return b;
}

export function pageNow(w: WxState): Frame {
  const b = newFrame();
  if (w.status !== 'ok') return pageStatus(b, w);
  blit(b, icon(wxKind(w.code, w.day), 16), 3, 3);
  let t = `${w.temp}°`;
  if (textW(BIG, t, 2) > 31) t = String(w.temp);
  text(b, BIG, t, COLS - 3 - textW(BIG, t, 2), 3, 2);
  const today = w.days[0];
  const lines = [wxWord(w.code, w.day), today ? `H${today.hi} L${today.lo}` : ''].map((s) => fit(F7, s, COLS - 2));
  const s = lines[Math.floor(Date.now() / 5000) % lines.length];
  text(b, F7, s, centerX(F7, s), 23);
  return b;
}

export function pageForecast(w: WxState): Frame {
  const b = newFrame();
  if (w.status !== 'ok') return pageStatus(b, w);
  w.days.slice(1, 4).forEach((d, r) => {
    const y0 = 1 + r * 10, dt = new Date(d.date + 'T12:00');
    text(b, F7, DAYS[dt.getDay()], 2, y0 + 1);
    blit(b, icon(wxKind(d.code, true), 10), 22, y0);
    const lo = String(d.lo), hi = String(d.hi), lw = textW(F5, lo);
    text(b, F5, lo, COLS - 2 - lw, y0 + 3);
    text(b, F7, hi, COLS - 2 - lw - 3 - textW(F7, hi), y0 + 1);
  });
  return b;
}

function pageStatus(b: Frame, w: WxState): Frame {
  text(b, F7, 'WEATHER', centerX(F7, 'WEATHER'), 7);
  const s = w.status === 'error' ? 'NO DATA' : 'LOADING';
  text(b, F7, s, centerX(F7, s), 18);
  return b;
}

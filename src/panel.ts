/* Settings side sheet. Built once; sync() reflects the current settings without rebuilding the DOM. */

import { FACES } from './board';
import type { Settings } from './settings';

type Key = keyof Settings;

export interface PanelHooks {
  get(): Settings;
  set<K extends Key>(k: K, v: Settings[K]): void;
  wxStatus(): string;
  nextPage(): void;
  reset(): void;
}

const seg = (key: Key, opts: [unknown, string][]) =>
  opts.map(([v, label]) => `<button class="seg" data-key="${key}" data-value='${JSON.stringify(v)}'>${label}</button>`).join('');

const toggle = (key: Key, label: string) =>
  `<div class="row toggle" data-toggle="${key}"><span>${label}</span><span class="switch"><span class="knob"></span></span></div>`;

const section = (title: string, body: string) =>
  `<div class="section"><div class="label">${title}</div>${body}</div>`;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export class Panel {
  readonly el: HTMLDivElement;
  private q = <T extends Element>(sel: string) => this.el.querySelector<T>(sel)!;

  constructor(private h: PanelHooks) {
    const el = (this.el = document.createElement('div'));
    el.className = 'overlay';
    el.hidden = true;
    el.innerHTML = `
      <div class="sheet">
        <div class="head"><div class="title">Settings</div><button class="pill" data-act="close">Done</button></div>
        ${section('Disc shape', `<div class="segs">${seg('discShape', [['notched', 'Notched'], ['round', 'Round'], ['octagon', 'Octagon'], ['square', 'Square'], ['rounded', 'Rounded']])}</div>`)}
        ${section('Disc size', `<div class="segs">${seg('discSize', [['large', 'Large'], ['medium', 'Medium'], ['small', 'Small'], ['tiny', 'Tiny']])}</div>`)}
        ${section('Disc colour', `<div class="swatches">${Object.entries(FACES)
          .map(([k, hex]) => `<button class="swatch" data-key="dotColor" data-value='"${k}"'><span class="chip" style="background:${hex}"></span><span>${cap(k)}</span></button>`)
          .join('')}</div>`)}
        ${section('Page transition', `<div class="segs">${seg('transition', [['wipe', 'Wipe'], ['cascade', 'Cascade'], ['scatter', 'Scatter'], ['flush', 'Flush']])}</div>`)}
        ${section('Auto-rotate pages', `<div class="segs">${seg('pageSeconds', [[0, 'Off'], [10, '10s'], [15, '15s'], [30, '30s'], [60, '60s']])}</div>`)}
        <div class="rows">
          ${toggle('sound', 'Flip sound')}
          <div class="row"><span class="fixed">Volume</span><input class="volume" type="range" min="0" max="1" step="0.05"><span class="fixed pct"></span></div>
          ${toggle('hour24', '24-hour clock')}
          ${toggle('blinkColon', 'Blink colon every second')}
          ${toggle('wornDots', 'Worn discs (stuck and slow)')}
          ${toggle('showSpecs', 'Show grid measurements')}
        </div>
        ${section('Weather location', `
          <div class="loc"><input class="loc-input" placeholder="City or lat, lon"><button class="primary" data-act="loc">Set</button></div>
          <div class="hint wx-status"></div>`)}
        <div class="actions">
          <button class="ghost" data-act="next">Next page</button>
          <button class="ghost dim" data-act="reset">Reset to defaults</button>
        </div>
        <div class="foot">Tap the display to change page. Double-tap to open this panel.</div>
      </div>`;

    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === el) return this.close();
      const opt = t.closest<HTMLElement>('[data-key]');
      if (opt) return h.set(opt.dataset.key as Key, JSON.parse(opt.dataset.value!));
      const tg = t.closest<HTMLElement>('[data-toggle]');
      if (tg) { const k = tg.dataset.toggle as Key; return h.set(k, !h.get()[k] as never); }
      switch (t.closest<HTMLElement>('[data-act]')?.dataset.act) {
        case 'close': return this.close();
        case 'loc': return this.commitLoc();
        case 'next': return h.nextPage();
        case 'reset': h.reset(); this.locInput.value = h.get().location; return;
      }
    });
    this.volume.addEventListener('input', () => h.set('volume', +this.volume.value));
    this.locInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { this.commitLoc(); this.locInput.blur(); }
    });
  }

  private get volume() { return this.q<HTMLInputElement>('.volume'); }
  private get locInput() { return this.q<HTMLInputElement>('.loc-input'); }

  private commitLoc(): void {
    this.h.set('location', this.locInput.value.trim());
  }

  get isOpen(): boolean { return !this.el.hidden; }

  open(): void {
    this.locInput.value = this.h.get().location;
    this.el.hidden = false;
    this.sync();
  }

  close(): void { this.el.hidden = true; }

  sync(): void {
    if (!this.isOpen) return;
    const s = this.h.get();
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-key]'))
      b.classList.toggle('on', JSON.stringify(s[b.dataset.key as Key]) === b.dataset.value);
    for (const t of this.el.querySelectorAll<HTMLElement>('[data-toggle]'))
      t.classList.toggle('on', !!s[t.dataset.toggle as Key]);
    if (document.activeElement !== this.volume) this.volume.value = String(s.volume);
    this.q('.pct').textContent = Math.round(s.volume * 100) + '%';
    this.q('.wx-status').textContent = this.h.wxStatus();
  }
}
